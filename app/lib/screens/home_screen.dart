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
import '../widgets/logo.dart';
import 'game_screen.dart';
import 'leaderboard_screen.dart';
import 'queue_screen.dart';
import 'title_screen.dart';

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

  /// The title screen is up until boot finishes *and* it has been on screen
  /// long enough to read. Without the floor it flashes past on a fast start.
  static const _minTitleTime = Duration(milliseconds: 2200);
  bool _bootDone = false;
  bool _titleTimeUp = false;
  String _bootStatus = 'LOADING';

  bool get _booting => !_bootDone || !_titleTimeUp;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
    _boot();
  }

  /// Load the account, find a server, sign in, start the idle canvas. The
  /// title screen is showing throughout, which is the point — this is real
  /// work, not a splash timer.
  Future<void> _boot() async {
    Future.delayed(_minTitleTime, () {
      if (mounted) setState(() => _titleTimeUp = true);
    });

    final identity = await loadIdentity();
    if (!mounted) return;
    setState(() {
      _identity = identity;
      _nicknameController.text = identity.nickname;
      _bootStatus = 'FINDING A SERVER';
    });
    await _loadSavedAddress();
    await _autoDiscover();
    // The menu opens as soon as we know who you are and where the server
    // probably is. Connecting continues behind it — waiting on an 8-second
    // socket timeout would strand anyone whose server isn't running.
    if (!mounted) return;
    setState(() {
      _bootDone = true;
      _bootStatus = 'CONNECTING';
    });
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
    // Hard ceiling on top of the lookup's own timeout: multicast can hang
    // outright on some networks, and startup waits on this — a stuck lookup
    // must not mean a title screen that never goes away.
    final found = await discoverServer().timeout(
      const Duration(seconds: 5),
      onTimeout: () => null,
    );
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

  /// Create-or-join, kept off the menu so the front page stays two buttons.
  Future<void> _openFriendsSheet() async {
    _codeController.clear();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _FriendsSheet(
        codeController: _codeController,
        onCreate: () {
          Navigator.of(sheetContext).pop();
          _friendly();
        },
        onJoin: (code) {
          Navigator.of(sheetContext).pop();
          _friendly(code: code);
        },
      ),
    );
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
    if (identity == null || _booting) {
      return TitleScreen(status: _bootStatus);
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
              const SizedBox(height: 44),
              const Center(child: GrandCanvasLogo(size: 116)),
              const SizedBox(height: 18),
              const GrandCanvasWordmark(scale: 0.8),
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
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  GrandCanvasLogo(size: 46),
                  SizedBox(width: 12),
                  GrandCanvasWordmark(scale: 0.62),
                ],
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
              // Side by side: the front page shouldn't be a stack of full
              // width slabs, and the friends flow moves into a sheet so its
              // two extra controls aren't on the menu at all.
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _ModeCard(
                        title: 'QUICK\nMATCH',
                        subtitle: 'Play strangers.\nClimb the board.',
                        badge: '🏆',
                        accent: GameColors.primary,
                        filled: true,
                        onPressed: _busy ? null : _playRanked,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ModeCard(
                        title: 'PLAY WITH\nFRIENDS',
                        subtitle: 'Private room.\nJust for fun.',
                        badge: '👥',
                        accent: GameColors.lime,
                        filled: false,
                        onPressed: _busy ? null : _openFriendsSheet,
                      ),
                    ),
                  ],
                ),
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
      decoration: GameDecor.panel(radius: 18),
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
                        ? 'Unranked — play a quick match'
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
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              // Same treatment as the themed buttons: lit from above, crisp
              // lip, coloured halo.
              gradient: filled
                  ? const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        GameColors.primaryBright,
                        GameColors.primaryDeep,
                      ],
                    )
                  : const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFF221B52), Color(0xFF171240)],
                    ),
              border: Border.all(
                color: filled
                    ? GameColors.primaryBright
                    : accent.withValues(alpha: 0.7),
                width: filled ? 1.2 : 1.8,
              ),
              boxShadow: GameDecor.glow(accent, strength: _down ? 0.5 : 1),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Stack(
                children: [
                  // The shine.
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: filled ? 0.3 : 0.08),
                            Colors.white.withValues(alpha: 0),
                          ],
                          stops: const [0, 0.55],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(badge, style: const TextStyle(fontSize: 20)),
                        const SizedBox(height: 8),
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.15,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                            color: filled ? GameColors.onPrimary : accent,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          subtitle,
                          style: TextStyle(
                            fontSize: 11.5,
                            height: 1.3,
                            color: filled
                                ? GameColors.onPrimary.withValues(alpha: 0.72)
                                : GameColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
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

/// Create a private room, or join one by code. Lives in a sheet so the menu
/// itself stays down to two buttons.
class _FriendsSheet extends StatefulWidget {
  const _FriendsSheet({
    required this.codeController,
    required this.onCreate,
    required this.onJoin,
  });

  final TextEditingController codeController;
  final VoidCallback onCreate;
  final void Function(String code) onJoin;

  @override
  State<_FriendsSheet> createState() => _FriendsSheetState();
}

class _FriendsSheetState extends State<_FriendsSheet> {
  String? _error;

  void _join() {
    final code = widget.codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Enter the room code');
      return;
    }
    widget.onJoin(code);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 26),
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF221B52), GameColors.surface],
          ),
          border: Border.all(
            color: GameColors.lime.withValues(alpha: 0.5),
            width: 1.6,
          ),
          boxShadow: GameDecor.glow(GameColors.lime, strength: 0.7),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GameColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'PLAY WITH FRIENDS',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.6,
                color: GameColors.lime,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Nothing here counts towards the leaderboard.',
              textAlign: TextAlign.center,
              style: TextStyle(color: GameColors.textMuted, fontSize: 12.5),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: widget.onCreate,
              icon: const Icon(Icons.add_rounded, size: 20),
              label: const Text('CREATE A ROOM'),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Expanded(child: Divider(color: GameColors.border)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'OR JOIN ONE',
                    style: TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 10,
                      letterSpacing: 2,
                    ),
                  ),
                ),
                const Expanded(child: Divider(color: GameColors.border)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.codeController,
                    maxLength: 4,
                    autofocus: true,
                    textCapitalization: TextCapitalization.characters,
                    onSubmitted: (_) => _join(),
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
                // unbounded main axis, and the button fills what it's given.
                SizedBox(
                  width: 92,
                  height: 56,
                  child: OutlinedButton(
                    onPressed: _join,
                    child: const Text('JOIN'),
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFFF6B6B),
                  fontSize: 12.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
