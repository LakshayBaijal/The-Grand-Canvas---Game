import 'dart:math';

import 'package:flutter/material.dart';

/// Wraps [child] so it reads as a real piece of paper sitting on a desk —
/// slightly tilted, torn edges, a shadow that follows the torn silhouette,
/// and a couple of "taped down" corners — instead of a plain rectangle.
///
/// [seed] varies the tilt direction and the torn-edge jitter per drawing, so
/// not every piece of paper looks identically cut.
class PaperCanvas extends StatelessWidget {
  const PaperCanvas({super.key, required this.child, this.seed = 0});

  final Widget child;
  final int seed;

  @override
  Widget build(BuildContext context) {
    final rnd = Random(seed);
    final tiltSign = seed.isEven ? 1.0 : -1.0;
    final angle = tiltSign * (0.018 + rnd.nextDouble() * 0.02); // ~1-2.3°

    return Transform.rotate(
      angle: angle,
      child: Stack(
        clipBehavior: Clip.none,
        fit: StackFit.expand,
        children: [
          PhysicalShape(
            clipper: _TornEdgeClipper(seed: seed),
            color: Colors.transparent,
            elevation: 10,
            shadowColor: Colors.black,
            child: child,
          ),
          Positioned(top: -8, left: 22, child: _TapeStrip(angle: -0.16 + rnd.nextDouble() * 0.1)),
          Positioned(top: -8, right: 22, child: _TapeStrip(angle: 0.16 - rnd.nextDouble() * 0.1)),
        ],
      ),
    );
  }
}

class _TapeStrip extends StatelessWidget {
  const _TapeStrip({required this.angle});

  final double angle;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: angle,
      child: Container(
        width: 48,
        height: 20,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.32),
          border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 3, offset: const Offset(0, 1)),
          ],
        ),
      ),
    );
  }
}

/// A jagged, hand-torn-looking rectangle instead of a crisp one.
class _TornEdgeClipper extends CustomClipper<Path> {
  const _TornEdgeClipper({required this.seed});

  final int seed;

  static const _jag = 5.0;
  static const _step = 18.0;

  @override
  Path getClip(Size size) {
    final rnd = Random(seed * 7919 + 101);
    final points = <Offset>[];

    void addEdge(Offset a, Offset b) {
      final steps = ((a - b).distance / _step).round().clamp(2, 100);
      final alongX = (b.dx - a.dx).abs() > (b.dy - a.dy).abs();
      for (var i = 0; i < steps; i++) {
        final t = i / steps;
        final p = Offset.lerp(a, b, t)!;
        final jitter = (rnd.nextDouble() - 0.5) * 2 * _jag;
        points.add(alongX ? Offset(p.dx, p.dy + jitter) : Offset(p.dx + jitter, p.dy));
      }
    }

    final w = size.width, h = size.height;
    addEdge(const Offset(0, 0), Offset(w, 0));
    addEdge(Offset(w, 0), Offset(w, h));
    addEdge(Offset(w, h), Offset(0, h));
    addEdge(Offset(0, h), const Offset(0, 0));

    return Path()..addPolygon(points, true);
  }

  @override
  bool shouldReclip(covariant _TornEdgeClipper oldClipper) => oldClipper.seed != seed;
}

/// A warm little "wooden desk" the paper sits on, so the drawing area reads
/// as a real place rather than a UI panel.
class DeskBackdrop extends StatelessWidget {
  const DeskBackdrop({super.key, required this.child, this.padding = 22});

  final Widget child;

  /// How much desk shows around the paper. Worth shrinking on the small idle
  /// canvases, where the default leaves the drawing itself postage-stamp-sized.
  final double padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF5B3A29), Color(0xFF3B2216)],
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 8)),
        ],
      ),
      child: CustomPaint(painter: _WoodGrainPainter(), child: child),
    );
  }
}

class _WoodGrainPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rnd = Random(11);
    final grain = Paint()
      ..color = Colors.black.withValues(alpha: 0.12)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < 10; i++) {
      final y = (i + 0.5) / 10 * size.height + (rnd.nextDouble() - 0.5) * 10;
      final path = Path()..moveTo(0, y);
      for (double x = 0; x <= size.width; x += 24) {
        path.lineTo(x, y + sin((x / size.width) * pi * 3 + i) * 3);
      }
      canvas.drawPath(path, grain);
    }
  }

  @override
  bool shouldRepaint(covariant _WoodGrainPainter oldDelegate) => false;
}
