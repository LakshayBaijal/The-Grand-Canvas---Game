import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../models/stroke.dart';

/// Owns the single WebSocket connection to the game server and translates raw
/// JSON frames into typed [GameEvent]s.
class GameConnection {
  WebSocketChannel? _channel;
  final _eventController = StreamController<GameEvent>.broadcast();

  Stream<GameEvent> get events => _eventController.stream;

  /// Resolves once the server's `welcome` arrives, so callers can wait for a
  /// live connection before sending their first action.
  Future<void> connect(String address) async {
    await disconnect();
    final channel = WebSocketChannel.connect(Uri.parse('ws://$address'));
    _channel = channel;

    final ready = Completer<void>();
    channel.stream.listen(
      (raw) {
        final event = _decode(raw as String);
        if (event == null) return;
        if (event is WelcomeEvent && !ready.isCompleted) ready.complete();
        _eventController.add(event);
      },
      onError: (Object error) {
        if (!ready.isCompleted) ready.completeError(error);
        _eventController.add(ErrorEvent(_friendlyError(error)));
      },
      onDone: () {
        if (!ready.isCompleted) {
          ready.completeError(StateError('Connection closed before handshake'));
        }
        _eventController.add(const DisconnectedEvent());
      },
      cancelOnError: true,
    );

    await ready.future.timeout(
      const Duration(seconds: 8),
      onTimeout: () => throw TimeoutException('Could not reach the server'),
    );
  }

  Future<void> disconnect() async {
    final channel = _channel;
    _channel = null;
    await channel?.sink.close();
  }

  GameEvent? _decode(String raw) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    switch (json['type']) {
      case 'welcome':
        return WelcomeEvent(json['connectionId'] as String);
      case 'lobby_state':
        return LobbyStateEvent(LobbyState.fromJson(json));
      case 'prompt_writing':
        return PromptWritingEvent(
          template: json['template'] as String,
          writerId: json['writerId'] as String,
          writerName: json['writerName'] as String,
          isWriter: json['isWriter'] as bool,
          deadlineMs: json['deadlineMs'] as int,
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'round_start':
        return RoundStartEvent(
          prompt: json['prompt'] as String,
          deadlineMs: json['deadlineMs'] as int,
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'waiting_update':
        return WaitingUpdateEvent(json['submitted'] as int, json['total'] as int);
      case 'investing_phase':
        return InvestingPhaseEvent(
          prompt: json['prompt'] as String,
          entries: (json['entries'] as List)
              .map((e) => DrawingEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          budget: json['budget'] as int,
          step: json['step'] as int,
          deadlineMs: json['deadlineMs'] as int,
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'round_reveal':
        return RoundRevealEvent(
          prompt: json['prompt'] as String,
          entries: (json['entries'] as List)
              .map((e) => InvestmentResult.fromJson(e as Map<String, dynamic>))
              .toList(),
          scores: (json['scores'] as List)
              .map((s) => ScoreRow.fromJson(s as Map<String, dynamic>))
              .toList(),
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'final_results':
        return FinalResultsEvent(
          (json['scores'] as List)
              .map((s) => ScoreRow.fromJson(s as Map<String, dynamic>))
              .toList(),
        );
      case 'doodle':
        return DoodleEvent(
          prompt: json['prompt'] as String,
          artistName: json['artistName'] as String,
          title: json['title'] as String,
          strokes: (json['strokes'] as List)
              .map((s) => Stroke.fromJson(s as Map<String, dynamic>))
              .toList(),
        );
      case 'error':
        return ErrorEvent(json['message'] as String);
      case 'pong':
        return PongEvent(json['serverTimeMs'] as int);
      default:
        return null;
    }
  }

  void createLobby(String nickname) => _send({'type': 'create_lobby', 'nickname': nickname});

  void quickPlay(String nickname) => _send({'type': 'quick_play', 'nickname': nickname});

  void joinLobby(String code, String nickname) =>
      _send({'type': 'join_lobby', 'code': code, 'nickname': nickname});

  void startGame() => _send({'type': 'start_game'});

  void addBot() => _send({'type': 'add_bot'});

  void removeBot() => _send({'type': 'remove_bot'});

  void submitPrompt(String text) => _send({'type': 'submit_prompt', 'text': text});

  void submitDrawing(List<Stroke> strokes, String title) =>
      _send({'type': 'submit_drawing', 'strokes': strokes.map((s) => s.toJson()).toList(), 'title': title});

  void submitInvestment(Map<String, int> allocations) =>
      _send({'type': 'submit_investment', 'allocations': allocations});

  void playAgain() => _send({'type': 'play_again'});

  /// Asks for one ambient doodle to replay while players wait around.
  void requestDoodle() => _send({'type': 'request_doodle'});

  void _send(Map<String, dynamic> message) => _channel?.sink.add(jsonEncode(message));

  void dispose() {
    _channel?.sink.close();
    _eventController.close();
  }
}

String _friendlyError(Object error) {
  if (error is TimeoutException) return 'Could not reach the server';
  return 'Connection problem — check the server address';
}
