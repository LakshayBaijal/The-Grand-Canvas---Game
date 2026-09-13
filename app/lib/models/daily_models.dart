import 'stroke.dart';
import 'styles.dart';

/// One drawing in a day's gallery.
class DailyEntry {
  const DailyEntry({
    required this.id,
    required this.day,
    required this.artistId,
    required this.artistName,
    required this.title,
    required this.strokes,
    required this.createdMs,
    this.paper = PaperStyle.plain,
    this.hearts = 0,
    this.heartedByMe = false,
    this.rank,
  });

  final int id;

  /// Whole days since the epoch, UTC — the key a gallery hangs off.
  final int day;
  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;
  final PaperStyle paper;
  final int createdMs;

  /// Hearts from other players. One each, and never taken back.
  final int hearts;

  /// Whether this player already gave theirs.
  final bool heartedByMe;

  /// 1, 2 or 3 when this is one of the day's most-hearted drawings.
  final int? rank;

  /// The day as a calendar date (UTC — the day rolls over at midnight UTC).
  DateTime get date => DateTime.utc(1970).add(Duration(days: day));

  DailyEntry copyWith({int? hearts, bool? heartedByMe, int? rank}) => DailyEntry(
        id: id,
        day: day,
        artistId: artistId,
        artistName: artistName,
        title: title,
        strokes: strokes,
        createdMs: createdMs,
        paper: paper,
        hearts: hearts ?? this.hearts,
        heartedByMe: heartedByMe ?? this.heartedByMe,
        rank: rank ?? this.rank,
      );

  factory DailyEntry.fromJson(Map<String, dynamic> json) => DailyEntry(
        id: json['id'] as int,
        day: json['day'] as int,
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        paper: PaperStyle.fromId(json['paper'] as String?),
        strokes: (json['strokes'] as List)
            .map((s) => Stroke.fromJson(s as Map<String, dynamic>))
            .toList(),
        createdMs: json['createdMs'] as int,
        hearts: json['hearts'] as int? ?? 0,
        heartedByMe: json['heartedByMe'] as bool? ?? false,
        rank: json['rank'] as int?,
      );
}

/// One finished day in the Hall of Fame: its prompt and its top three.
class HallDay {
  const HallDay({required this.day, required this.prompt, required this.top});

  final int day;
  final String prompt;

  /// Best first, with [DailyEntry.rank] set.
  final List<DailyEntry> top;

  DateTime get date => DateTime.utc(1970).add(Duration(days: day));

  factory HallDay.fromJson(Map<String, dynamic> json) => HallDay(
        day: json['day'] as int,
        prompt: json['prompt'] as String,
        top: (json['top'] as List)
            .map((e) => DailyEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Trophies paid to a day's top three, best first. Mirrors DAILY_TROPHIES on
/// the server; shown in the app so the prize is a promise, not a surprise.
const dailyTrophies = [60, 40, 25];
