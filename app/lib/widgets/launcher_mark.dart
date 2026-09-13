import 'dart:math';

import 'package:flutter/material.dart';

import '../theme.dart';

/// The mark on the phone's home screen: one fat brush stroke and three
/// splats of paint, on the game's yellow.
///
/// Different from the in-app logo on purpose. The framed squiggle works as a
/// header, but a frame inside the launcher's own rounded square read as a
/// box inside a box, and at 48px the thin frame lines went to mush. An icon
/// has one job: be recognised across a wallpaper at thumbnail size. Black
/// ink on yellow is the highest-contrast pair there is, a single sweep is
/// legible at any size, and the three splats say "paint" without a brush
/// or a palette, which every other drawing app already uses.
///
/// [withBackground] paints the yellow; off, the ink and paint sit on
/// transparency for the adaptive-icon foreground, which gets its own
/// background layer. Everything is placed inside the middle ~66% of the
/// square, the part every launcher mask keeps.
class LauncherMark extends StatelessWidget {
  const LauncherMark({super.key, this.size = 1024, this.withBackground = true});

  final double size;
  final bool withBackground;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _MarkPainter(withBackground: withBackground)),
    );
  }
}

class _MarkPainter extends CustomPainter {
  _MarkPainter({required this.withBackground});

  final bool withBackground;

  static const ink = Color(0xFF17131F);

  /// The stroke's spine: the brush lands bottom-left, sweeps up through a
  /// gentle S and flicks off top-right.
  static Offset _spine(double t) {
    const p0 = Offset(0.22, 0.52);
    const p1 = Offset(0.24, 0.36);
    const p2 = Offset(0.48, 0.92);
    const p3 = Offset(0.82, 0.30);
    final u = 1 - t;
    return p0 * (u * u * u) +
        p1 * (3 * u * u * t) +
        p2 * (3 * u * t * t) +
        p3 * (t * t * t);
  }

  /// Brush pressure: full where it lands, easing off to a point at the end
  /// like a real flick. A round dab at the start, a needle at the finish.
  static double _width(double t) => 0.13 * pow(1 - t, 0.55) + 0.018;

  /// Bristle roughness on the edges, fixed per position so it never shimmers.
  static double _rough(double t, int seed) =>
      (sin(t * 37 + seed) * 0.0015 + sin(t * 91 + seed * 3) * 0.001) * (1 - t);

  Path _brush(Size size) {
    const steps = 120;
    final left = <Offset>[];
    final right = <Offset>[];
    for (var i = 0; i <= steps; i++) {
      final t = i / steps;
      final p = _spine(t);
      final ahead = _spine(min(1, t + 0.005));
      final behind = _spine(max(0, t - 0.005));
      final dir = ahead - behind;
      final len = dir.distance == 0 ? 1 : dir.distance;
      final n = Offset(-dir.dy / len, dir.dx / len);
      final w = _width(t);
      left.add(p + n * (w / 2 + _rough(t, 1)));
      right.add(p - n * (w / 2 + _rough(t, 2)));
    }
    final s = size.shortestSide;
    Offset px(Offset o) => Offset(o.dx * s, o.dy * s);
    final path = Path()..moveTo(px(left.first).dx, px(left.first).dy);
    for (final o in left.skip(1)) {
      path.lineTo(px(o).dx, px(o).dy);
    }
    for (final o in right.reversed) {
      path.lineTo(px(o).dx, px(o).dy);
    }
    return path..close();
  }

  void _splat(
    Canvas canvas,
    double s,
    Offset c,
    double r,
    Color color,
    int seed,
  ) {
    final rng = Random(seed);
    final paint = Paint()..color = color;
    // The blob itself, slightly irregular.
    final blob = Path();
    const n = 28;
    for (var i = 0; i <= n; i++) {
      final a = i / n * 2 * pi;
      final rr =
          r * (1 + 0.10 * sin(a * 3 + seed) + 0.05 * sin(a * 7 + seed * 2));
      final p = Offset(c.dx + cos(a) * rr, c.dy + sin(a) * rr) * s;
      if (i == 0) {
        blob.moveTo(p.dx, p.dy);
      } else {
        blob.lineTo(p.dx, p.dy);
      }
    }
    canvas.drawPath(blob..close(), paint);
    // A few droplets flung off it.
    for (var i = 0; i < 4; i++) {
      final a = rng.nextDouble() * 2 * pi;
      final d = r * (1.6 + rng.nextDouble() * 1.4);
      final dr = r * (0.14 + rng.nextDouble() * 0.22);
      final p = Offset(c.dx + cos(a) * d, c.dy + sin(a) * d) * s;
      canvas.drawCircle(p, dr * s, paint);
    }
    // A glint so the paint looks wet.
    canvas.drawCircle(
      Offset(c.dx - r * 0.35, c.dy - r * 0.35) * s,
      r * 0.22 * s,
      Paint()..color = Colors.white.withValues(alpha: 0.55),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;

    if (withBackground) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()
          ..shader = RadialGradient(
            center: const Alignment(-0.3, -0.4),
            radius: 1.1,
            colors: const [
              GameColors.primaryBright,
              GameColors.primary,
              GameColors.primaryDeep,
            ],
            stops: const [0, 0.55, 1],
          ).createShader(Offset.zero & size),
      );
    }

    // Paint first, so the ink lands on top of it.
    _splat(canvas, s, const Offset(0.60, 0.25), 0.058, GameColors.pink, 3);
    _splat(canvas, s, const Offset(0.70, 0.70), 0.066, GameColors.cyan, 5);
    _splat(canvas, s, const Offset(0.30, 0.28), 0.036, GameColors.lime, 8);

    final brush = _brush(size);
    // A soft shadow lifts the ink off the yellow.
    final shadow = Paint()
      ..color = GameColors.primaryDeep.withValues(alpha: 0.55)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, s * 0.02);
    canvas.save();
    canvas.translate(s * 0.012, s * 0.018);
    canvas.drawPath(brush, shadow);
    canvas.drawCircle(_spine(0) * s, _width(0) / 2 * s, shadow);
    canvas.restore();

    final inkPaint = Paint()..color = ink;
    canvas.drawPath(brush, inkPaint);
    // The dab where the brush first touched: a round cap on the fat end.
    canvas.drawCircle(_spine(0) * s, _width(0) / 2 * s, inkPaint);
  }

  @override
  bool shouldRepaint(covariant _MarkPainter oldDelegate) =>
      oldDelegate.withBackground != withBackground;
}
