import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../services/game_connection.dart';
import '../services/identity.dart';
import '../services/server_discovery.dart';
import '../theme.dart';
import '../widgets/doodle_stage.dart';
import 'game_screen.dart';
import 'leaderboard_screen.dart';
import 'queue_screen.dart';

/// Where the phone should look for the game server. On the Android emulator
/// 10.0.2.2 is the host machine; on a real phone this is the host's LAN IP.
/// Whatever the player last connected to successfully is remembered on the
/// device (see [_addressPrefsKey]), so this default only matters the very
/// first time the app runs.
const _defaultServer = String.fromEnvironment(
  'SERVER',
  defaultValue: 'localhost:8090',
);
const _addressPrefsKey = 'server_address';

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
  Identity? _identity;
  Profile? _profile;
  DoodleEvent? _doodle;

  String? _error;
  bool _connected = false;
  bool _busy = false;
  bool _queued = false;
  bool _showAdvanced = false;
  bool _discovering = false;
  bool _discovered = false;
  bool _inGame = false;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
    _boot();
  }

  /// Load the account, find a server, sign in, start the idle canvas.
  Future<void> _boot() async {
    final identity = await loadIdentity();
    if (!mounted) return;
    setState(() {
      _identity = identity;
      _nicknameController.text = identity.nickname;
    });
    await _loadSavedAddress();
    await _autoDiscover();
    await _ensureConnected(silent: true);
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

  /// Opens the connection and signs in, once. Unlike before, this stays open
  /// for the whole session — the identity handshake has to survive between
  /// actions, and it also feeds the idle canvas.
  Future<bool> _ensureConnected({bool silent = false}) async {
    if (_connected) return true;
    final identity = _identity;
    if (identity == null) return false;
    try {
      await widget.connection.connect(_addressController.text.trim());
    } catch (_) {
      if (mounted && !silent) {
        setState(() => _error = "Can't reach the server — is it running?");
      }
      return false;
    }
    if (!mounted) return false;
    setState(() => _connected = true);
    if (identity.hasNickname) {
      widget.connection.hello(identity);
      widget.connection.requestDoodle();
    }
    unawaited(
      SharedPreferences.getInstance().then(
        (prefs) =>
            prefs.setString(_addressPrefsKey, _addressController.text.trim()),
      ),
    );
    return true;
  }

  @override
  void dispose() {
    _sub?.cancel();
    _nicknameController.dispose();
    _codeController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  void _handleEvent(GameEvent event) {
    if (!mounted) return;
    switch (event) {
      case ProfileEvent(:final profile):
        setState(() => _profile = profile);
      case DoodleEvent():
        setState(() => _doodle = event);
      case LobbyStateEvent(:final lobby):
        // Both paths land here: matchmaking dropping us into a ranked game,
        // and creating or joining a friendly one. Ignore updates for a game
        // we're already inside — those belong to GameScreen.
        if (_inGame) return;
        _openGame(lobby);
      case ErrorEvent(:final message):
        setState(() {
          _busy = false;
          _queued = false;
          _error = message;
        });
      case DisconnectedEvent():
        setState(() {
          _busy = false;
          _connected = false;
          _queued = false;
          _doodle = null;
        });
      default:
        break;
    }
  }

  void _openGame(LobbyState lobby) {
    setState(() {
      _busy = false;
      _queued = false;
      _inGame = true;
      // The game screen runs its own idle canvas; ours would just burn battery
      // behind it.
      _doodle = null;
    });
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (_) => GameScreen(
              connection: widget.connection,
              initialLobby: lobby,
              myId: _identity!.playerId,
            ),
          ),
        )
        .then((_) {
          if (!mounted) return;
          setState(() => _inGame = false);
          // Still signed in on the same socket — just pick the canvas back up.
          if (_connected) widget.connection.requestDoodle();
        });
  }

  Future<void> _saveName() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      setState(() => _error = 'Pick a nickname first');
      return;
    }
    await saveNickname(nickname);
    final identity = Identity(
      playerId: _identity!.playerId,
      nickname: nickname,
    );
    if (!mounted) return;
    setState(() {
      _identity = identity;
      _error = null;
    });
    if (await _ensureConnected()) {
      // Same account either way: `hello` creates it, `set_nickname` renames it.
      widget.connection.hello(identity);
      widget.connection.requestDoodle();
    }
  }

  Future<void> _playRanked() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    if (!await _ensureConnected()) {
      setState(() => _busy = false);
      return;
    }
    widget.connection.findMatch();
    setState(() {
      _busy = false;
      _queued = true;
    });
  }

  Future<void> _friendly({String? code}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    if (!await _ensureConnected()) {
      setState(() => _busy = false);
      return;
    }
    if (code == null) {
      widget.connection.createLobby();
    } else {
      widget.connection.joinLobby(code);
    }
  }

  Future<void> _openLeaderboard() async {
    if (!await _ensureConnected()) return;
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LeaderboardScreen(
          connection: widget.connection,
          myId: _identity!.playerId,
        ),
      ),
    );
    if (mounted && _connected) widget.connection.requestDoodle();
  }

  @override
  Widget build(BuildContext context) {
    final identity = _identity;
    if (identity == null) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: GameColors.primary),
        ),
      );
    }

    if (_queued) {
      return QueueScreen(
        connection: widget.connection,
        onCancel: () {
          widget.connection.cancelMatch();
          setState(() => _queued = false);
          widget.connection.requestDoodle();
        },
      );
    }

    if (!identity.hasNickname) return _buildFirstRun();
    return _buildMenu(identity);
  }

  /// First launch: pick a name once. It's kept on the device from then on, so
  /// this is the only time it's asked for.
  Widget _buildFirstRun() {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),
              const Text(
                '🎨',
                style: TextStyle(fontSize: 56),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
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
              const SizedBox(height: 30),
              const Text(
                "WHAT SHOULD WE CALL YOU?",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 12,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _nicknameController,
                autofocus: true,
                maxLength: 16,
                textCapitalization: TextCapitalization.words,
                onSubmitted: (_) => _saveName(),
                decoration: const InputDecoration(
                  hintText: 'Your name',
                  counterText: '',
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'This sticks with your trophies from now on — you only pick it once.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(onPressed: _saveName, child: const Text("LET'S GO")),
              if (_error != null) ...[
                const SizedBox(height: 16),
                _ErrorBox(message: _error!),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMenu(Identity identity) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              _ProfileBar(
                identity: identity,
                profile: _profile,
                onTapName: _promptRename,
                onTapTrophies: _openLeaderboard,
              ),
              const SizedBox(height: 18),
              const Text(
                'BAD MENTAL CANVAS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  color: GameColors.primary,
                ),
              ),
              if (_doodle != null) ...[
                const SizedBox(height: 14),
                DoodleStage(
                  doodle: _doodle,
                  onNext: widget.connection.requestDoodle,
                  maxCanvasSize: 200,
                  compact: true,
                ),
              ],
              const SizedBox(height: 20),
              _ModeCard(
                title: 'RANKED',
                subtitle:
                    'Matched with up to 4 strangers. Invest fake money, '
                    'climb the leaderboard.',
                badge: '🏆 TROPHIES',
                accent: GameColors.primary,
                filled: true,
                onPressed: _busy ? null : _playRanked,
              ),
              const SizedBox(height: 12),
              _ModeCard(
                title: 'PLAY WITH FRIENDS',
                subtitle:
                    'Private room, add bots to fill it, vote 1st / 2nd / 3rd. '
                    'Nothing counts.',
                badge: 'JUST FOR FUN',
                accent: GameColors.lime,
                filled: false,
                onPressed: _busy ? null : () => _friendly(),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeController,
                      maxLength: 4,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        hintText: 'Room code',
                        counterText: '',
                        prefixIcon: Icon(
                          Icons.tag_rounded,
                          color: GameColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Explicit width: a Row lays non-flex children out with an
                  // unbounded main axis, and the button's theme wants to fill
                  // whatever it's given.
                  SizedBox(
                    width: 92,
                    height: 56,
                    child: OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () {
                              final code = _codeController.text.trim();
                              if (code.isEmpty) {
                                setState(() => _error = 'Enter the room code');
                                return;
                              }
                              _friendly(code: code);
                            },
                      child: const Text('JOIN'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: _openLeaderboard,
                icon: const Icon(Icons.leaderboard_rounded, size: 18),
                label: const Text('LEADERBOARD'),
              ),
              if (_busy) ...[
                const SizedBox(height: 20),
                const Center(
                  child: CircularProgressIndicator(color: GameColors.primary),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                _ErrorBox(message: _error!),
              ],
              const SizedBox(height: 18),
              _ServerSettings(
                controller: _addressController,
                shown: _showAdvanced,
                discovering: _discovering,
                discovered: _discovered,
                onToggle: () => setState(() => _showAdvanced = !_showAdvanced),
                onChanged: () => setState(() {
                  _discovered = false;
                  _connected = false;
                }),
                onSearch: _autoDiscover,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _promptRename() async {
    _nicknameController.text = _identity?.nickname ?? '';
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: GameColors.surfaceHigh,
        title: const Text('Change your name'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nicknameController,
              autofocus: true,
              maxLength: 16,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(counterText: ''),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your trophies and rank stay with you — only the name changes.',
              style: TextStyle(color: GameColors.textMuted, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (saved == true) {
      await _saveName();
      if (_connected) {
        widget.connection.setNickname(_nicknameController.text.trim());
      }
    }
  }
}

class _ProfileBar extends StatelessWidget {
  const _ProfileBar({
    required this.identity,
    required this.profile,
    required this.onTapName,
    required this.onTapTrophies,
  });

  final Identity identity;
  final Profile? profile;
  final VoidCallback onTapName;
  final VoidCallback onTapTrophies;

  @override
  Widget build(BuildContext context) {
    final profile = this.profile;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: GameColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: GameColors.surfaceHigh, width: 2),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: GameColors.primary,
            child: Text(
              identity.nickname.characters.first.toUpperCase(),
              style: const TextStyle(
                color: Color(0xFF16123A),
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: onTapName,
              behavior: HitTestBehavior.opaque,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          identity.nickname,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.edit_rounded,
                        size: 13,
                        color: GameColors.textMuted,
                      ),
                    ],
                  ),
                  Text(
                    profile == null
                        ? 'Connecting…'
                        : profile.rank == null
                        ? 'Unranked — play a ranked game'
                        : 'Rank #${profile.rank} · ${profile.games} game'
                              '${profile.games == 1 ? '' : 's'}',
                    style: const TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
          GestureDetector(
            onTap: onTapTrophies,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(
                '🏆 ${profile?.trophies ?? 0}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeCard extends StatefulWidget {
  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.accent,
    required this.filled,
    required this.onPressed,
  });

  final String title;
  final String subtitle;
  final String badge;
  final Color accent;
  final bool filled;
  final VoidCallback? onPressed;

  @override
  State<_ModeCard> createState() => _ModeCardState();
}

class _ModeCardState extends State<_ModeCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final title = widget.title;
    final subtitle = widget.subtitle;
    final badge = widget.badge;
    final accent = widget.accent;
    final filled = widget.filled;
    final onPressed = widget.onPressed;

    return GestureDetector(
      onTap: onPressed,
      onTapDown: onPressed == null ? null : (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      child: AnimatedScale(
        // A physical nudge on press — these are the two biggest buttons in
        // the app and they should feel like buttons.
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 110),
        child: Opacity(
          opacity: onPressed == null ? 0.5 : 1,
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
            decoration: BoxDecoration(
              color: filled ? accent : GameColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: accent, width: 2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.2,
                          color: filled ? const Color(0xFF241800) : accent,
                        ),
                      ),
                    ),
                    Text(
                      badge,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: filled
                            ? const Color(0xFF241800)
                            : GameColors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: filled
                        ? const Color(0xFF241800).withValues(alpha: 0.75)
                        : GameColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
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
              message,
              style: const TextStyle(color: Color(0xFFFF6B6B)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServerSettings extends StatelessWidget {
  const _ServerSettings({
    required this.controller,
    required this.shown,
    required this.discovering,
    required this.discovered,
    required this.onToggle,
    required this.onChanged,
    required this.onSearch,
  });

  final TextEditingController controller;
  final bool shown;
  final bool discovering;
  final bool discovered;
  final VoidCallback onToggle;
  final VoidCallback onChanged;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: onToggle,
              child: Text(
                shown ? 'Hide server settings' : 'Server settings',
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 13,
                ),
              ),
            ),
            if (discovering)
              const Padding(
                padding: EdgeInsets.only(left: 4),
                child: SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: GameColors.textMuted,
                  ),
                ),
              )
            else if (discovered)
              const Padding(
                padding: EdgeInsets.only(left: 2),
                child: Icon(
                  Icons.wifi_tethering_rounded,
                  size: 16,
                  color: GameColors.lime,
                ),
              ),
          ],
        ),
        if (shown)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: controller,
                onChanged: (_) => onChanged(),
                decoration: InputDecoration(
                  labelText: 'Server address (host:port)',
                  hintText: 'e.g. 192.168.1.42:8090',
                  suffixIcon: IconButton(
                    onPressed: discovering ? null : onSearch,
                    icon: const Icon(Icons.wifi_find_rounded),
                    tooltip: 'Search this Wi-Fi network',
                    color: GameColors.textMuted,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                discovered
                    ? 'Found automatically on this Wi-Fi network.'
                    : "Whoever's hosting runs start-server.sh on their computer — it "
                          'prints this address. Saved automatically once it connects.',
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
      ],
    );
  }
}
