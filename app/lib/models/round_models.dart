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

class InvestorShare {
  const InvestorShare({required this.name, required this.amount});

  final String name;
  final int amount;

  factory InvestorShare.fromJson(Map<String, dynamic> json) =>
      InvestorShare(name: json['name'] as String, amount: json['amount'] as int);
}

class InvestmentResult {
  const InvestmentResult({
    required this.artistId,
    required this.artistName,
    required this.title,
    required this.strokes,
    required this.totalInvested,
    required this.investors,
  });

  final String artistId;
  final String artistName;
  final String title;
  final List<Stroke> strokes;
  final int totalInvested;
  final List<InvestorShare> investors;

  factory InvestmentResult.fromJson(Map<String, dynamic> json) => InvestmentResult(
        artistId: json['artistId'] as String,
        artistName: json['artistName'] as String,
        title: json['title'] as String,
        strokes: (json['strokes'] as List)
            .map((s) => Stroke.fromJson(s as Map<String, dynamic>))
            .toList(),
        totalInvested: json['totalInvested'] as int,
        investors: (json['investors'] as List)
            .map((i) => InvestorShare.fromJson(i as Map<String, dynamic>))
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
