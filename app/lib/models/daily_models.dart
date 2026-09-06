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
      );
}
