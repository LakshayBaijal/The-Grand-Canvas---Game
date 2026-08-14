import 'stroke.dart';

class DrawingEntry {
  const DrawingEntry({
    required this.artistId,
    required this.artistName,
    required this.title,
    required this.strokes,
  });

  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;

  factory DrawingEntry.fromJson(Map<String, dynamic> json) => DrawingEntry(
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        strokes: (json['strokes'] as List)
            .map((s) => Stroke.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

/// Who backed a drawing and by how much — money in ranked games, vote points
/// in friendly ones.
class Backer {
  const Backer({required this.name, required this.amount});

  final String name;
  final int amount;

  factory Backer.fromJson(Map<String, dynamic> json) =>
      Backer(name: json['name'] as String, amount: json['amount'] as int);
}

class RoundResult {
  const RoundResult({
    required this.artistId,
    required this.artistName,
    required this.title,
    required this.strokes,
    required this.total,
    required this.backers,
  });

  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;

  /// Money raised, or vote points scored, depending on the game's scoring.
  final int total;
  final List<Backer> backers;

  factory RoundResult.fromJson(Map<String, dynamic> json) => RoundResult(
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        strokes: (json['strokes'] as List)
            .map((s) => Stroke.fromJson(s as Map<String, dynamic>))
            .toList(),
        total: json['total'] as int,
        backers: (json['backers'] as List)
            .map((i) => Backer.fromJson(i as Map<String, dynamic>))
            .toList(),
      );
}

class ScoreRow {
  const ScoreRow({
    required this.playerId,
    required this.nickname,
    required this.score,
    required this.delta,
    required this.raised,
    required this.bonus,
    required this.penalty,
  });

  final String playerId;
  final String nickname;
  final int score;
  final int delta;

  /// This round's breakdown of [delta]: delta = raised + bonus - penalty.
  final int raised;
  final int bonus;
  final int penalty;

  factory ScoreRow.fromJson(Map<String, dynamic> json) => ScoreRow(
        playerId: json['playerId'] as String,
        nickname: json['nickname'] as String,
        score: json['score'] as int,
        delta: json['delta'] as int,
        raised: json['raised'] as int,
        bonus: json['bonus'] as int,
        penalty: json['penalty'] as int,
      );
}

/// How a game is voted on and scored.
enum Scoring {
  /// Ranked: split a budget across the drawings you like.
  money,

  /// Friendly: just pick a 1st, 2nd and 3rd.
  points;

  static Scoring fromJson(String value) => value == 'points' ? Scoring.points : Scoring.money;

  bool get isMoney => this == Scoring.money;
}

/// Ranked games are matchmade and move the leaderboard; friendly games are
/// private, bot-fillable and score nothing.
enum GameMode {
  ranked,
  friendly;

  static GameMode fromJson(String value) =>
      value == 'ranked' ? GameMode.ranked : GameMode.friendly;

  bool get isRanked => this == GameMode.ranked;
}

/// A player's permanent record, as the server sees it.
class Profile {
  const Profile({
    required this.id,
    required this.nickname,
    required this.trophies,
    required this.games,
    required this.wins,
    required this.bestScore,
    required this.rank,
  });

  final String id;
  final String nickname;
  final int trophies;
  final int games;
  final int wins;
  final int bestScore;

  /// Global position, or null until a first ranked game is finished.
  final int? rank;

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        trophies: json['trophies'] as int,
        games: json['games'] as int,
        wins: json['wins'] as int,
        bestScore: json['bestScore'] as int,
        rank: json['rank'] as int?,
      );
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.id,
    required this.nickname,
    required this.trophies,
    required this.games,
    required this.wins,
  });

  final int rank;
  final String id;
  final String nickname;
  final int trophies;
  final int games;
  final int wins;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) => LeaderboardEntry(
        rank: json['rank'] as int,
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        trophies: json['trophies'] as int,
        games: json['games'] as int,
        wins: json['wins'] as int,
      );
}
