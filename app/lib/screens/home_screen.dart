import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../services/game_connection.dart';
import '../services/google_account.dart';
import '../services/entitlements.dart';
import '../services/identity.dart';
import '../services/server_discovery.dart';
import '../theme.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/doodle_stage.dart';
import '../widgets/ad_banner.dart';
import '../widgets/friends_sheet.dart';
import '../widgets/logo.dart';
import '../widgets/pass_button.dart';
import '../widgets/thanks_sheet.dart';
import '../services/audio_service.dart';
import 'game_screen.dart';
import '../services/daily_reminder.dart';
import 'daily_screen.dart';
import 'hall_of_fame_screen.dart';
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

/// Which build-time default the saved address was saved under. A build that
/// points at a new server (the first public one, say) must win over an
/// address remembered from Wi-Fi play with an older build, or every phone
/// that ever played on a LAN keeps dialling a laptop that's no longer there
/// and reports "no connection". The saved address survives only while the
/// build's own default is unchanged.
const _addressDefaultPrefsKey = 'server_address_default';

/// A public build is one whose default isn't the developer's localhost.
const _publicBuild = _defaultServer != 'localhost:8090';

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

  /// The thank-you is owed but can't be shown yet — the player is mid-game
  /// or in the queue. Held until they're back on the menu: landing it over
  /// the final scores would bury it under the thing they actually came for.
  bool _thanksWaiting = false;

  /// The friendly-lobby request in flight, kept so it can be retried once if
  /// the server thinks we're still seated somewhere. Null when idle; the
  /// string is the join code, or empty for "create".
  String? _pendingFriendly;
  bool _retriedFriendly = false;

  /// Visibility chosen for the room being created, so a retry recreates the
  /// room the player actually asked for rather than a listed one.
  bool _pendingPublic = true;

  /// Whether this profile is backed by a Google account, and whether the
  /// server can do that at all. Both come from the server, because only the
  /// server knows — the app never decides who it is.
  bool _linked = false;
  bool _googleAvailable = false;
  bool _linking = false;

  /// The title screen is up until boot finishes *and* it has been on screen
  /// long enough to read. Without the floor it flashes past on a fast start.
  static const _minTitleTime = Duration(milliseconds: 2200);
  bool _bootDone = false;
  bool _titleTimeUp = false;
  String _bootStatus = 'LOADING';

  bool get _booting => !_bootDone || !_titleTimeUp;

  /// How long the launch sting gets to play essentially alone before the
  /// title loop starts fading in underneath it.
  ///
  /// Both state the same four-note motif, so starting them together at t=0
  /// was two performances of the same phrase landing on top of each other —
  /// audibly a mess, not a layering. The sting's plucked notes finish around
  /// 850ms and its held landing chord starts there and rings on; bringing the
  /// loop in as that chord is sounding turns it into a handoff instead of a
  /// collision, since both are written in the same key.
  static const _titleMusicDelay = Duration(milliseconds: 900);
  bool _titleMusicReady = false;

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
    // The signature, over the logo drawing itself. Fired here rather than
    // from build so it happens exactly once per launch.
    AudioService.instance.sfx(Sfx.launch);
    Future.delayed(_titleMusicDelay, () {
      if (mounted) setState(() => _titleMusicReady = true);
    });

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
    // Wi-Fi discovery is for playing against a laptop on the same network.
    // A public build has a real server to talk to, and a stray dev server
    // on the office Wi-Fi must not hijack it.
    if (!_publicBuild) await _autoDiscover();
    // The menu opens as soon as we know who you are and where the server
    // probably is. Connecting continues behind it — waiting on an 8-second
    // socket timeout would strand anyone whose server isn't running.
    if (!mounted) return;
    setState(() {
      _bootDone = true;
      _bootStatus = 'CONNECTING';
    });
    await _ensureConnected(silent: true);

    // Tapping the morning reminder should land on the prompt it announced,
    // not on the menu with the prompt one tap further away.
    DailyReminder.instance.onTapped = () {
      if (mounted && !_inGame && !_queued) _openDaily();
    };
    if (DailyReminder.instance.launchedFromReminder) {
      DailyReminder.instance.launchedFromReminder = false;
      if (mounted && _identity?.hasNickname == true) _openDaily();
    }
  }

  Future<void> _loadSavedAddress() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_addressPrefsKey);
    if (saved == null || !mounted) return;
    final savedUnder = prefs.getString(_addressDefaultPrefsKey);
    if (savedUnder != _defaultServer) {
      // Saved by a build with a different default: this build knows better.
      await prefs.remove(_addressPrefsKey);
      await prefs.remove(_addressDefaultPrefsKey);
      return;
    }
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
      // Refresh the fortnight of reminders on every connection, so a phone
      // opened once a week never runs dry.
      if (DailyReminder.instance.enabled) widget.connection.dailyUpcoming();
    }
    unawaited(
      SharedPreferences.getInstance().then((prefs) async {
        await prefs.setString(_addressPrefsKey, _addressController.text.trim());
        await prefs.setString(_addressDefaultPrefsKey, _defaultServer);
      }),
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
      case FriendInvitedEvent(:final from, :final code):
        if (_inGame || _queued) break;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 12),
            content: Text('${from.nickname} invited you to their room'),
            action: SnackBarAction(
              label: 'JOIN',
              onPressed: () => _friendly(code: code),
            ),
          ),
        );
      case FriendRequestReceivedEvent(:final from):
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 10),
            content: Text('${from.nickname} wants to be friends'),
            action: SnackBarAction(
              label: 'ACCEPT',
              onPressed: () => widget.connection.acceptFriend(from.id),
            ),
          ),
        );
      case FriendAcceptedEvent(:final by):
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${by.nickname} accepted. You\'re friends now.'),
          ),
        );
      case AccountEvent(:final playerId, :final linked, :final googleAvailable):
        // The id can change: linking an account that already had a profile
        // moves us onto it. Persist it, or the next launch signs in as the
        // old device account and the trophies appear to vanish.
        if (_identity != null && playerId != _identity!.playerId) {
          savePlayerId(playerId);
          _identity = Identity(
            playerId: playerId,
            nickname: _identity!.nickname,
          );
        }
        setState(() {
          _linked = linked;
          _googleAvailable = googleAvailable;
          _linking = false;
        });
      case ProfileEvent(:final profile):
        setState(() => _profile = profile);
        if (profile.thanksDue) _offerThanks();
      case DailyUpcomingEvent(:final days):
        DailyReminder.instance.schedule(days);
      case DoodleEvent():
        setState(() => _doodle = event);
      case LobbyStateEvent(:final lobby):
        // Both paths land here: matchmaking dropping us into a ranked game,
        // and creating or joining a friendly one. Ignore updates for a game
        // we're already inside — those belong to GameScreen.
        if (_inGame) return;
        _openGame(lobby);
      case ErrorEvent(:final message):
        // We are demonstrably not in a game — this screen is on top — so a
        // "you're already in one" reply means the server's idea of us is
        // stale. Stand up from the ghost seat and try the request again once.
        // Older builds could strand a player this way permanently, since the
        // back gesture never sent leave_lobby.
        final stale = message.toLowerCase().contains('already in a');
        if (stale && _pendingFriendly != null && !_retriedFriendly) {
          final code = _pendingFriendly!;
          _retriedFriendly = true;
          widget.connection.leaveLobby();
          if (code.isEmpty) {
            widget.connection.createLobby(isPublic: _pendingPublic);
          } else {
            widget.connection.joinLobby(code);
          }
          return;
        }
        _pendingFriendly = null;
        setState(() {
          _busy = false;
          _queued = false;
          _linking = false;
          _error = message;
        });
      case WelcomeEvent():
        // The server said hello back. Usually _ensureConnected already knows,
        // but a reconnect made from inside a game bypasses it, and without
        // this the menu would still believe the connection was down.
        if (!_connected) setState(() => _connected = true);
      case DisconnectedEvent():
        final wasQueued = _queued;
        setState(() {
          _busy = false;
          _connected = false;
          _doodle = null;
        });
        // A drop while waiting for a match used to put the menu back with
        // no word about why -- and the server had already taken us out of
        // the queue. Get back in on the player's behalf; only give up and
        // say so if the network is really gone.
        if (wasQueued) _requeue();
      default:
        break;
    }
  }

  /// Gives the thank-you: a day of everything, for having played a few
  /// games. Held back until the menu is on top, then granted before it is
  /// shown so the reward is real whatever the player does with the sheet.
  ///
  /// The server is told once the sheet has been seen, which is what stops it
  /// being offered again — on this phone or, for a Google-linked account, on
  /// any other. Nothing here is conditional on rating anything; see
  /// [showThanksSheet] for why that matters.
  Future<void> _offerThanks() async {
    if (_inGame || _queued) {
      _thanksWaiting = true;
      return;
    }
    _thanksWaiting = false;
    // Marked before the sheet opens: if the app is killed mid-sheet the
    // player keeps the pass and is not pestered again, which is the right
    // way round to fail.
    widget.connection.thanksSeen();
    await Entitlements.instance.grantThanksPass();
    if (!mounted) return;
    await showThanksSheet(context);
  }

  void _openGame(LobbyState lobby) {
    _pendingFriendly = null;
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
          if (_thanksWaiting) _offerThanks();
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

  /// Back into the ranked queue after the socket dropped. The wait starts
  /// over on the server -- it can't know this is the same wait -- but the
  /// screen never leaves, which is the thing that was wrong.
  Future<void> _requeue() async {
    const delays = [1, 2, 3, 5, 8];
    for (final seconds in delays) {
      await Future<void>.delayed(Duration(seconds: seconds));
      if (!mounted || !_queued) return;
      if (_connected) return; // something else reconnected us meanwhile
      if (await widget.connection.reconnect()) {
        if (!mounted || !_queued) return;
        setState(() => _connected = true);
        widget.connection.findMatch();
        return;
      }
    }
    if (!mounted || !_queued) return;
    setState(() {
      _queued = false;
      _error = "Lost the connection while finding a match — try again";
    });
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

  Future<void> _friendly({String? code, bool isPublic = true}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    if (!await _ensureConnected()) {
      setState(() => _busy = false);
      return;
    }
    _pendingFriendly = code ?? '';
    _pendingPublic = isPublic;
    _retriedFriendly = false;
    if (code == null) {
      widget.connection.createLobby(isPublic: isPublic);
    } else {
      widget.connection.joinLobby(code);
    }
  }

  /// Signs in with Google and hands the token to the server to verify.
  ///
  /// Everything that can go wrong here — no Play Services, no internet, the
  /// player changing their mind at the account picker — ends quietly back
  /// where we started, still signed in as a device account.
  Future<void> _linkGoogle() async {
    if (!await _ensureConnected()) return;
    setState(() {
      _linking = true;
      _error = null;
    });
    final token = await GoogleAccount.instance.signIn();
    if (!mounted) return;
    if (token == null) {
      setState(() => _linking = false);
      return;
    }
    // The server replies with `account`, which clears _linking.
    widget.connection.linkGoogle(token);
  }

  Future<void> _unlinkGoogle() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out of Google?'),
        content: const Text(
          'Your trophies stay on this device, but they will no longer follow '
          'you to another phone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('CANCEL'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('SIGN OUT'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await GoogleAccount.instance.signOut();
    widget.connection.unlinkGoogle();
  }

  /// Create-or-join, kept off the menu so the front page stays two buttons.
  Future<void> _openFriendsSheet() async {
    _codeController.clear();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _FriendsSheet(
        connection: widget.connection,
        codeController: _codeController,
        onCreate: ({required bool isPublic}) {
          Navigator.of(sheetContext).pop();
          _friendly(isPublic: isPublic);
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

  Future<void> _openHall() async {
    if (!await _ensureConnected()) return;
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HallOfFameScreen(connection: widget.connection),
      ),
    );
    if (mounted && _connected) widget.connection.requestDoodle();
  }

  Future<void> _openDaily() async {
    if (!await _ensureConnected()) return;
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DailyScreen(
          connection: widget.connection,
          myId: _identity!.playerId,
        ),
      ),
    );
    if (mounted && _connected) widget.connection.requestDoodle();
  }

  @override
  Widget build(BuildContext context) {
    // Title music while booting, then the main theme on the menu. `play`
    // ignores a request for whatever is already playing, so calling it
    // from build costs nothing on a rebuild. While booting, the title loop
    // waits for _titleMusicReady rather than starting alongside the launch
    // sting — see its doc comment.
    if (!_inGame && !_queued) {
      if (!_booting) {
        AudioService.instance.play(Music.menu);
      } else if (_titleMusicReady) {
        AudioService.instance.play(Music.title);
      }
    }
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
      bottomNavigationBar: const AdBanner(),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 10),
              // The pass first, top right, before the eye has anywhere else
              // to go. It's the one thing in the game that makes money.
              Row(
                children: const [
                  GrandCanvasLogo(size: 40),
                  SizedBox(width: 10),
                  // Shrinks before the pass button ever has to.
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: GrandCanvasWordmark(scale: 0.52),
                      ),
                    ),
                  ),
                  SizedBox(width: 10),
                  PassButton(),
                ],
              ),
              const SizedBox(height: 12),
              _ProfileBar(
                identity: identity,
                profile: _profile,
                onTapName: _promptRename,
                onTapTrophies: _openLeaderboard,
              ),
              // Google, right under your name where it can't be missed. The
              // build has a client id; if the server doesn't yet, the button
              // still shows and the tap explains, rather than the feature
              // silently not existing.
              if (GoogleAccount.configured) ...[
                const SizedBox(height: 8),
                _GoogleRow(
                  linked: _linked,
                  serverReady: _googleAvailable,
                  busy: _linking,
                  onLink: _linkGoogle,
                  onUnlink: _unlinkGoogle,
                ),
              ],
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
                        badge: const SketchIcon(
                          SketchGlyph.trophy,
                          size: 22,
                          color: GameColors.onPrimary,
                        ),
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
                        badge: const Text('👥', style: TextStyle(fontSize: 20)),
                        accent: GameColors.lime,
                        filled: false,
                        onPressed: _busy ? null : _openFriendsSheet,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              // The one mode with no competition in it, so it sits under the
              // two that have, and in the calmer colour.
              _ModeCard(
                title: 'THE DAILY',
                subtitle:
                    'One prompt for the whole world. No clock, everything unlocked.',
                badge: const SketchIcon(
                  SketchGlyph.pencil,
                  size: 22,
                  color: GameColors.cyan,
                ),
                accent: GameColors.cyan,
                filled: false,
                onPressed: _busy ? null : _openDaily,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _openLeaderboard,
                      icon: const Icon(Icons.leaderboard_rounded, size: 18),
                      label: const FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text('LEADERBOARD', maxLines: 1),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _openHall,
                      icon: const SketchIcon(
                        SketchGlyph.trophy,
                        size: 16,
                        color: GameColors.primary,
                      ),
                      label: const FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text('HALL OF FAME', maxLines: 1),
                      ),
                    ),
                  ),
                ],
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
                linked: _linked,
                googleAvailable: _googleAvailable,
                linking: _linking,
                onLink: _linkGoogle,
                onUnlink: _unlinkGoogle,
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
          SketchFrame(
            radius: 20,
            child: CircleAvatar(
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
                      const SketchIcon(
                        SketchGlyph.pencil,
                        size: 13,
                        color: GameColors.textMuted,
                      ),
                    ],
                  ),
                  Text(
                    profile == null
                        ? 'Connecting…'
                        // While placing, count down the games left rather than
                        // saying "Unranked" — it reads as progress, not as a
                        // locked door.
                        : profile.isPlacing
                        ? '${profile.league.name} · ${profile.placementsLeft} placement'
                              '${profile.placementsLeft == 1 ? '' : 's'} to go'
                        : '${profile.league.name} · ${profile.rating}'
                              '${profile.rank == null ? '' : ' · #${profile.rank}'}',
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SketchIcon(
                    SketchGlyph.trophy,
                    size: 15,
                    color: GameColors.primary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${profile?.trophies ?? 0}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
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
  final Widget badge;
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
                        badge,
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
    required this.linked,
    required this.googleAvailable,
    required this.linking,
    required this.onLink,
    required this.onUnlink,
  });

  final TextEditingController controller;
  final bool shown;
  final bool discovering;
  final bool discovered;
  final VoidCallback onToggle;
  final VoidCallback onChanged;
  final VoidCallback onSearch;

  /// Account state, all decided by the server.
  final bool linked;
  final bool googleAvailable;
  final bool linking;
  final VoidCallback onLink;
  final VoidCallback onUnlink;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Sound sits next to the server settings rather than behind a menu:
        // a music toggle nobody can find is the same as no toggle at all.
        ListenableBuilder(
          listenable: AudioService.instance,
          builder: (context, _) {
            final audio = AudioService.instance;
            if (audio.unavailable) return const SizedBox.shrink();
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _AudioToggle(
                  label: audio.musicOn ? 'Music on' : 'Music off',
                  on: audio.musicOn,
                  onTap: () => audio.setMusicOn(!audio.musicOn),
                ),
                const SizedBox(width: 6),
                _AudioToggle(
                  label: audio.sfxOn ? 'Sounds on' : 'Sounds off',
                  on: audio.sfxOn,
                  onTap: () => audio.setSfxOn(!audio.sfxOn),
                ),
              ],
            );
          },
        ),
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
    required this.connection,
    required this.codeController,
    required this.onCreate,
    required this.onJoin,
  });

  final GameConnection connection;
  final TextEditingController codeController;
  final void Function({required bool isPublic}) onCreate;
  final void Function(String code) onJoin;

  @override
  State<_FriendsSheet> createState() => _FriendsSheetState();
}

class _FriendsSheetState extends State<_FriendsSheet> {
  String? _error;

  /// Open games on this server, pushed by the server as they change.
  ///
  /// Null while the first list is still in flight, which is what separates
  /// "nobody has a game open" from "we haven't heard back yet" — showing
  /// "no games" during the round trip makes an empty server look broken.
  List<OpenLobby>? _open;
  StreamSubscription<GameEvent>? _sub;

  /// Whether a room created from here is listed for strangers. On by default:
  /// an unlisted room is the thing the browser exists to fix.
  bool _createPublic = true;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen((event) {
      if (!mounted) return;
      if (event is LobbyListEvent) setState(() => _open = event.lobbies);
    });
    widget.connection.listLobbies();
  }

  @override
  void dispose() {
    _sub?.cancel();
    // Stop the server pushing updates to a sheet that has closed.
    widget.connection.stopBrowsing();
    super.dispose();
  }

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
            const SizedBox(height: 18),

            // --- your friends -------------------------------------------
            _SheetDivider(label: 'FRIENDS'),
            const SizedBox(height: 6),
            FriendsList(
              connection: widget.connection,
              compact: true,
              onJoin: widget.onJoin,
            ),
            const SizedBox(height: 18),

            // --- open games on this server -------------------------------
            _SheetDivider(
              label: _open == null || _open!.isEmpty
                  ? 'OPEN GAMES'
                  : 'OPEN GAMES  ·  ${_open!.length}',
            ),
            const SizedBox(height: 10),
            _LobbyBrowser(lobbies: _open, onJoin: widget.onJoin),
            const SizedBox(height: 18),

            _SheetDivider(label: 'OR START YOUR OWN'),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => widget.onCreate(isPublic: _createPublic),
              icon: const SketchIcon(SketchGlyph.plus, size: 18),
              label: const Text('CREATE A ROOM'),
            ),
            const SizedBox(height: 10),
            // A room is listed by default; this is how you opt out of that
            // without losing the code-sharing route.
            _VisibilityChoice(
              isPublic: _createPublic,
              onChanged: (v) => setState(() => _createPublic = v),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Expanded(child: Divider(color: GameColors.border)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'OR JOIN BY CODE',
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

/// A labelled rule, used to break the friends sheet into its three routes in:
/// pick a game, start one, or type a code.
class _SheetDivider extends StatelessWidget {
  const _SheetDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: GameColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: const TextStyle(
              color: GameColors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
            ),
          ),
        ),
        const Expanded(child: Divider(color: GameColors.border)),
      ],
    );
  }
}

/// The list of games you can walk into without being given a code.
///
/// Height is capped rather than left to grow: this sits in a bottom sheet
/// above a keyboard, and a long list would otherwise push the code field off
/// the screen entirely.
class _LobbyBrowser extends StatelessWidget {
  const _LobbyBrowser({required this.lobbies, required this.onJoin});

  /// Null means the first list has not arrived yet.
  final List<OpenLobby>? lobbies;
  final void Function(String code) onJoin;

  @override
  Widget build(BuildContext context) {
    final list = lobbies;
    if (list == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 18),
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (list.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
        decoration: BoxDecoration(
          color: GameColors.surfaceHigh.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: GameColors.border),
        ),
        child: const Column(
          children: [
            Text(
              'No open games right now',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            SizedBox(height: 4),
            Text(
              'Start one below and it will show up here for everyone else.',
              textAlign: TextAlign.center,
              style: TextStyle(color: GameColors.textMuted, fontSize: 11.5),
            ),
          ],
        ),
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 208),
      child: ListView.separated(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) =>
            _LobbyRow(lobby: list[i], onJoin: () => onJoin(list[i].code)),
      ),
    );
  }
}

class _LobbyRow extends StatelessWidget {
  const _LobbyRow({required this.lobby, required this.onJoin});

  final OpenLobby lobby;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onJoin,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: GameColors.surfaceHigh.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: GameColors.lime.withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${lobby.hostName}\u2019s room',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      // Bots are called out, because "4/5 players" reads very
                      // differently when three of them are bots.
                      lobby.bots > 0
                          ? '${lobby.humans} playing \u00b7 ${lobby.bots} bots \u00b7 ${lobby.freeSeats} free'
                          : '${lobby.humans} playing \u00b7 ${lobby.freeSeats} free',
                      style: const TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: GameColors.lime.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: GameColors.lime.withValues(alpha: 0.5),
                  ),
                ),
                child: const Text(
                  'JOIN',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                    color: GameColors.lime,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Listed-or-not for a room you are about to create. Written as two labelled
/// options rather than a switch, because "public" alone does not tell anyone
/// what it actually does.
class _VisibilityChoice extends StatelessWidget {
  const _VisibilityChoice({required this.isPublic, required this.onChanged});

  final bool isPublic;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _VisibilityOption(
            label: 'ANYONE CAN FIND IT',
            selected: isPublic,
            onTap: () => onChanged(true),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _VisibilityOption(
            label: 'CODE ONLY',
            selected: !isPublic,
            onTap: () => onChanged(false),
          ),
        ),
      ],
    );
  }
}

class _VisibilityOption extends StatelessWidget {
  const _VisibilityOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: selected
                ? GameColors.primary.withValues(alpha: 0.14)
                : Colors.transparent,
            border: Border.all(
              color: selected
                  ? GameColors.primary.withValues(alpha: 0.55)
                  : GameColors.border,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 0.6,
              fontWeight: FontWeight.w800,
              color: selected ? GameColors.primary : GameColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}

/// Sign in with Google, or sign out again.
///
/// Google sign-in, framed as what it buys: trophies, rank and the pass
/// that follow you to any phone. A full-width row rather than a footnote,
/// because it's the one thing worth doing on the home screen after
/// picking a name.
class _GoogleRow extends StatelessWidget {
  const _GoogleRow({
    required this.linked,
    required this.serverReady,
    required this.busy,
    required this.onLink,
    required this.onUnlink,
  });

  final bool linked;
  final bool serverReady;
  final bool busy;
  final VoidCallback onLink;
  final VoidCallback onUnlink;

  @override
  Widget build(BuildContext context) {
    final Widget leading = Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: const Text(
        'G',
        style: TextStyle(
          color: Color(0xFF4285F4),
          fontSize: 18,
          fontWeight: FontWeight.w900,
          height: 1,
        ),
      ),
    );
    if (linked) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: GameDecor.panel(radius: 16, accent: GameColors.lime),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Signed in with Google. Your trophies and pass follow you to any phone.',
                style: TextStyle(fontSize: 12.5, height: 1.3),
              ),
            ),
            TextButton(
              onPressed: onUnlink,
              child: const Text('SIGN OUT', style: TextStyle(fontSize: 11)),
            ),
          ],
        ),
      );
    }
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: busy
            ? null
            : serverReady
            ? onLink
            : () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    "The server isn't set up for Google sign-in yet. "
                    'Try again in a bit.',
                  ),
                ),
              ),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: GameDecor.panel(radius: 16),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sign in with Google',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Keep your trophies, rank and pass on any phone',
                      style: TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                const Icon(
                  Icons.chevron_right_rounded,
                  color: GameColors.textMuted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A small pill that reads as on or off at a glance — colour and label both,
/// so it doesn't rely on noticing a subtle tint.
class _AudioToggle extends StatelessWidget {
  const _AudioToggle({
    required this.label,
    required this.on,
    required this.onTap,
  });

  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            color: on
                ? GameColors.primary.withValues(alpha: 0.12)
                : Colors.transparent,
            border: Border.all(
              color: on
                  ? GameColors.primary.withValues(alpha: 0.5)
                  : GameColors.border,
              width: 1.1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: on ? GameColors.primary : GameColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
