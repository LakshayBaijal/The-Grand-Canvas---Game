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

class InvestingPhaseEvent extends GameEvent {
  const InvestingPhaseEvent({
    required this.prompt,
    required this.entries,
    required this.budget,
    required this.step,
    required this.deadlineMs,
    required this.roundIndex,
    required this.totalRounds,
  });

  final String prompt;
  final List<DrawingEntry> entries;
  final int budget;

  /// Increment the +/- controls move by; the server guarantees it divides
  /// [budget] exactly so the whole budget is always spendable.
  final int step;
  final int deadlineMs;
  final int roundIndex;
  final int totalRounds;
}

class RoundRevealEvent extends GameEvent {
  const RoundRevealEvent({
    required this.prompt,
    required this.entries,
    required this.scores,
    required this.roundIndex,
    required this.totalRounds,
  });

  final String prompt;
  final List<InvestmentResult> entries;
  final List<ScoreRow> scores;
  final int roundIndex;
  final int totalRounds;
}

class FinalResultsEvent extends GameEvent {
  const FinalResultsEvent(this.scores);
  final List<ScoreRow> scores;
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
