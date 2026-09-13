import '../services/reminder_plan.dart';
import 'daily_models.dart';
import 'lobby_state.dart';
import 'round_models.dart';
import 'stroke.dart';

sealed class GameEvent {
  const GameEvent();
}

class WelcomeEvent extends GameEvent {
  const WelcomeEvent(this.connectionId);
  final String connectionId;
}

class LobbyStateEvent extends GameEvent {
  const LobbyStateEvent(this.lobby);
  final LobbyState lobby;
}

/// Who the server considers you, after the handshake and after any link or
/// unlink.
///
/// [playerId] can differ from the id the app sent: linking a Google account
/// that already owns a profile moves the player onto that profile. The app
/// saves whatever arrives here.
class AccountEvent extends GameEvent {
  const AccountEvent({
    required this.playerId,
    required this.linked,
    required this.googleAvailable,
  });

  final String playerId;
  final bool linked;

  /// False when the server has no Google client id configured.
  final bool googleAvailable;
}

/// The open friendly games, pushed whenever the list changes while the lobby
/// browser is open.
class LobbyListEvent extends GameEvent {
  const LobbyListEvent(this.lobbies);
  final List<OpenLobby> lobbies;
}

/// The player's permanent record, sent after the identity handshake and again
/// whenever trophies change.
class ProfileEvent extends GameEvent {
  const ProfileEvent(this.profile);
  final Profile profile;
}

class LeaderboardEvent extends GameEvent {
  const LeaderboardEvent({required this.entries, required this.you});
  final List<LeaderboardEntry> entries;
  final Profile? you;
}

/// Progress while waiting for a ranked match.
class QueueStatusEvent extends GameEvent {
  const QueueStatusEvent({
    required this.waiting,
    required this.target,
    required this.botFillAtMs,
  });

  final int waiting;
  final int target;

  /// When bots will be added so the game can start anyway.
  final int botFillAtMs;
}

class PromptWritingEvent extends GameEvent {
  const PromptWritingEvent({
    required this.template,
    required this.writerId,
    required this.writerName,
    required this.isWriter,
    required this.deadlineMs,
    required this.roundIndex,
    required this.totalRounds,
  });

  final String template;
  final String writerId;
  final String writerName;
  final bool isWriter;
  final int deadlineMs;
  final int roundIndex;
  final int totalRounds;
}

class RoundStartEvent extends GameEvent {
  const RoundStartEvent({
    required this.prompt,
    required this.deadlineMs,
    required this.roundIndex,
    required this.totalRounds,
  });

  final String prompt;
  final int deadlineMs;
  final int roundIndex;
  final int totalRounds;
}

class WaitingUpdateEvent extends GameEvent {
  const WaitingUpdateEvent(this.submitted, this.total);
  final int submitted;
  final int total;
}

class VotingPhaseEvent extends GameEvent {
  const VotingPhaseEvent({
    required this.scoring,
    required this.prompt,
    required this.entries,
    required this.budget,
    required this.step,
    required this.places,
    required this.deadlineMs,
    required this.roundIndex,
    required this.totalRounds,
  });

  final Scoring scoring;
  final String prompt;
  final List<DrawingEntry> entries;

  /// Money games: what there is to spend.
  final int budget;

  /// Money games: increment the +/- controls move by. The server guarantees it
  /// divides [budget] exactly so the whole budget is always spendable.
  final int step;

  /// Points games: how many places a voter picks, best first.
  final int places;
  final int deadlineMs;
  final int roundIndex;
  final int totalRounds;
}

class RoundRevealEvent extends GameEvent {
  const RoundRevealEvent({
    required this.scoring,
    required this.prompt,
    required this.entries,
    required this.scores,
    required this.roundIndex,
    required this.totalRounds,
    this.fundingGoal,
  });

  final Scoring scoring;
  final String prompt;
  final List<RoundResult> entries;
  final List<ScoreRow> scores;

  /// What a drawing had to raise to count as funded. Null in friendly games,
  /// which are scored by votes and have no threshold to clear.
  final int? fundingGoal;
  final int roundIndex;
  final int totalRounds;
}

class FinalResultsEvent extends GameEvent {
  const FinalResultsEvent({
    required this.mode,
    required this.scores,
    required this.trophies,
  });

  final GameMode mode;
  final List<ScoreRow> scores;

  /// Ranked games only: playerId -> trophies won just now.
  final Map<String, int> trophies;
}

/// One bot drawing to replay on an idle screen. [strokes] are in the order
/// they were drawn, so the client can play them back like a hand at work.
class DoodleEvent extends GameEvent {
  const DoodleEvent({
    required this.prompt,
    required this.artistName,
    required this.title,
    required this.strokes,
  });

  final String prompt;
  final String artistName;
  final String title;
  final List<Stroke> strokes;
}

/// Today's daily prompt, and where this player stands with it. Sent on
/// request and again after a submission.
class DailyInfoEvent extends GameEvent {
  const DailyInfoEvent({
    required this.day,
    required this.prompt,
    required this.endsAtMs,
    required this.submitted,
    required this.submissions,
    required this.mine,
  });

  final int day;
  final String prompt;

  /// When the prompt changes.
  final int endsAtMs;
  final bool submitted;

  /// How many people have drawn it so far today.
  final int submissions;

  /// This player's own entry, once they have made one.
  final DailyEntry? mine;
}

/// A page of a day's gallery, newest first.
class DailyGalleryEvent extends GameEvent {
  const DailyGalleryEvent({
    required this.day,
    required this.prompt,
    required this.blind,
    required this.yesterday,
    required this.entries,
    required this.hasMore,
  });

  final int day;
  final String prompt;

  /// True while the day is open: other people's entries come without a
  /// name or a heart count, so the drawing is all there is to judge.
  final bool blind;

  /// Yesterday's frozen result, with names and counts. Only with the first
  /// page; null if there wasn't one.
  final HallDay? yesterday;
  final List<DailyEntry> entries;
  final bool hasMore;
}

/// A heart landed: the drawing's new count.
class DailyHeartedEvent extends GameEvent {
  const DailyHeartedEvent({required this.entryId, required this.hearts});
  final int entryId;
  final int hearts;
}

/// Someone on the friends list, or a request either way.
class FriendRow {
  const FriendRow({required this.id, required this.nickname});
  final String id;
  final String nickname;
  factory FriendRow.fromJson(Map<String, dynamic> j) =>
      FriendRow(id: j['id'] as String, nickname: j['nickname'] as String);
}

/// A friend as the list shows them: connected right now, and the code of
/// the friendly room they're sitting in if it can still be joined.
class FriendEntry extends FriendRow {
  const FriendEntry({
    required super.id,
    required super.nickname,
    required this.online,
    this.roomCode,
  });
  final bool online;
  final String? roomCode;
  factory FriendEntry.fromJson(Map<String, dynamic> j) => FriendEntry(
    id: j['id'] as String,
    nickname: j['nickname'] as String,
    online: j['online'] as bool? ?? false,
    roomCode: j['roomCode'] as String?,
  );
}

/// The whole friends picture, sent whenever it changes.
class FriendsEvent extends GameEvent {
  const FriendsEvent({
    required this.friends,
    required this.incoming,
    required this.outgoing,
  });
  final List<FriendEntry> friends;
  final List<FriendRow> incoming;
  final List<FriendRow> outgoing;
}

/// What happened to a friend request you sent.
class FriendResultEvent extends GameEvent {
  const FriendResultEvent({
    required this.playerId,
    required this.nickname,
    required this.result,
  });
  final String playerId;
  final String nickname;

  /// sent · accepted · already · pending · self · unknown
  final String result;
}

class FriendRequestReceivedEvent extends GameEvent {
  const FriendRequestReceivedEvent(this.from);
  final FriendRow from;
}

class FriendAcceptedEvent extends GameEvent {
  const FriendAcceptedEvent(this.by);
  final FriendRow by;
}

/// A friend wants you in their room.
class FriendInvitedEvent extends GameEvent {
  const FriendInvitedEvent({required this.from, required this.code});
  final FriendRow from;
  final String code;
}

/// The server took a report. Nothing else happens; a person reads it.
class ReportedEvent extends GameEvent {
  const ReportedEvent();
}

/// An artist is now hidden for this player. The app drops everything of
/// theirs it is already showing; the server keeps them out from now on.
class ArtistHiddenEvent extends GameEvent {
  const ArtistHiddenEvent({required this.artistId, required this.entryId});
  final String artistId;
  final int? entryId;
}

/// A page of the Hall of Fame, newest day first.
class DailyHistoryEvent extends GameEvent {
  const DailyHistoryEvent({required this.days, required this.hasMore});
  final List<HallDay> days;
  final bool hasMore;
}

/// The next fortnight of daily prompts, for scheduling local reminders.
class DailyUpcomingEvent extends GameEvent {
  const DailyUpcomingEvent(this.days);
  final List<UpcomingDay> days;
}

class ErrorEvent extends GameEvent {
  const ErrorEvent(this.message);
  final String message;
}

class PongEvent extends GameEvent {
  const PongEvent(this.serverTimeMs);
  final int serverTimeMs;
}

class DisconnectedEvent extends GameEvent {
  const DisconnectedEvent();
}
