import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../views/draw_view.dart';
import '../views/investing_view.dart';
import '../views/lobby_view.dart';
import '../views/prompt_writing_view.dart';
import '../views/results_view.dart';
import '../views/reveal_view.dart';

enum GamePhase { lobby, promptWriting, drawing, investing, reveal, results }

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
  InvestingPhaseEvent? _investing;
  RoundRevealEvent? _reveal;
  FinalResultsEvent? _results;

  int _waitingSubmitted = 0;
  int _waitingTotal = 0;
  bool _disconnected = false;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _handleEvent(GameEvent event) {
    if (!mounted) return;
    switch (event) {
      case LobbyStateEvent(:final lobby):
        setState(() {
          _lobby = lobby;
          // A fresh lobby_state after a game means the host hit "play again".
          if (_phase == GamePhase.results) {
            _phase = GamePhase.lobby;
            _resetRoundState();
          }
        });
      case PromptWritingEvent():
        setState(() {
          _phase = GamePhase.promptWriting;
          _promptWriting = event;
        });
      case RoundStartEvent():
        setState(() {
          _phase = GamePhase.drawing;
          _round = event;
          _waitingSubmitted = 0;
          _waitingTotal = _lobby.players.length;
        });
      case InvestingPhaseEvent():
        setState(() {
          _phase = GamePhase.investing;
          _investing = event;
          _waitingSubmitted = 0;
          _waitingTotal = _lobby.players.length;
        });
      case RoundRevealEvent():
        setState(() {
          _phase = GamePhase.reveal;
          _reveal = event;
        });
      case FinalResultsEvent():
        setState(() {
          _phase = GamePhase.results;
          _results = event;
        });
      case WaitingUpdateEvent(:final submitted, :final total):
        setState(() {
          _waitingSubmitted = submitted;
          _waitingTotal = total;
        });
      case ErrorEvent(:final message):
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      case DisconnectedEvent():
        setState(() => _disconnected = true);
      case WelcomeEvent():
      case PongEvent():
        break;
    }
  }

  void _resetRoundState() {
    _promptWriting = null;
    _round = null;
    _investing = null;
    _reveal = null;
    _results = null;
  }

  @override
  Widget build(BuildContext context) {
    if (_disconnected) {
      return Scaffold(
        appBar: AppBar(title: const Text('Disconnected')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off, size: 56, color: GameColors.textMuted),
                const SizedBox(height: 20),
                const Text(
                  'Lost connection to the game',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Back to menu'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return switch (_phase) {
      GamePhase.lobby => LobbyView(
          lobby: _lobby,
          myId: widget.myId,
          onStart: widget.connection.startGame,
          onAddBot: widget.connection.addBot,
          onRemoveBot: widget.connection.removeBot,
        ),
      GamePhase.promptWriting => PromptWritingView(
          key: ValueKey('prompt-${_promptWriting!.roundIndex}'),
          event: _promptWriting!,
          onSubmit: widget.connection.submitPrompt,
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
      GamePhase.investing => InvestingView(
          key: ValueKey('invest-${_investing!.roundIndex}'),
          event: _investing!,
          myId: widget.myId,
          submitted: _waitingSubmitted,
          total: _waitingTotal,
          onSubmit: widget.connection.submitInvestment,
        ),
      GamePhase.reveal => RevealView(event: _reveal!),
      GamePhase.results => ResultsView(
          scores: _results!.scores,
          isHost: _lobby.hostId == widget.myId,
          onPlayAgain: widget.connection.playAgain,
          onLeave: () => Navigator.of(context).pop(),
        ),
    };
  }
}
