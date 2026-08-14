import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/game_event.dart';
import '../services/game_connection.dart';
import '../services/server_discovery.dart';
import '../theme.dart';
import '../widgets/doodle_stage.dart';
import 'game_screen.dart';

/// Where the phone should look for the game server. On the Android emulator
/// 10.0.2.2 is the host machine; on a real phone this is the host's LAN IP.
/// Whatever the player last connected to successfully is remembered on the
/// device (see [_addressPrefsKey]), so this default only matters the very
/// first time the app runs.
const _defaultServer = String.fromEnvironment('SERVER', defaultValue: 'localhost:8090');
const _addressPrefsKey = 'server_address';

enum _Action { quickPlay, createLobby, joinLobby }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.connection});

  final GameConnection connection;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _nicknameController = TextEditingController();
  final _codeController = TextEditingController();
  final _addressController = TextEditingController(text: _defaultServer);

  StreamSubscription<GameEvent>? _sub;
  String? _connectionId;
  String? _error;
  bool _busy = false;
  bool _showAdvanced = false;
  bool _discovering = false;
  bool _discovered = false;

  /// The idle canvas runs on its own socket rather than sharing
  /// [widget.connection]. Joining a game reconnects that one, and a
  /// close/reopen in the middle of the join handshake would otherwise look
  /// like a dropped connection to [_handleEvent].
  final _doodleConnection = GameConnection();
  StreamSubscription<GameEvent>? _doodleSub;
  DoodleEvent? _doodle;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
    _doodleSub = _doodleConnection.events.listen((event) {
      if (event is DoodleEvent && mounted) setState(() => _doodle = event);
    });
    _loadSavedAddress().then((_) => _autoDiscover()).then((_) => _startDoodleFeed());
  }

  /// Opens a side connection purely to pull down bot drawings to replay while
  /// the player is deciding what to do. Best-effort: with no server reachable
  /// there's simply no canvas, and nothing else on this screen changes.
  Future<void> _startDoodleFeed() async {
    try {
      await _doodleConnection.connect(_addressController.text.trim());
    } catch (_) {
      return;
    }
    if (!mounted) return;
    _doodleConnection.requestDoodle();
  }

  Future<void> _loadSavedAddress() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_addressPrefsKey);
    if (saved == null || !mounted) return;
    setState(() {
      _addressController.text = saved;
      // Surface it up front if it's not just the out-of-the-box default —
      // the player probably wants to see/edit it without hunting for the
      // toggle first.
      _showAdvanced = saved != _defaultServer;
    });
  }

  /// Looks for a host on the current Wi-Fi network and, if found, fills in
  /// the address automatically — this is what makes switching between home
  /// and office Wi-Fi not require retyping an IP every time. Silently does
  /// nothing if it can't find one; the manually-entered/saved address is
  /// left in place either way.
  Future<void> _autoDiscover() async {
    setState(() => _discovering = true);
    final found = await discoverServer();
    if (!mounted) return;
    setState(() {
      _discovering = false;
      if (found != null) {
        _addressController.text = found;
        _discovered = true;
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _doodleSub?.cancel();
    _doodleConnection.dispose();
    _nicknameController.dispose();
    _codeController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  void _handleEvent(GameEvent event) {
    if (!mounted) return;
    switch (event) {
      case WelcomeEvent(:final connectionId):
        _connectionId = connectionId;
      case LobbyStateEvent(:final lobby):
        // Only the first lobby_state (the one that put us in a room) should
        // navigate; later updates belong to GameScreen.
        if (!_busy) return;
        setState(() {
          _busy = false;
          // The lobby runs its own idle canvas off the game connection; this
          // screen's side socket would just be burning battery behind it.
          _doodle = null;
        });
        _doodleConnection.disconnect();
        Navigator.of(context)
            .push(
              MaterialPageRoute(
                builder: (_) => GameScreen(
                  connection: widget.connection,
                  initialLobby: lobby,
                  myId: _connectionId!,
                ),
              ),
            )
            .then((_) async {
              await widget.connection.disconnect();
              if (mounted) await _startDoodleFeed();
            });
      case ErrorEvent(:final message):
        setState(() {
          _busy = false;
          _error = message;
        });
      case DisconnectedEvent():
        setState(() => _busy = false);
      default:
        break;
    }
  }

  Future<void> _run(_Action action) async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      setState(() => _error = 'Pick a nickname first');
      return;
    }
    final code = _codeController.text.trim();
    if (action == _Action.joinLobby && code.isEmpty) {
      setState(() => _error = 'Enter the room code');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final address = _addressController.text.trim();
      await widget.connection.connect(address);
      unawaited(
        SharedPreferences.getInstance().then((prefs) => prefs.setString(_addressPrefsKey, address)),
      );
      switch (action) {
        case _Action.quickPlay:
          widget.connection.quickPlay(nickname);
        case _Action.createLobby:
          widget.connection.createLobby(nickname);
        case _Action.joinLobby:
          widget.connection.joinLobby(code, nickname);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = "Can't reach the server — is it running?";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 22),
              const Text('🎨', style: TextStyle(fontSize: 44), textAlign: TextAlign.center),
              const SizedBox(height: 6),
              const Text(
                'BAD MENTAL\nCANVAS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  height: 1.15,
                  color: GameColors.primary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Draw badly. Lie boldly. 3–5 players.',
                textAlign: TextAlign.center,
                style: TextStyle(color: GameColors.textMuted, fontSize: 15),
              ),
              // Something is always being drawn here, so the menu shows what
              // the game actually is instead of describing it. Only appears
              // once a server has been found.
              if (_doodle != null) ...[
                const SizedBox(height: 20),
                DoodleStage(
                  doodle: _doodle,
                  onNext: _doodleConnection.requestDoodle,
                  maxCanvasSize: 215,
                  compact: true,
                ),
              ],
              const SizedBox(height: 26),
              TextField(
                controller: _nicknameController,
                maxLength: 16,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  hintText: 'Your nickname',
                  counterText: '',
                  prefixIcon: Icon(Icons.person_outline, color: GameColors.textMuted),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _busy ? null : () => _run(_Action.quickPlay),
                icon: const Icon(Icons.shuffle_rounded),
                label: const Text('QUICK PLAY'),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Drops you into a random open lobby',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GameColors.textMuted, fontSize: 13),
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  const Expanded(child: Divider(color: GameColors.surfaceHigh)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'OR PLAY WITH FRIENDS',
                      style: TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 11,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                  const Expanded(child: Divider(color: GameColors.surfaceHigh)),
                ],
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _run(_Action.createLobby),
                icon: const Icon(Icons.add_rounded),
                label: const Text('CREATE PRIVATE LOBBY'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _codeController,
                maxLength: 4,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  hintText: 'Room code',
                  counterText: '',
                  prefixIcon: Icon(Icons.tag_rounded, color: GameColors.textMuted),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: _busy ? null : () => _run(_Action.joinLobby),
                child: const Text('JOIN WITH CODE'),
              ),
              if (_busy) ...[
                const SizedBox(height: 24),
                const Center(child: CircularProgressIndicator(color: GameColors.primary)),
              ],
              if (_error != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF6B6B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Color(0xFFFF6B6B), size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Color(0xFFFF6B6B)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => setState(() => _showAdvanced = !_showAdvanced),
                    child: Text(
                      _showAdvanced ? 'Hide server settings' : 'Server settings',
                      style: const TextStyle(color: GameColors.textMuted, fontSize: 13),
                    ),
                  ),
                  if (_discovering)
                    const Padding(
                      padding: EdgeInsets.only(left: 4),
                      child: SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2, color: GameColors.textMuted),
                      ),
                    )
                  else if (_discovered)
                    const Padding(
                      padding: EdgeInsets.only(left: 2),
                      child: Icon(Icons.wifi_tethering_rounded, size: 16, color: GameColors.lime),
                    ),
                ],
              ),
              if (_showAdvanced)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _addressController,
                        onChanged: (_) => setState(() => _discovered = false),
                        decoration: InputDecoration(
                          labelText: 'Server address (host:port)',
                          hintText: 'e.g. 192.168.1.42:8090',
                          suffixIcon: IconButton(
                            onPressed: _discovering ? null : _autoDiscover,
                            icon: const Icon(Icons.wifi_find_rounded),
                            tooltip: 'Search this Wi-Fi network',
                            color: GameColors.textMuted,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _discovered
                            ? 'Found automatically on this Wi-Fi network.'
                            : "Whoever's hosting runs start-server.sh on their computer — it "
                                'prints this address. Saved automatically once it connects.',
                        style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
