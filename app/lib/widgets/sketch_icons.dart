/// Small hand-drawn glyphs matching the game's own art style, used in place
/// of stock Material icons and emoji.
///
/// The game draws its logo, its bot homework and its paper procedurally —
/// nothing is a shipped image. Everywhere else still reached for
/// `Icon(Icons.xxx)` or a raw emoji, which reads as a different object next
/// to actual hand-drawn art. These glyphs use the same wobbly-pen technique
/// as `GrandCanvasLogo` (see widgets/logo.dart), just re-tuned: that formula's
/// amplitude is a fraction of a 140-168px logo, which comes out sub-pixel —
/// invisible — at 20px icon scale. The constants here are picked to keep the
/// tremor visible at icon size instead.
///
/// Everything is deterministic (a plain function of a fixed seed per glyph),
/// matching the "fixed seed so it doesn't shimmer between repaints" pattern
/// already used by paper_frame.dart and drawing_canvas.dart's paper texture —
/// there's no animation here, just an irregular static shape.
library;

import 'dart:math';
import 'package:flutter/material.dart';

import '../theme.dart';

/// The tremor itself: two out-of-phase sine waves, same shape as the logo's
/// formula. [t] is progress along a path segment; the seed varies the phase
/// so different glyphs (and different segments of the same glyph) don't wobble
/// in lockstep.
double sketchWobble(double t, int seed, {double amp = 1}) =>
    (sin(t * 11 + seed) * 0.6 + sin(t * 23 + seed * 2) * 0.4) * amp;

Offset _pt(Rect box, double fx, double fy) =>
    Offset(box.left + box.width * fx, box.top + box.height * fy);

double _boldW(Size s) => (s.shortestSide / 24) * 2.6;
double _thinW(Size s) => (s.shortestSide / 24) * 1.6;

Paint _strokePaint(Color c, double w) => Paint()
  ..color = c
  ..style = PaintingStyle.stroke
  ..strokeWidth = w
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round;

Paint _fillPaint(Color c, {double alpha = 1}) => Paint()
  ..color = c.withValues(alpha: alpha)
  ..style = PaintingStyle.fill;

/// Walks a polyline through [anchors] with perpendicular wobble on every
/// segment — the same technique as the logo's `_wobblyRect`, generalized to
/// any point list rather than just a rectangle's four corners.
Path wobblyPath(
  List<Offset> anchors, {
  required int seed,
  bool close = false,
  double amp = 1.4,
  int stepsPerSegment = 6,
}) {
  final pts = close ? [...anchors, anchors.first] : anchors;
  final path = Path();
  for (var seg = 0; seg < pts.length - 1; seg++) {
    final a = pts[seg];
    final b = pts[seg + 1];
    final dx = b.dx - a.dx, dy = b.dy - a.dy;
    final len = max(sqrt(dx * dx + dy * dy), 0.0001);
    final px = -dy / len, py = dx / len;
    for (var i = 0; i <= stepsPerSegment; i++) {
      if (seg > 0 && i == 0) continue; // no duplicate point at segment joins
      final t = i / stepsPerSegment;
      final p = Offset.lerp(a, b, t)!;
      final off = sketchWobble(t + seg * 0.7, seed + seg, amp: amp);
      final q = Offset(p.dx + px * off, p.dy + py * off);
      if (seg == 0 && i == 0) {
        path.moveTo(q.dx, q.dy);
      } else {
        path.lineTo(q.dx, q.dy);
      }
    }
  }
  if (close) path.close();
  return path;
}

/// A closed, slightly irregular disc — the same "radius breathing" idea as
/// the server doodle engine's `pen.ellipse()`, so coins, medals and clock
/// faces read as drawn rather than a perfect vector circle.
Path wobblyDisc(Offset center, double radius, {required int seed, double amp = 0.05, int steps = 40}) {
  final path = Path();
  for (var i = 0; i <= steps; i++) {
    final t = i / steps;
    final ang = t * 2 * pi;
    final rWob = radius * (1 + sin(ang * 2 + seed) * amp + sin(ang * 3 + seed * 2) * amp * 0.5);
    final p = Offset(center.dx + cos(ang) * rWob, center.dy + sin(ang) * rWob);
    if (i == 0) {
      path.moveTo(p.dx, p.dy);
    } else {
      path.lineTo(p.dx, p.dy);
    }
  }
  path.close();
  return path;
}

List<Offset> _starPoints(Rect box, {required int points, required double innerRatio, double rotation = -pi / 2}) {
  final cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  final rOuter = box.shortestSide / 2;
  final rInner = rOuter * innerRatio;
  return [
    for (var i = 0; i < points * 2; i++)
      () {
        final ang = rotation + (i / (points * 2)) * 2 * pi;
        final r = i.isEven ? rOuter : rInner;
        return Offset(cx + cos(ang) * r, cy + sin(ang) * r);
      }(),
  ];
}

enum SketchGlyph { trophy, lock, lockOpen, star, medal, coin, pencil, palette, sparkle, clock, plus, minus, undo, eraser }

/// A hand-drawn glyph, sized and coloured like any other icon.
class SketchIcon extends StatelessWidget {
  const SketchIcon(this.glyph, {super.key, this.size = 20, this.color = GameColors.textPrimary});

  final SketchGlyph glyph;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _SketchPainter(glyph: glyph, color: color)),
    );
  }
}

/// A thin wobbly ring around [child] — the logo's own "frame around a mark"
/// idea, applied to a player avatar instead of the game's title mark.
class SketchFrame extends StatelessWidget {
  const SketchFrame({super.key, required this.radius, this.color = GameColors.primary, required this.child});

  final double radius;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final d = (radius + 4) * 2;
    return SizedBox.square(
      dimension: d,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(size: Size.square(d), painter: _RingPainter(color)),
          child,
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.shortestSide / 2 - 1.6;
    canvas.drawPath(
      wobblyDisc(size.center(Offset.zero), r, seed: 9, amp: 0.035),
      _strokePaint(color, size.shortestSide / 11),
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) => oldDelegate.color != color;
}

class _SketchPainter extends CustomPainter {
  _SketchPainter({required this.glyph, required this.color});
  final SketchGlyph glyph;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    switch (glyph) {
      case SketchGlyph.trophy:
        _trophy(canvas, size);
      case SketchGlyph.lock:
        _lock(canvas, size, open: false);
      case SketchGlyph.lockOpen:
        _lock(canvas, size, open: true);
      case SketchGlyph.star:
        _star(canvas, size);
      case SketchGlyph.medal:
        _medal(canvas, size);
      case SketchGlyph.coin:
        _coin(canvas, size);
      case SketchGlyph.pencil:
        _pencil(canvas, size);
      case SketchGlyph.palette:
        _palette(canvas, size);
      case SketchGlyph.sparkle:
        _sparkle(canvas, size);
      case SketchGlyph.clock:
        _clock(canvas, size);
      case SketchGlyph.plus:
        _plusMinus(canvas, size, plus: true);
      case SketchGlyph.minus:
        _plusMinus(canvas, size, plus: false);
      case SketchGlyph.undo:
        _undo(canvas, size);
      case SketchGlyph.eraser:
        _eraser(canvas, size);
    }
  }

  Rect _box(Size s, [double pad = 0.1]) =>
      Rect.fromLTWH(s.width * pad, s.height * pad, s.width * (1 - 2 * pad), s.height * (1 - 2 * pad));

  void _trophy(Canvas canvas, Size s) {
    final box = _box(s, 0.08);
    final bold = _strokePaint(color, _boldW(s));
    final thin = _strokePaint(color, _thinW(s));
    final fill = _fillPaint(color, alpha: 0.18);

    final bowl = wobblyPath(
      [_pt(box, 0.22, 0.06), _pt(box, 0.78, 0.06), _pt(box, 0.64, 0.56), _pt(box, 0.36, 0.56)],
      seed: 1,
      close: true,
      amp: s.shortestSide * 0.012,
    );
    canvas.drawPath(bowl, fill);
    canvas.drawPath(bowl, bold);

    canvas.drawPath(
      wobblyPath([_pt(box, 0.22, 0.16), _pt(box, 0.03, 0.24), _pt(box, 0.03, 0.4), _pt(box, 0.24, 0.46)],
          seed: 2, amp: s.shortestSide * 0.012),
      thin,
    );
    canvas.drawPath(
      wobblyPath([_pt(box, 0.78, 0.16), _pt(box, 0.97, 0.24), _pt(box, 0.97, 0.4), _pt(box, 0.76, 0.46)],
          seed: 3, amp: s.shortestSide * 0.012),
      thin,
    );

    canvas.drawPath(
      wobblyPath([_pt(box, 0.5, 0.56), _pt(box, 0.5, 0.7)], seed: 4, amp: s.shortestSide * 0.01),
      thin,
    );

    final base = wobblyPath(
      [_pt(box, 0.3, 0.7), _pt(box, 0.7, 0.7), _pt(box, 0.64, 0.86), _pt(box, 0.36, 0.86)],
      seed: 5,
      close: true,
      amp: s.shortestSide * 0.012,
    );
    canvas.drawPath(base, fill);
    canvas.drawPath(base, bold);
  }

  void _lock(Canvas canvas, Size s, {required bool open}) {
    final box = _box(s, 0.1);
    final bold = _strokePaint(color, _boldW(s));
    final thin = _strokePaint(color, _thinW(s));

    final shackle = open
        ? [_pt(box, 0.28, 0.42), _pt(box, 0.28, 0.22), _pt(box, 0.5, 0.08), _pt(box, 0.7, 0.16), _pt(box, 0.78, 0.32)]
        : [_pt(box, 0.3, 0.42), _pt(box, 0.3, 0.24), _pt(box, 0.5, 0.1), _pt(box, 0.7, 0.24), _pt(box, 0.7, 0.42)];
    canvas.drawPath(wobblyPath(shackle, seed: 6, amp: s.shortestSide * 0.012), thin);

    final body = wobblyPath(
      [_pt(box, 0.18, 0.42), _pt(box, 0.82, 0.42), _pt(box, 0.82, 0.9), _pt(box, 0.18, 0.9)],
      seed: 7,
      close: true,
      amp: s.shortestSide * 0.012,
    );
    canvas.drawPath(body, _fillPaint(color, alpha: 0.16));
    canvas.drawPath(body, bold);

    if (!open) {
      canvas.drawCircle(_pt(box, 0.5, 0.6), s.shortestSide * 0.05, _fillPaint(color));
      canvas.drawPath(
        wobblyPath([_pt(box, 0.5, 0.66), _pt(box, 0.5, 0.78)], seed: 8, amp: s.shortestSide * 0.008),
        thin,
      );
    }
  }

  void _star(Canvas canvas, Size s) {
    final pts = _starPoints(_box(s, 0.06), points: 5, innerRatio: 0.44);
    final path = wobblyPath(pts, seed: 10, close: true, amp: s.shortestSide * 0.012, stepsPerSegment: 3);
    canvas.drawPath(path, _fillPaint(color, alpha: 0.85));
    canvas.drawPath(path, _strokePaint(color, _thinW(s)));
  }

  void _medal(Canvas canvas, Size s) {
    // Simpler and bolder than a first pass: a thin inner highlight ring read
    // as a faint outline rather than a medal at the ~22-26px this actually
    // ships at. The colour alone (gold/silver/bronze) carries the "which
    // place" meaning, so the disc doesn't need internal detail to earn its
    // keep — it needs to be unmistakably a solid disc.
    final box = _box(s, 0.12);
    final center = _pt(box, 0.5, 0.64);
    final r = box.shortestSide * 0.38;

    canvas.drawPath(
      wobblyPath([_pt(box, 0.32, 0.38), _pt(box, 0.46, 0), _pt(box, 0.44, 0.44)],
          seed: 11, close: true, amp: s.shortestSide * 0.01),
      _fillPaint(color, alpha: 0.92),
    );
    canvas.drawPath(
      wobblyPath([_pt(box, 0.68, 0.38), _pt(box, 0.54, 0), _pt(box, 0.56, 0.44)],
          seed: 12, close: true, amp: s.shortestSide * 0.01),
      _fillPaint(color, alpha: 0.92),
    );

    final disc = wobblyDisc(center, r, seed: 13, amp: 0.04);
    canvas.drawPath(disc, _fillPaint(color, alpha: 0.96));
    canvas.drawPath(disc, _strokePaint(color, _boldW(s) * 0.75));
  }

  void _coin(Canvas canvas, Size s) {
    final box = _box(s, 0.08);
    final center = _pt(box, 0.5, 0.5);
    final r = box.shortestSide * 0.42;

    final disc = wobblyDisc(center, r, seed: 14, amp: 0.045);
    canvas.drawPath(disc, _fillPaint(color, alpha: 0.22));
    canvas.drawPath(disc, _strokePaint(color, _boldW(s)));

    canvas.drawPath(
      wobblyPath(
        [_pt(box, 0.62, 0.34), _pt(box, 0.38, 0.4), _pt(box, 0.62, 0.5), _pt(box, 0.38, 0.6), _pt(box, 0.62, 0.66)],
        seed: 15,
        amp: s.shortestSide * 0.01,
        stepsPerSegment: 3,
      ),
      _strokePaint(color, _thinW(s)),
    );
    canvas.drawPath(
      wobblyPath([_pt(box, 0.5, 0.26), _pt(box, 0.5, 0.74)], seed: 16, amp: s.shortestSide * 0.006),
      _strokePaint(color, _thinW(s) * 0.7),
    );
  }

  void _pencil(Canvas canvas, Size s) {
    final box = _box(s, 0.12);
    final tip = _pt(box, 0.14, 0.9);
    final body = _pt(box, 0.78, 0.16);
    final shaft = _strokePaint(color, _boldW(s) * 1.35);
    canvas.drawPath(wobblyPath([tip, body], seed: 17, amp: s.shortestSide * 0.012), shaft);

    final dark = _fillPaint(const Color(0xFF1A1A1A));
    canvas.drawCircle(tip, s.shortestSide * 0.035, dark);

    final dx = body.dx - tip.dx, dy = body.dy - tip.dy;
    final len = sqrt(dx * dx + dy * dy);
    final ux = dx / len, uy = dy / len;
    final capCenter = Offset(body.dx - ux * s.shortestSide * 0.06, body.dy - uy * s.shortestSide * 0.06);
    canvas.drawPath(
      wobblyPath(
        [Offset(capCenter.dx - uy * s.shortestSide * 0.08, capCenter.dy + ux * s.shortestSide * 0.08),
         Offset(capCenter.dx + uy * s.shortestSide * 0.08, capCenter.dy - ux * s.shortestSide * 0.08)],
        seed: 18,
        amp: s.shortestSide * 0.008,
      ),
      _strokePaint(color, _thinW(s)),
    );
  }

  void _palette(Canvas canvas, Size s) {
    final box = _box(s, 0.08);
    final blob = wobblyPath(
      [
        _pt(box, 0.5, 0.08), _pt(box, 0.82, 0.2), _pt(box, 0.92, 0.46), _pt(box, 0.8, 0.7),
        _pt(box, 0.58, 0.86), _pt(box, 0.4, 0.74), _pt(box, 0.14, 0.62), _pt(box, 0.1, 0.32),
        _pt(box, 0.28, 0.14),
      ],
      seed: 19,
      close: true,
      amp: s.shortestSide * 0.012,
    );
    final hole = Path()..addOval(Rect.fromCircle(center: _pt(box, 0.58, 0.68), radius: s.shortestSide * 0.07));
    final withHole = Path.combine(PathOperation.difference, blob, hole);

    canvas.drawPath(withHole, _fillPaint(color, alpha: 0.18));
    canvas.drawPath(withHole, _strokePaint(color, _boldW(s)));

    const dabColors = [GameColors.pink, GameColors.cyan, GameColors.lime, GameColors.primary];
    const dabSpots = [(0.36, 0.34), (0.58, 0.26), (0.72, 0.44), (0.42, 0.5)];
    for (var i = 0; i < dabSpots.length; i++) {
      canvas.drawCircle(_pt(box, dabSpots[i].$1, dabSpots[i].$2), s.shortestSide * 0.06, _fillPaint(dabColors[i]));
    }
  }

  void _sparkle(Canvas canvas, Size s) {
    final main = _box(s, 0.14);
    final mainPts = _starPoints(main, points: 4, innerRatio: 0.26);
    canvas.drawPath(
      wobblyPath(mainPts, seed: 20, close: true, amp: s.shortestSide * 0.01, stepsPerSegment: 3),
      _fillPaint(color, alpha: 0.9),
    );

    final small = Rect.fromCenter(
      center: _pt(main, 0.86, 0.2),
      width: main.width * 0.32,
      height: main.height * 0.32,
    );
    final smallPts = _starPoints(small, points: 4, innerRatio: 0.26);
    canvas.drawPath(
      wobblyPath(smallPts, seed: 21, close: true, amp: s.shortestSide * 0.006, stepsPerSegment: 3),
      _fillPaint(color, alpha: 0.7),
    );
  }

  void _clock(Canvas canvas, Size s) {
    final box = _box(s, 0.08);
    final center = _pt(box, 0.5, 0.5);
    final r = box.shortestSide * 0.44;

    final face = wobblyDisc(center, r, seed: 22, amp: 0.04);
    canvas.drawPath(face, _fillPaint(color, alpha: 0.12));
    canvas.drawPath(face, _strokePaint(color, _boldW(s)));

    canvas.drawPath(
      wobblyPath([center, Offset(center.dx, center.dy - r * 0.5)], seed: 23, amp: s.shortestSide * 0.008),
      _strokePaint(color, _thinW(s) * 1.3),
    );
    canvas.drawPath(
      wobblyPath([center, Offset(center.dx + r * 0.62, center.dy - r * 0.18)], seed: 24, amp: s.shortestSide * 0.008),
      _strokePaint(color, _thinW(s)),
    );
    canvas.drawCircle(center, s.shortestSide * 0.025, _fillPaint(color));
  }

  void _plusMinus(Canvas canvas, Size s, {required bool plus}) {
    final box = _box(s, 0.16);
    final bold = _strokePaint(color, _boldW(s));
    canvas.drawPath(
      wobblyPath([_pt(box, 0.06, 0.5), _pt(box, 0.94, 0.5)], seed: 25, amp: s.shortestSide * 0.012),
      bold,
    );
    if (plus) {
      canvas.drawPath(
        wobblyPath([_pt(box, 0.5, 0.06), _pt(box, 0.5, 0.94)], seed: 26, amp: s.shortestSide * 0.012),
        bold,
      );
    }
  }

  void _undo(Canvas canvas, Size s) {
    final box = _box(s, 0.1);
    final center = _pt(box, 0.5, 0.56);
    final r = box.shortestSide * 0.36;
    const startAngle = -0.5;
    const endAngle = 3.6; // sweeps most of the way around, counter-clockwise read

    final path = Path();
    const steps = 28;
    for (var i = 0; i <= steps; i++) {
      final t = i / steps;
      final ang = startAngle + (endAngle - startAngle) * t;
      final rWob = r * (1 + sin(ang * 2 + 27) * 0.03);
      final p = Offset(center.dx + cos(ang) * rWob, center.dy + sin(ang) * rWob);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    final bold = _strokePaint(color, _boldW(s));
    canvas.drawPath(path, bold);

    final headAngle = endAngle;
    final headCenter = Offset(center.dx + cos(headAngle) * r, center.dy + sin(headAngle) * r);
    final tangent = headAngle + pi / 2;
    final headPaint = _strokePaint(color, _boldW(s) * 1.15);
    for (final spread in [0.8, -0.8]) {
      final a = tangent + pi + spread;
      canvas.drawLine(
        headCenter,
        Offset(headCenter.dx + cos(a) * r * 0.55, headCenter.dy + sin(a) * r * 0.55),
        headPaint,
      );
    }
  }

  void _eraser(Canvas canvas, Size s) {
    final box = _box(s, 0.12);
    final body = wobblyPath(
      [_pt(box, 0.18, 0.28), _pt(box, 0.82, 0.28), _pt(box, 0.72, 0.86), _pt(box, 0.1, 0.86)],
      seed: 28,
      close: true,
      amp: s.shortestSide * 0.012,
    );
    canvas.drawPath(body, _fillPaint(color, alpha: 0.2));
    canvas.drawPath(body, _strokePaint(color, _boldW(s)));

    canvas.drawPath(
      wobblyPath([_pt(box, 0.42, 0.28), _pt(box, 0.54, 0.42)], seed: 29, amp: s.shortestSide * 0.008),
      _strokePaint(color, _thinW(s)),
    );
    for (final spot in [(0.86, 0.7), (0.92, 0.8)]) {
      canvas.drawPath(
        wobblyPath(
          [_pt(box, spot.$1, spot.$2), _pt(box, spot.$1 + 0.05, spot.$2 + 0.04)],
          seed: 30,
          amp: s.shortestSide * 0.006,
        ),
        _strokePaint(color, _thinW(s) * 0.7),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SketchPainter oldDelegate) =>
      oldDelegate.glyph != glyph || oldDelegate.color != color;
}
