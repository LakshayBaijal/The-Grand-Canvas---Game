import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../views/draw_view.dart';
import '../views/lobby_view.dart';
import '../views/prompt_writing_view.dart';
import '../views/results_view.dart';
import '../views/reveal_view.dart';
import '../views/voting_view.dart';
import '../services/audio_service.dart';
import '../widgets/friends_sheet.dart';

enum GamePhase { lobby, promptWriting, drawing, voting, reveal, results }

/// Single screen for the whole game. Everything after joining a lobby is
/// driven by the server's phase messages, so there are no navigation races
/// between players whose phones advance at slightly different moments.
class GameScreen extends StatefulWidget {
  const GameScreen({
    super.key,
    required this.connection,
    required this.initialLobby,
    required this.myId,
  });

  final GameConnection connection;
  final LobbyState initialLobby;
  final String myId;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late LobbyState _lobby = widget.initialLobby;
  StreamSubscription<GameEvent>? _sub;

  GamePhase _phase = GamePhase.lobby;
  PromptWritingEvent? _promptWriting;
  RoundStartEvent? _round;
  VotingPhaseEvent? _voting;
  RoundRevealEvent? _reveal;
  FinalResultsEvent? _results;

  int _waitingSubmitted = 0;
  int _waitingTotal = 0;

  // --- getting back in after the connection drops ---------------------------
  // The server holds a dropped player's seat for a while (RECONNECT_GRACE_MS,
  // ninety seconds mid-game), so a drop is something to recover from, not
  // the end of the game. The retries below add up to just under that, so we
  // never give up while the seat is still there for the taking.
  bool _disconnected = false;
  bool _reconnectFailed = false;
  int _attempt = 0;
  Timer? _retryTimer;
  Timer? _resumeTimer;
  Timer? _settleTimer;
  static const _retryDelays = [1, 2, 3, 5, 8, 8, 8, 8, 8, 8, 8, 8, 10];

  /// Server refusals so far, handed to the prompt box so it can unlock.
  int _rejections = 0;

  /// The bot drawing replaying on the lobby's idle canvas.
  DoodleEvent? _doodle;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
    // A ranked match starts the instant matchmaking makes it, so its first
    // phase message can arrive before this screen has subscribed. Replay
    // whatever we missed rather than sitting on the lobby forever.
    final missed = widget.connection.lastPhaseEvent;
    if (missed != null) _applyPhase(missed);
    // Only phase *changes* sync the music, so without this the menu loop just
    // keeps playing until the first one happens — which is silence-shaped for
    // anyone who sits in a lobby, and wrong for a ranked match that drops
    // straight into a later phase.
    _syncMusic();
    widget.connection.requestDoodle();
  }

  /// Only ask for another while people are actually sitting in the lobby —
  /// once the game starts nobody's looking at the idle canvas.
  void _requestDoodle() {
    if (_phase == GamePhase.lobby) widget.connection.requestDoodle();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _retryTimer?.cancel();
    _resumeTimer?.cancel();
    _settleTimer?.cancel();
    super.dispose();
  }

  /// The cue for each phase. All of these are variations on the same
  /// four-note motif, so moving between them reads as one score following
  /// the player rather than six unrelated loops.
  Music get _musicForPhase => switch (_phase) {
    GamePhase.lobby => Music.lobby,
    GamePhase.promptWriting => Music.prompt,
    GamePhase.drawing => Music.drawing,
    GamePhase.voting => Music.voting,
    GamePhase.reveal => Music.reveal,
    GamePhase.results => Music.results,
  };

  /// Idempotent, so calling it after every phase change is free.
  void _syncMusic() => AudioService.instance.play(_musicForPhase);

  void _handleEvent(GameEvent event) {
    if (!mounted) return;
    if (_applyPhaseWithSetState(event)) return;
    switch (event) {
      case DoodleEvent():
        setState(() => _doodle = event);
      case WaitingUpdateEvent(:final submitted, :final total):
        setState(() {
          _waitingSubmitted = submitted;
          _waitingTotal = total;
        });
      case KickedEvent():
        // The server has already unseated us, so leaving the normal way
        // would send a `leave_lobby` for a lobby we're no longer in. Pop
        // straight out and say why, or the screen just vanishes.
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('The host removed you from the room.'),
          ),
        );
      case ErrorEvent(:final message):
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
        setState(() => _rejections++);
      case DisconnectedEvent():
        if (_disconnected) break; // already on it
        setState(() {
          _disconnected = true;
          _reconnectFailed = false;
          _attempt = 0;
        });
        _scheduleReconnect();
      default:
        break;
    }
  }

  void _scheduleReconnect() {
    _retryTimer?.cancel();
    if (_attempt >= _retryDelays.length) {
      // Longer than the server holds a seat: it's gone, and so is the game.
      setState(() => _reconnectFailed = true);
      return;
    }
    _retryTimer = Timer(Duration(seconds: _retryDelays[_attempt]), _tryReconnect);
  }

  Future<void> _tryReconnect() async {
    if (!mounted || !_disconnected) return;
    setState(() => _attempt++);
    final ok = await widget.connection.reconnect();
    if (!mounted || !_disconnected) return;
    if (!ok) {
      _scheduleReconnect();
      return;
    }
    // Connected and signed in. If our seat was held, `lobby_state` follows
    // straight away and _applyPhase brings us back; if it wasn't, nothing
    // follows at all -- so give it a moment before concluding that.
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 4), () {
      if (!mounted || !_disconnected) return;
      setState(() => _reconnectFailed = true);
    });
  }

  /// Back in the game: stop every timer the drop started.
  void _resumed() {
    _retryTimer?.cancel();
    _resumeTimer?.cancel();
    _settleTimer?.cancel();
    _disconnected = false;
    _reconnectFailed = false;
    _attempt = 0;
  }

  bool _applyPhaseWithSetState(GameEvent event) {
    var handled = false;
    final was = _phase;
    setState(() => handled = _applyPhase(event));
    if (handled && _phase != was) {
      _syncMusic();
      // A short flourish over the top of the new loop, so a phase change
      // is felt as well as seen.
      if (_phase == GamePhase.drawing) {
        AudioService.instance.sfx(Sfx.roundStart);
      }
    }
    return handled;
  }

  /// Moves the screen to whatever phase [event] describes. Kept separate from
  /// [_handleEvent] so initState can replay a missed message without calling
  /// setState before the first build.
  bool _applyPhase(GameEvent event) {
    if (_disconnected && event is! LobbyStateEvent) {
      // Any phase message while we're reconnecting is the game telling us
      // where it got to. Land there, and we're back.
      _resumed();
    }
    switch (event) {
      case LobbyStateEvent(:final lobby):
        _lobby = lobby;
        if (_disconnected) {
          // First thing back after a reconnect. On its own it means "you are
          // seated", not "the table is in the lobby": if the game is mid-phase
          // that phase follows a frame later and decides the screen. Only if
          // nothing follows is the lobby really where the game is -- so wait
          // a beat before acting, or a disconnect on the results screen would
          // flash through the lobby on its way back to the results.
          _settleTimer?.cancel();
          _settleTimer = Timer(const Duration(milliseconds: 600), () {
            if (!mounted || !_disconnected) return;
            setState(() {
              _resumed();
              if (_phase != GamePhase.lobby) {
                _phase = GamePhase.lobby;
                _resetRoundState();
                widget.connection.requestDoodle();
              }
            });
          });
          return true;
        }
        // A fresh lobby_state after a game means the host hit "play again".
        if (_phase == GamePhase.results) {
          _phase = GamePhase.lobby;
          _resetRoundState();
          widget.connection.requestDoodle();
        }
      case PromptWritingEvent():
        _phase = GamePhase.promptWriting;
        _promptWriting = event;
      case RoundStartEvent():
        _phase = GamePhase.drawing;
        _round = event;
        _waitingSubmitted = 0;
        _waitingTotal = _lobby.players.length;
      case VotingPhaseEvent():
        _phase = GamePhase.voting;
        _voting = event;
        _waitingSubmitted = 0;
        _waitingTotal = _lobby.players.length;
      case RoundRevealEvent():
        _phase = GamePhase.reveal;
        _reveal = event;
      case FinalResultsEvent():
        _phase = GamePhase.results;
        _results = event;
      default:
        return false;
    }
    return true;
  }

  /// Leaves the game properly, however the player got out.
  ///
  /// The system back gesture pops this route on its own, so without the
  /// [PopScope] in [build] the server never hears `leave_lobby` and goes on
  /// believing the player is still seated. Every later create-or-join is then
  /// rejected with "You're already in a lobby" and the only way out is to
  /// restart the app. Both the button and the gesture come through here.
  void _leave() {
    // On a dead socket there is nobody to tell, and the server's hold on our
    // seat will lapse on its own. On a live one, say so, or the seat sits
    // there for ninety seconds looking occupied.
    _retryTimer?.cancel();
    _resumeTimer?.cancel();
    _settleTimer?.cancel();
    // Keyed on the socket, not on _disconnected: a reconnect can have brought
    // the socket back (and the server can have re-seated us) while this
    // screen is still waiting to hear so. Leaving then without saying so
    // would strand a live seat, and the next broadcast to it would reopen
    // the game from the menu.
    if (widget.connection.isConnected) widget.connection.leaveLobby();
    Navigator.of(context).pop();
  }

  void _resetRoundState() {
    _promptWriting = null;
    _round = null;
    _voting = null;
    _reveal = null;
    _results = null;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Intercepted rather than allowed, so leaving always tells the server.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _leave();
      },
      child: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_disconnected) {
      final failed = _reconnectFailed;
      return Scaffold(
        appBar: AppBar(title: Text(failed ? 'Disconnected' : 'Reconnecting')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (failed)
                  const Icon(Icons.wifi_off, size: 56, color: GameColors.textMuted)
                else
                  const SizedBox(
                    width: 44,
                    height: 44,
                    child: CircularProgressIndicator(strokeWidth: 3.5),
                  ),
                const SizedBox(height: 20),
                Text(
                  failed
                      ? "Couldn't get back into the game"
                      : 'Lost the connection — getting you back in',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  failed
                      ? 'Your seat was held for a minute and a half, and the table has moved on.'
                      : 'Your seat is being held. This usually takes a few seconds.'
                            '${_attempt > 1 ? '  (try $_attempt)' : ''}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: GameColors.textMuted, fontSize: 13),
                ),
                const SizedBox(height: 24),
                if (failed)
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Back to menu'),
                  )
                else
                  TextButton(
                    onPressed: _leave,
                    child: const Text('Leave the game'),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    // Phases are whole screens swapping under the player, so cross-fade
    // rather than cutting. Keyed by phase so the switcher knows it changed.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      child: KeyedSubtree(key: ValueKey(_phase), child: _buildPhase(context)),
    );
  }

  Widget _buildPhase(BuildContext context) {
    return switch (_phase) {
      GamePhase.lobby => LobbyView(
        lobby: _lobby,
        myId: widget.myId,
        onStart: widget.connection.startGame,
        onAddBot: widget.connection.addBot,
        onRemoveBot: widget.connection.removeBot,
        doodle: _doodle,
        onNextDoodle: _requestDoodle,
        onAddFriend: widget.connection.requestFriend,
        onInviteFriends: () =>
            showInviteFriendsSheet(context, widget.connection),
        onSetVisibility: ({required bool isPublic}) =>
            widget.connection.setVisibility(isPublic: isPublic),
        onKickPlayer: widget.connection.kickPlayer,
      ),
      GamePhase.promptWriting => PromptWritingView(
        key: ValueKey('prompt-${_promptWriting!.roundIndex}'),
        event: _promptWriting!,
        onSubmit: widget.connection.submitPrompt,
        rejections: _rejections,
      ),
      GamePhase.drawing => DrawView(
        key: ValueKey('draw-${_round!.roundIndex}'),
        prompt: _round!.prompt,
        deadlineMs: _round!.deadlineMs,
        roundIndex: _round!.roundIndex,
        totalRounds: _round!.totalRounds,
        submitted: _waitingSubmitted,
        total: _waitingTotal,
        onSubmit: widget.connection.submitDrawing,
      ),
      GamePhase.voting => VotingView(
        key: ValueKey('vote-${_voting!.roundIndex}'),
        event: _voting!,
        myId: widget.myId,
        submitted: _waitingSubmitted,
        total: _waitingTotal,
        onInvest: widget.connection.submitInvestment,
        onRank: widget.connection.submitRanking,
      ),
      GamePhase.reveal => RevealView(
        event: _reveal!,
        myId: widget.myId,
        onReport: (artistId, title, reason) => widget.connection.reportDrawing(
          artistId: artistId,
          title: title,
          reason: reason,
        ),
        onAddFriend: widget.connection.requestFriend,
      ),
      GamePhase.results => ResultsView(
        mode: _results!.mode,
        scores: _results!.scores,
        trophies: _results!.trophies,
        isHost: _lobby.hostId == widget.myId,
        onPlayAgain: widget.connection.playAgain,
        onLeave: _leave,
        myId: widget.myId,
      ),
    };
  }
}
