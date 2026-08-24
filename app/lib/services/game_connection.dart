import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../models/stroke.dart';
import '../models/styles.dart';
import 'identity.dart';

/// Owns the single WebSocket connection to the game server and translates raw
/// JSON frames into typed [GameEvent]s.
class GameConnection {
  WebSocketChannel? _channel;
  final _eventController = StreamController<GameEvent>.broadcast();

  Stream<GameEvent> get events => _eventController.stream;

  GameEvent? _lastPhase;

  /// The most recent message that decides which screen a game should be on.
  ///
  /// A broadcast stream drops anything sent before a listener attaches, and a
  /// ranked match starts the moment it's made — so its first phase message can
  /// land in the gap between the home screen pushing [GameScreen] and that
  /// screen subscribing. Replaying the last one closes that gap.
  GameEvent? get lastPhaseEvent => _lastPhase;

  static bool _isPhaseEvent(GameEvent event) =>
      event is LobbyStateEvent ||
      event is PromptWritingEvent ||
      event is RoundStartEvent ||
      event is VotingPhaseEvent ||
      event is RoundRevealEvent ||
      event is FinalResultsEvent;

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
        if (_isPhaseEvent(event)) _lastPhase = event;
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
    _lastPhase = null;
    await channel?.sink.close();
  }

  GameEvent? _decode(String raw) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    switch (json['type']) {
      case 'welcome':
        return WelcomeEvent(json['connectionId'] as String);
      case 'lobby_state':
        return LobbyStateEvent(LobbyState.fromJson(json));
      case 'account':
        return AccountEvent(
          playerId: json['playerId'] as String,
          linked: json['linked'] as bool? ?? false,
          googleAvailable: json['googleAvailable'] as bool? ?? false,
        );
      case 'lobby_list':
        return LobbyListEvent(
          (json['lobbies'] as List)
              .map((l) => OpenLobby.fromJson(l as Map<String, dynamic>))
              .toList(),
        );
      case 'profile':
        return ProfileEvent(Profile.fromJson(json['profile'] as Map<String, dynamic>));
      case 'leaderboard':
        return LeaderboardEvent(
          entries: (json['entries'] as List)
              .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          you: json['you'] == null
              ? null
              : Profile.fromJson(json['you'] as Map<String, dynamic>),
        );
      case 'queue_status':
        return QueueStatusEvent(
          waiting: json['waiting'] as int,
          target: json['target'] as int,
          botFillAtMs: json['botFillAtMs'] as int,
        );
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
      case 'voting_phase':
        return VotingPhaseEvent(
          scoring: Scoring.fromJson(json['scoring'] as String),
          prompt: json['prompt'] as String,
          entries: (json['entries'] as List)
              .map((e) => DrawingEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          budget: json['budget'] as int,
          step: json['step'] as int,
          places: json['places'] as int,
          deadlineMs: json['deadlineMs'] as int,
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'round_reveal':
        return RoundRevealEvent(
          scoring: Scoring.fromJson(json['scoring'] as String),
          prompt: json['prompt'] as String,
          entries: (json['entries'] as List)
              .map((e) => RoundResult.fromJson(e as Map<String, dynamic>))
              .toList(),
          scores: (json['scores'] as List)
              .map((s) => ScoreRow.fromJson(s as Map<String, dynamic>))
              .toList(),
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
          fundingGoal: json['fundingGoal'] as int?,
        );
      case 'final_results':
        return FinalResultsEvent(
          mode: GameMode.fromJson(json['mode'] as String),
          scores: (json['scores'] as List)
              .map((s) => ScoreRow.fromJson(s as Map<String, dynamic>))
              .toList(),
          trophies: (json['trophies'] as Map<String, dynamic>)
              .map((k, v) => MapEntry(k, v as int)),
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

  /// Identity handshake. Must be sent before anything except `request_doodle`.
  void hello(Identity identity) => _send({
        'type': 'hello',
        'playerId': identity.playerId,
        'nickname': identity.nickname,
      });

  void setNickname(String nickname) => _send({'type': 'set_nickname', 'nickname': nickname});

  void getLeaderboard() => _send({'type': 'get_leaderboard'});

  void findMatch() => _send({'type': 'find_match'});

  void cancelMatch() => _send({'type': 'cancel_match'});

  void createLobby({bool isPublic = true}) =>
      _send({'type': 'create_lobby', 'visibility': isPublic ? 'public' : 'private'});

  /// Opens the lobby browser. The server keeps pushing `lobby_list` until
  /// [stopBrowsing], so there is nothing to poll.
  void listLobbies() => _send({'type': 'list_lobbies'});

  void stopBrowsing() => _send({'type': 'stop_browsing'});

  /// Hands Google's id token to the server, which verifies it. The server
  /// replies with `account` — possibly carrying a different player id, if the
  /// account already owned a profile.
  void linkGoogle(String idToken) =>
      _send({'type': 'link_google', 'idToken': idToken});

  void unlinkGoogle() => _send({'type': 'unlink_google'});

  /// Host-only, from inside the lobby.
  void setVisibility({required bool isPublic}) =>
      _send({'type': 'set_visibility', 'visibility': isPublic ? 'public' : 'private'});

  void joinLobby(String code) => _send({'type': 'join_lobby', 'code': code});

  void leaveLobby() {
    // Nothing to replay into the next game we join.
    _lastPhase = null;
    _send({'type': 'leave_lobby'});
  }

  void startGame() => _send({'type': 'start_game'});

  void addBot() => _send({'type': 'add_bot'});

  void removeBot() => _send({'type': 'remove_bot'});

  void submitPrompt(String text) => _send({'type': 'submit_prompt', 'text': text});

  void submitDrawing(List<Stroke> strokes, String title, PaperStyle paper) => _send({
        'type': 'submit_drawing',
        'strokes': strokes.map((s) => s.toJson()).toList(),
        'title': title,
        'paper': paper.id,
      });

  void submitInvestment(Map<String, int> allocations) =>
      _send({'type': 'submit_investment', 'allocations': allocations});

  /// Ordered artistIds, best first. Friendly games only.
  void submitRanking(List<String> order) => _send({'type': 'submit_ranking', 'order': order});

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
