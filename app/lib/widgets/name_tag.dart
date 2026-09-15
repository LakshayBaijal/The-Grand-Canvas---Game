import 'package:flutter/material.dart';

import '../theme.dart';

/// The trophy tier a player is in. Derived from their trophy count on the
/// server, never floored: fall below the line and the badge goes with you.
enum Tier {
  bronze,
  silver,
  gold;

  static Tier fromId(String? id) => switch (id) {
        'silver' => Tier.silver,
        'gold' => Tier.gold,
        _ => Tier.bronze,
      };

  Color get color => switch (this) {
        Tier.bronze => const Color(0xFFC77B3A),
        Tier.silver => const Color(0xFFC9CDD6),
        Tier.gold => const Color(0xFFFFC53D),
      };

  Color get shade => switch (this) {
        Tier.bronze => const Color(0xFF7A4520),
        Tier.silver => const Color(0xFF6E7480),
        Tier.gold => const Color(0xFFA36F00),
      };

  String get label => switch (this) {
        Tier.bronze => 'Bronze',
        Tier.silver => 'Silver',
        Tier.gold => 'Gold',
      };
}

/// A player's name with the things worth flexing next to it: the tier medal
/// in front, and a crown after it for Grand Pass owners. Used everywhere a
/// name is shown to *other* people -- the lobby, the vote, the reveal, the
/// scoreboard, the leaderboard -- because a badge nobody else sees is not
/// a badge.
class NameTag extends StatelessWidget {
  const NameTag({
    super.key,
    required this.name,
    this.tier,
    this.crown = false,
    this.style,
    this.prefix = '',
    this.maxLines = 1,
    this.textAlign = TextAlign.start,
    this.badgeSize,
  });

  final String name;
  final String? tier;
  final bool crown;
  final TextStyle? style;

  /// Text before the medal, e.g. 'by '.
  final String prefix;
  final int maxLines;
  final TextAlign textAlign;

  /// Defaults to the font size, so the medal sits like a character.
  final double? badgeSize;

  @override
  Widget build(BuildContext context) {
    final resolved = DefaultTextStyle.of(context).style.merge(style);
    final size = badgeSize ?? (resolved.fontSize ?? 14) * 1.05;
    return Text.rich(
      TextSpan(
        style: resolved,
        children: [
          if (prefix.isNotEmpty) TextSpan(text: prefix),
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: EdgeInsets.only(right: size * 0.3),
              child: TierMedal(tier: Tier.fromId(tier), size: size),
            ),
          ),
          TextSpan(text: name),
          if (crown)
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: EdgeInsets.only(left: size * 0.3),
                child: CrownMark(size: size),
              ),
            ),
        ],
      ),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      textAlign: textAlign,
    );
  }
}

/// A small round medal in the tier's metal.
class TierMedal extends StatelessWidget {
  const TierMedal({super.key, required this.tier, this.size = 14});

  final Tier tier;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${tier.label} tier',
      child: CustomPaint(
        size: Size(size, size * 1.15),
        painter: _MedalPainter(tier),
      ),
    );
  }
}

class _MedalPainter extends CustomPainter {
  const _MedalPainter(this.tier);

  final Tier tier;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Ribbon: two short tails behind the disc.
    final ribbon = Paint()..color = tier.shade;
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.3, 0)
        ..lineTo(w * 0.5, h * 0.4)
        ..lineTo(w * 0.7, 0)
        ..lineTo(w * 0.85, 0)
        ..lineTo(w * 0.5, h * 0.55)
        ..lineTo(w * 0.15, 0)
        ..close(),
      ribbon,
    );
    // Disc with a darker rim and a bright glint.
    final c = Offset(w * 0.5, h * 0.66);
    final r = w * 0.34;
    canvas.drawCircle(c, r, Paint()..color = tier.shade);
    canvas.drawCircle(c, r * 0.82, Paint()..color = tier.color);
    canvas.drawCircle(
      c.translate(-r * 0.25, -r * 0.25),
      r * 0.22,
      Paint()..color = Colors.white.withValues(alpha: 0.7),
    );
  }

  @override
  bool shouldRepaint(_MedalPainter old) => old.tier != tier;
}

/// The Grand Pass crown.
class CrownMark extends StatelessWidget {
  const CrownMark({super.key, this.size = 14});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Grand Pass',
      child: CustomPaint(
        size: Size(size * 1.15, size),
        painter: const _CrownPainter(),
      ),
    );
  }
}

class _CrownPainter extends CustomPainter {
  const _CrownPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final body = Path()
      ..moveTo(w * 0.05, h * 0.9)
      ..lineTo(w * 0.05, h * 0.3)
      ..lineTo(w * 0.3, h * 0.55)
      ..lineTo(w * 0.5, h * 0.08)
      ..lineTo(w * 0.7, h * 0.55)
      ..lineTo(w * 0.95, h * 0.3)
      ..lineTo(w * 0.95, h * 0.9)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color(0xFFFFC53D));
    canvas.drawPath(
      body,
      Paint()
        ..color = const Color(0xFFA36F00)
        ..style = PaintingStyle.stroke
        ..strokeWidth = h * 0.09
        ..strokeJoin = StrokeJoin.round,
    );
    // Jewels.
    final jewel = Paint()..color = GameColors.pink;
    canvas.drawCircle(Offset(w * 0.5, h * 0.62), h * 0.1, jewel);
    canvas.drawCircle(Offset(w * 0.22, h * 0.7), h * 0.07, jewel);
    canvas.drawCircle(Offset(w * 0.78, h * 0.7), h * 0.07, jewel);
  }

  @override
  bool shouldRepaint(_CrownPainter old) => false;
}
