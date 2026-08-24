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
