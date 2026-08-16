import 'stroke.dart';
import 'styles.dart';

class DrawingEntry {
  const DrawingEntry({
    required this.artistId,
    required this.artistName,
    required this.title,
    required this.strokes,
    this.paper = PaperStyle.plain,
  });

  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;

  /// The sheet the artist drew on, so their entry looks like theirs wherever
  /// it's shown.
  final PaperStyle paper;

  factory DrawingEntry.fromJson(Map<String, dynamic> json) => DrawingEntry(
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        paper: PaperStyle.fromId(json['paper'] as String?),
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
    this.paper = PaperStyle.plain,
  });

  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;
  final PaperStyle paper;

  /// Money raised, or vote points scored, depending on the game's scoring.
  final int total;
  final List<Backer> backers;

  factory RoundResult.fromJson(Map<String, dynamic> json) => RoundResult(
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        paper: PaperStyle.fromId(json['paper'] as String?),
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
/// A band on the ladder. The server derives this from the rating and sends it
/// ready-made, so the app never has to know the thresholds.
class League {
  const League({
    required this.id,
    required this.name,
    required this.floor,
    required this.next,
    required this.progress,
  });

  final String id;
  final String name;

  /// Where this league starts — also the rating it protects you down to.
  final int floor;

  /// Where the next league starts, or null at the top.
  final int? next;

  /// 0..1 through the current band.
  final double progress;

  /// Falls back to an unnamed band rather than throwing, so an older server
  /// that doesn't send leagues can't crash the app.
  static const unranked = League(
    id: 'unranked',
    name: 'Unranked',
    floor: 0,
    next: null,
    progress: 0,
  );

  factory League.fromJson(Map<String, dynamic> json) => League(
        id: json['id'] as String? ?? 'unranked',
        name: json['name'] as String? ?? 'Unranked',
        floor: (json['floor'] as num?)?.toInt() ?? 0,
        next: (json['next'] as num?)?.toInt(),
        progress: (json['progress'] as num?)?.toDouble() ?? 0,
      );
}

class Profile {
  const Profile({
    required this.id,
    required this.nickname,
    required this.trophies,
    required this.games,
    required this.wins,
    required this.bestScore,
    required this.rank,
    required this.rating,
    required this.league,
    required this.seasonGames,
    required this.placementsLeft,
    required this.season,
    required this.seasonEndsMs,
  });

  final String id;
  final String nickname;

  /// Career total. Only ever goes up.
  final int trophies;
  final int games;
  final int wins;
  final int bestScore;

  /// Global position, or null while still playing placement games.
  final int? rank;

  /// Current skill. Unlike [trophies] this moves both ways, and it's what the
  /// leaderboard is ordered by.
  final int rating;
  final League league;
  final int seasonGames;

  /// Ranked games still to play before appearing on the board.
  final int placementsLeft;
  final int season;
  final int seasonEndsMs;

  bool get isPlacing => placementsLeft > 0;

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        trophies: json['trophies'] as int,
        games: json['games'] as int,
        wins: json['wins'] as int,
        bestScore: json['bestScore'] as int,
        rank: json['rank'] as int?,
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        league: json['league'] == null
            ? League.unranked
            : League.fromJson(json['league'] as Map<String, dynamic>),
        seasonGames: (json['seasonGames'] as num?)?.toInt() ?? 0,
        placementsLeft: (json['placementsLeft'] as num?)?.toInt() ?? 0,
        season: (json['season'] as num?)?.toInt() ?? 0,
        seasonEndsMs: (json['seasonEndsMs'] as num?)?.toInt() ?? 0,
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
    required this.rating,
    required this.league,
  });

  final int rank;
  final String id;
  final String nickname;
  final int trophies;
  final int games;
  final int wins;
  final int rating;
  final League league;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) => LeaderboardEntry(
        rank: json['rank'] as int,
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        trophies: json['trophies'] as int,
        games: json['games'] as int,
        wins: json['wins'] as int,
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        league: json['league'] == null
            ? League.unranked
            : League.fromJson(json['league'] as Map<String, dynamic>),
      );
}
