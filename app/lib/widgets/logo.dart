import 'dart:math';

import 'package:flutter/material.dart';

import '../theme.dart';

/// The mark: a gallery frame with one hand-drawn stroke inside it.
///
/// The idea is the whole game in one image — "grand" is the frame, and the
/// wobbly line in it is what you actually put there. It deliberately avoids
/// the mascot-and-bubble-letters look every other party game uses; a framed
/// squiggle reads at any size and doesn't look like anything else on a phone.
///
/// When [animate] is on, the stroke draws itself with a pencil at the tip,
/// which is the same trick the idle canvas uses. Off, it's a finished picture
/// suitable for a header.
class GrandCanvasLogo extends StatefulWidget {
  const GrandCanvasLogo({super.key, this.size = 140, this.animate = false});

  final double size;
  final bool animate;

  @override
  State<GrandCanvasLogo> createState() => _GrandCanvasLogoState();
}

class _GrandCanvasLogoState extends State<GrandCanvasLogo> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
      value: widget.animate ? 0 : 1,
    );
    if (widget.animate) {
      // A beat on the empty frame first, so you see it get filled.
      Future.delayed(const Duration(milliseconds: 260), () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: widget.size,
      child: CustomPaint(
        painter: _LogoPainter(progress: _controller, showPencil: widget.animate),
      ),
    );
  }
}

class _LogoPainter extends CustomPainter {
  _LogoPainter({required this.progress, required this.showPencil}) : super(repaint: progress);

  final Animation<double> progress;
  final bool showPencil;

  /// Deterministic hand-wobble, so the frame looks drawn rather than printed
  /// but never shimmers between repaints.
  static double _wobble(double t, int seed) =>
      sin(t * 11 + seed) * 0.004 + sin(t * 23 + seed * 2) * 0.002;

  Path _wobblyRect(Rect r, int seed) {
    final path = Path();
    final corners = [r.topLeft, r.topRight, r.bottomRight, r.bottomLeft, r.topLeft];
    for (var side = 0; side < 4; side++) {
      final a = corners[side];
      final b = corners[side + 1];
      final horizontal = (b.dx - a.dx).abs() > (b.dy - a.dy).abs();
      const steps = 14;
      for (var i = 0; i <= steps; i++) {
        final t = i / steps;
        final p = Offset.lerp(a, b, t)!;
        final off = _wobble(t + side, seed + side) * r.width;
        final q = horizontal ? Offset(p.dx, p.dy + off) : Offset(p.dx + off, p.dy);
        if (side == 0 && i == 0) {
          path.moveTo(q.dx, q.dy);
        } else {
          path.lineTo(q.dx, q.dy);
        }
      }
    }
    return path..close();
  }

  /// The stroke inside the frame: one confident sweep, like a horizon or a
  /// signature. Abstract enough to stay a "drawing" rather than becoming a
  /// picture of something.
  List<Offset> _strokePoints(Rect canvas) {
    const steps = 90;
    return [
      for (var i = 0; i <= steps; i++)
        () {
          final t = i / steps;
          // A rising sweep with a dip in it, plus hand tremor.
          final y = 0.72 - 0.42 * sin(t * pi * 0.92) - 0.14 * sin(t * pi * 2.1) * t;
          return Offset(
            canvas.left + canvas.width * (0.1 + 0.8 * t),
            canvas.top + canvas.height * (y + _wobble(t, 3)),
          );
        }(),
    ];
  }

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final outer = Rect.fromLTWH(s * 0.06, s * 0.10, s * 0.88, s * 0.80);
    final inner = outer.deflate(s * 0.075);

    // Halo, so the mark sits on the lit background rather than on top of it.
    canvas.drawRRect(
      RRect.fromRectAndRadius(outer, Radius.circular(s * 0.03)),
      Paint()
        ..color = GameColors.primary.withValues(alpha: 0.22)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, s * 0.09),
    );

    // The paper inside the frame.
    canvas.drawPath(_wobblyRect(inner, 11), Paint()..color = const Color(0xFFFAF3E3));

    // The frame: two hand-drawn lines, gallery-style.
    final frame = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = GameColors.primary
      ..strokeWidth = s * 0.045;
    canvas.drawPath(_wobblyRect(outer, 5), frame);
    canvas.drawPath(
      _wobblyRect(inner, 11),
      frame
        ..strokeWidth = s * 0.022
        ..color = GameColors.primaryDeep,
    );

    // The drawing, revealed left to right.
    final points = _strokePoints(inner);
    final shown = (points.length * progress.value).clamp(2, points.length).floor();
    if (shown >= 2) {
      final path = Path()..moveTo(points[0].dx, points[0].dy);
      for (var i = 1; i < shown; i++) {
        path.lineTo(points[i].dx, points[i].dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = const Color(0xFF1A1A1A)
          ..strokeWidth = s * 0.055,
      );

      // The pencil at the tip while it's still being drawn.
      if (showPencil && progress.value < 1) {
        final tip = points[shown - 1];
        final body = Offset(tip.dx - s * 0.1, tip.dy - s * 0.16);
        final pencil = Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..color = GameColors.primary
          ..strokeWidth = s * 0.05;
        canvas.drawLine(tip, body, pencil);
        canvas.drawCircle(tip, s * 0.018, Paint()..color = const Color(0xFF1A1A1A));
      }
    }
  }

  @override
  bool shouldRepaint(covariant _LogoPainter oldDelegate) => false;
}

/// "THE GRAND CANVAS", set as a small line over a large one so it reads as a
/// title rather than a sentence.
class GrandCanvasWordmark extends StatelessWidget {
  const GrandCanvasWordmark({super.key, this.scale = 1});

  final double scale;

  @override
  Widget build(BuildContext context) {
    // Just the two words. There used to be a small "THE" above them; it went
    // with the rename — nobody searches for an article, and a name people
    // can't find is a name they forget.
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'GRAND CANVAS',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 29 * scale,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.5 * scale,
            height: 1.05,
            color: GameColors.primary,
            shadows: [
              Shadow(color: GameColors.primary.withValues(alpha: 0.45), blurRadius: 18 * scale),
            ],
          ),
        ),
      ],
    );
  }
}
