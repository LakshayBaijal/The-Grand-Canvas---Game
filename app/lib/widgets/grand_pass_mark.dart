import 'dart:math';

import 'package:flutter/material.dart';

/// The Grand Pass emblem: a gold laurel wreath around a crown with three
/// pink gems. The thing a pass owner wears next to their name.
///
/// Drawn, not shipped as an image, so it is crisp beside 11pt text and at
/// the top of the pass sheet alike, and so it is ours. Gold on the wreath
/// and the crown, and a dark keyline so it holds up on the paper-coloured
/// backgrounds as well as the dark ones.
class GrandPassMark extends StatelessWidget {
  const GrandPassMark({super.key, this.size = 14});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Grand Pass',
      child: CustomPaint(size: Size(size * 1.25, size), painter: const _MarkPainter()),
    );
  }
}

class _MarkPainter extends CustomPainter {
  const _MarkPainter();

  static const gold = Color(0xFFFFC53D);
  static const goldDeep = Color(0xFFB8860B);
  static const gem = Color(0xFFFF4F9A);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final c = Offset(w / 2, h * 0.56);

    // Laurel: two arcs of little leaves, mirrored.
    final leaf = Paint()..color = gold;
    final vein = Paint()
      ..color = goldDeep
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.05;
    // Each side is an arc from the bottom centre up to about ten o'clock /
    // two o'clock; the leaves lie along the arc, tips pointing up, so the
    // two arcs read as one wreath cupping the crown rather than as rays.
    for (final side in [-1.0, 1.0]) {
      for (var i = 0; i < 5; i++) {
        final a = pi / 2 + side * (0.28 + i * 0.3);
        final r = w * 0.42;
        final p = Offset(c.dx + cos(a) * r, c.dy + sin(a) * r * 0.9);
        final ang = a + pi / 2;
        canvas.save();
        canvas.translate(p.dx, p.dy);
        canvas.rotate(ang);
        final leafPath = Path()
          ..moveTo(0, -h * 0.13)
          ..quadraticBezierTo(h * 0.09, 0, 0, h * 0.13)
          ..quadraticBezierTo(-h * 0.09, 0, 0, -h * 0.13)
          ..close();
        canvas.drawPath(leafPath, leaf);
        canvas.drawLine(Offset(0, -h * 0.11), Offset(0, h * 0.11), vein);
        canvas.restore();
      }
    }

    // Crown.
    final cw = w * 0.44;
    final ch = h * 0.46;
    final left = c.dx - cw / 2;
    final top = c.dy - ch * 0.55;
    final crown = Path()
      ..moveTo(left, top + ch)
      ..lineTo(left, top + ch * 0.35)
      ..lineTo(left + cw * 0.25, top + ch * 0.6)
      ..lineTo(left + cw * 0.5, top)
      ..lineTo(left + cw * 0.75, top + ch * 0.6)
      ..lineTo(left + cw, top + ch * 0.35)
      ..lineTo(left + cw, top + ch)
      ..close();
    canvas.drawPath(
      crown,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFE08A), gold, goldDeep],
        ).createShader(Rect.fromLTWH(left, top, cw, ch)),
    );
    canvas.drawPath(
      crown,
      Paint()
        ..color = const Color(0xFF3A2800)
        ..style = PaintingStyle.stroke
        ..strokeWidth = h * 0.06
        ..strokeJoin = StrokeJoin.round,
    );
    // Band and gems.
    canvas.drawRect(Rect.fromLTWH(left, top + ch * 0.78, cw, ch * 0.22), Paint()..color = goldDeep.withValues(alpha: 0.55));
    final g = Paint()..color = gem;
    canvas.drawCircle(Offset(left + cw * 0.5, top + ch * 0.62), h * 0.07, g);
    canvas.drawCircle(Offset(left + cw * 0.2, top + ch * 0.8), h * 0.05, g);
    canvas.drawCircle(Offset(left + cw * 0.8, top + ch * 0.8), h * 0.05, g);
  }

  @override
  bool shouldRepaint(_MarkPainter old) => false;
}
