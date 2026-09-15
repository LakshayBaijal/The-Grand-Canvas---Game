import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/daily_models.dart';
import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../models/stroke.dart';
import '../models/styles.dart';
import 'entitlements.dart';
import 'identity.dart';
import 'reminder_plan.dart';

/// Owns the single WebSocket connection to the game server and translates raw
/// JSON frames into typed [GameEvent]s.
class GameConnection {
  WebSocketChannel? _channel;
  final _eventController = StreamController<GameEvent>.broadcast();

  Stream<GameEvent> get events => _eventController.stream;

  /// Whether there is a live socket right now. Goes false the moment one
  /// drops and true again once [reconnect] has re-made it.
  bool get isConnected => _channel != null;

  /// Where and as whom we last connected, so a dropped connection can be
  /// re-made from inside a game without the home screen's help.
  String? _address;
  Identity? _identity;

  /// A small message every so often, for two reasons. Carrier NATs drop the
  /// mapping for a TCP connection that goes quiet -- on Indian mobile
  /// networks often after 30 seconds or so -- and a phase where you are only
  /// watching (the reveal, waiting on others) can easily go quieter than
  /// that. And a connection that has died underneath us is only discovered
  /// when something is written to it; better that be a ping than the drawing
  /// you just spent a minute on.
  Timer? _keepalive;
  static const _keepaliveEvery = Duration(seconds: 20);

  GameEvent? _lastPhase;

  /// Game moves sent while the socket was down, replayed once it is back.
  ///
  /// The one that matters is the drawing: the clock can run out during a
  /// blip, the view force-submits, and without this the minute of work goes
  /// into a dead socket. The server holds the seat, so on reconnect the
  /// move is still wanted -- or the phase has moved on and it is ignored
  /// there, which is the right outcome either way. Only moves are kept;
  /// anything else (pings, lobby browsing) is meaningless after a gap.
  final List<Map<String, dynamic>> _pendingMoves = [];
  static const _moveTypes = {
    'submit_prompt', 'submit_drawing', 'submit_investment', 'submit_ranking',
  };

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
    _address = address;
    final channel = WebSocketChannel.connect(serverUri(address));
    _channel = channel;

    final ready = Completer<void>();
    channel.stream.listen(
      (raw) {
        GameEvent? event;
        try {
          event = _decode(raw as String);
        } catch (e) {
          // One frame we can't read is not a reason to hang up on the whole
          // game. Skipping it keeps the connection — and the round — alive.
          debugPrint('GameConnection: ignoring an unreadable message ($e)');
          return;
        }
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
        _keepalive?.cancel();
        _keepalive = null;
        if (!ready.isCompleted) {
          ready.completeError(StateError('Connection closed before handshake'));
        }
        // Only the connection that is still current gets to say it dropped.
        // A replaced channel closing late (we reconnected on top of it) is
        // old news, and announcing it would restart the reconnect dance.
        if (identical(_channel, channel)) {
          _channel = null;
          _eventController.add(const DisconnectedEvent());
        }
      },
      cancelOnError: true,
    );

    await ready.future.timeout(
      const Duration(seconds: 8),
      onTimeout: () => throw TimeoutException('Could not reach the server'),
    );

    _keepalive?.cancel();
    _keepalive = Timer.periodic(_keepaliveEvery, (_) => _send({'type': 'ping'}));
  }

  /// Re-makes the connection to wherever we last connected and signs back in
  /// as whoever we were. The server holds a dropped player's seat for a
  /// while and, on seeing the same id again, puts them straight back on the
  /// screen the game is on -- so a successful reconnect is followed by
  /// `lobby_state` and the current phase without anyone asking.
  ///
  /// Returns false if there is nothing to reconnect to, or the attempt
  /// failed; the caller decides whether to try again.
  Future<bool> reconnect() async {
    final address = _address;
    final identity = _identity;
    if (address == null || identity == null) return false;
    try {
      await connect(address);
    } catch (_) {
      return false;
    }
    hello(identity);
    // After hello, so the server knows who is moving; the seat is reclaimed
    // synchronously on its side when hello lands.
    for (final move in _pendingMoves) {
      _send(move);
    }
    _pendingMoves.clear();
    return true;
  }

  Future<void> disconnect() async {
    _keepalive?.cancel();
    _keepalive = null;
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
        return ProfileEvent(
          Profile.fromJson(json['profile'] as Map<String, dynamic>),
        );
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
          answer: json['answer'] as String? ?? '',
          deadlineMs: json['deadlineMs'] as int,
          roundIndex: json['roundIndex'] as int,
          totalRounds: json['totalRounds'] as int,
        );
      case 'waiting_update':
        return WaitingUpdateEvent(
          json['submitted'] as int,
          json['total'] as int,
        );
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
          trophies: (json['trophies'] as Map<String, dynamic>).map(
            (k, v) => MapEntry(k, v as int),
          ),
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
      case 'daily_info':
        return DailyInfoEvent(
          day: json['day'] as int,
          prompt: json['prompt'] as String,
          endsAtMs: json['endsAtMs'] as int,
          submitted: json['submitted'] as bool,
          submissions: json['submissions'] as int,
          mine: json['mine'] == null
              ? null
              : DailyEntry.fromJson(json['mine'] as Map<String, dynamic>),
        );
      case 'daily_gallery':
        return DailyGalleryEvent(
          day: json['day'] as int,
          prompt: json['prompt'] as String,
          blind: (json['blind'] as bool?) ?? true,
          yesterday: json['yesterday'] == null
              ? null
              : HallDay.fromJson(json['yesterday'] as Map<String, dynamic>),
          entries: (json['entries'] as List)
              .map((e) => DailyEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          hasMore: json['hasMore'] as bool,
        );
      case 'daily_hearted':
        return DailyHeartedEvent(
          entryId: json['entryId'] as int,
          hearts: json['hearts'] as int,
        );
      case 'friends':
        return FriendsEvent(
          friends: (json['friends'] as List)
              .map((e) => FriendEntry.fromJson(e as Map<String, dynamic>))
              .toList(),
          incoming: (json['incoming'] as List)
              .map((e) => FriendRow.fromJson(e as Map<String, dynamic>))
              .toList(),
          outgoing: (json['outgoing'] as List)
              .map((e) => FriendRow.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case 'friend_result':
        return FriendResultEvent(
          playerId: json['playerId'] as String,
          nickname: json['nickname'] as String,
          result: json['result'] as String,
        );
      case 'friend_request_received':
        return FriendRequestReceivedEvent(
          FriendRow.fromJson(json['from'] as Map<String, dynamic>),
        );
      case 'friend_accepted':
        return FriendAcceptedEvent(
          FriendRow.fromJson(json['by'] as Map<String, dynamic>),
        );
      case 'friend_invited':
        return FriendInvitedEvent(
          from: FriendRow.fromJson(json['from'] as Map<String, dynamic>),
          code: json['code'] as String,
        );
      case 'reported':
        return const ReportedEvent();
      case 'artist_hidden':
        return ArtistHiddenEvent(
          artistId: json['artistId'] as String,
          entryId: json['entryId'] as int?,
        );
      case 'daily_history':
        return DailyHistoryEvent(
          days: (json['days'] as List)
              .map((d) => HallDay.fromJson(d as Map<String, dynamic>))
              .toList(),
          hasMore: json['hasMore'] as bool,
        );
      case 'daily_upcoming':
        return DailyUpcomingEvent(
          (json['days'] as List)
              .map((d) => UpcomingDay.fromJson(d as Map<String, dynamic>))
              .toList(),
        );
      case 'kicked':
        return KickedEvent(json['code'] as String? ?? '');
      case 'error':
        return ErrorEvent(json['message'] as String);
      case 'pong':
        return PongEvent(json['serverTimeMs'] as int);
      default:
        return null;
    }
  }

  /// Identity handshake. Must be sent before anything except `request_doodle`.
  void hello(Identity identity) {
    _identity = identity;
    _send({
      'type': 'hello',
      'playerId': identity.playerId,
      'nickname': identity.nickname,
    });
    // The crown is the app's to report: the purchase lives in Play, and the
    // server only needs to know so the rest of the table can see it.
    setCrown(Entitlements.instance.hasLifetime);
  }

  /// Whether this player owns the Grand Pass, for the crown by their name.
  void setCrown(bool owned) => _send({'type': 'set_crown', 'owned': owned});

  void setNickname(String nickname) =>
      _send({'type': 'set_nickname', 'nickname': nickname});

  void getLeaderboard() => _send({'type': 'get_leaderboard'});

  void findMatch() => _send({'type': 'find_match'});

  void cancelMatch() => _send({'type': 'cancel_match'});

  void createLobby({bool isPublic = true}) => _send({
    'type': 'create_lobby',
    'visibility': isPublic ? 'public' : 'private',
  });

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

  /// Tells the server the thank-you has been shown, so it is never offered
  /// again on any device this account signs in on.
  void thanksSeen() => _send({'type': 'thanks_seen'});

  /// Host-only, from inside the lobby.
  void setVisibility({required bool isPublic}) => _send({
    'type': 'set_visibility',
    'visibility': isPublic ? 'public' : 'private',
  });

  void joinLobby(String code) => _send({'type': 'join_lobby', 'code': code});

  void leaveLobby() {
    // Nothing to replay into the next game we join.
    _lastPhase = null;
    _pendingMoves.clear();
    _send({'type': 'leave_lobby'});
  }

  void startGame() => _send({'type': 'start_game'});

  void addBot() => _send({'type': 'add_bot'});

  void removeBot() => _send({'type': 'remove_bot'});

  /// Host-only: empty one seat in a friendly room. Works on bots too, so the
  /// same control clears any seat at the table.
  void kickPlayer(String playerId) =>
      _send({'type': 'kick_player', 'playerId': playerId});

  void submitPrompt(String text) =>
      _send({'type': 'submit_prompt', 'text': text});

  void submitDrawing(List<Stroke> strokes, String title, PaperStyle paper) =>
      _send({
        'type': 'submit_drawing',
        'strokes': strokes.map((s) => s.toJson()).toList(),
        'title': title,
        'paper': paper.id,
      });

  void submitInvestment(Map<String, int> allocations) =>
      _send({'type': 'submit_investment', 'allocations': allocations});

  /// Ordered artistIds, best first. Friendly games only.
  void submitRanking(List<String> order) =>
      _send({'type': 'submit_ranking', 'order': order});

  void playAgain() => _send({'type': 'play_again'});

  /// Asks for one ambient doodle to replay while players wait around.
  void requestDoodle() => _send({'type': 'request_doodle'});

  /// Today's prompt and whether we've drawn it. Answered with `daily_info`.
  void dailyInfo() => _send({'type': 'daily_info'});

  /// Submits today's drawing. The server answers with a fresh `daily_info`,
  /// so the screen never has to guess what state it's in afterwards.
  void submitDaily(List<Stroke> strokes, String title, PaperStyle paper) =>
      _send({
        'type': 'daily_submit',
        'strokes': strokes.map((s) => s.toJson()).toList(),
        'title': title,
        'paper': paper.id,
      });

  /// The next fortnight of prompts, for the local reminder schedule.
  void dailyUpcoming() => _send({'type': 'daily_upcoming'});

  /// A heart on one of today's drawings. Permanent — there is no undo, by
  /// design, so the button should make that clear before it is pressed.
  void heartDaily(int entryId) =>
      _send({'type': 'daily_heart', 'entryId': entryId});

  // --- friends -----------------------------------------------------------

  void requestFriend(String playerId) =>
      _send({'type': 'friend_request', 'playerId': playerId});
  void acceptFriend(String playerId) =>
      _send({'type': 'friend_accept', 'playerId': playerId});
  void removeFriend(String playerId) =>
      _send({'type': 'friend_remove', 'playerId': playerId});
  void listFriends() => _send({'type': 'friends_list'});

  /// Pull a friend into the friendly room you're in.
  void inviteFriend(String playerId) =>
      _send({'type': 'friend_invite', 'playerId': playerId});

  /// A note about a drawing, for a person to read. Daily and hall drawings
  /// by [entryId]; round drawings by [artistId] and [title], since rounds
  /// have no entry ids. Never removes anything by itself.
  void reportDrawing({
    int? entryId,
    String? artistId,
    String? title,
    required String reason,
  }) => _send({
    'type': 'report_drawing',
    'entryId': ?entryId,
    'artistId': ?artistId,
    'title': ?title,
    'reason': reason,
  });

  /// Stop seeing an artist's Daily drawings and hall entries, on this
  /// account only. By [entryId] (the Daily is blind, so the artist is
  /// unknown to the app) or by [artistId].
  void hideArtist({int? entryId, String? artistId}) => _send({
    'type': 'hide_artist',
    'entryId': ?entryId,
    'artistId': ?artistId,
  });

  /// The Hall of Fame, newest day first. Pass the last day shown as
  /// [beforeDay] for the next page.
  void dailyHistory({int? beforeDay}) =>
      _send({'type': 'daily_history', 'beforeDay': ?beforeDay});

  /// A page of a day's gallery (today when [day] is omitted), newest first.
  /// Pass the last entry's id as [beforeId] to get the next page.
  void dailyGallery({int? day, int? beforeId}) =>
      _send({'type': 'daily_gallery', 'day': ?day, 'beforeId': ?beforeId});

  void _send(Map<String, dynamic> message) {
    final channel = _channel;
    if (channel == null) {
      if (_moveTypes.contains(message['type'])) {
        // One of each: a newer move for the same phase replaces the older.
        _pendingMoves.removeWhere((m) => m['type'] == message['type']);
        _pendingMoves.add(message);
      }
      return;
    }
    channel.sink.add(jsonEncode(message));
  }

  void dispose() {
    _keepalive?.cancel();
    _channel?.sink.close();
    _eventController.close();
  }
}

String _friendlyError(Object error) {
  if (error is TimeoutException) return 'Could not reach the server';
  return 'Connection problem — check the server address';
}

/// Turns what the player typed into the URL to dial.
///
/// A LAN server is an IP and a port (`192.168.1.20:8090`) and speaks plain
/// `ws://`; a hosted one is a hostname (`grandcanvas.up.railway.app`) behind
/// TLS and needs `wss://`. Deciding here — anything that isn't a bare IP or a
/// `.local` name is treated as hosted — means going live is a matter of typing
/// the hostname, not editing this file. An explicit `ws://` or `wss://` prefix
/// is always respected.
Uri serverUri(String address) {
  final a = address.trim();
  if (a.startsWith('ws://') || a.startsWith('wss://')) return Uri.parse(a);
  final host = a.split(':').first.split('/').first;
  final isIp = RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(host);
  final isLocal =
      isIp ||
      host == 'localhost' ||
      host.endsWith('.local') ||
      !host.contains('.');
  return Uri.parse('${isLocal ? 'ws' : 'wss'}://$a');
}
