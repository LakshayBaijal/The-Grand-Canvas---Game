import 'dart:math';

import 'package:flutter/material.dart';

import '../theme.dart';

/// Any colour at all: a hue ring with a lightness slider under it.
///
/// Nine swatches cover a drawing; this covers the drawing someone actually
/// wants to make -- skin, sky at dusk, the exact green of a particular
/// frog. Two controls, not three: saturation is left high, because a muddy
/// colour is never what anyone was reaching for on a party-game canvas.
Future<Color?> showColorWheel(BuildContext context, {required Color initial}) {
  return showModalBottomSheet<Color>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => _ColorWheelSheet(initial: initial),
  );
}

class _ColorWheelSheet extends StatefulWidget {
  const _ColorWheelSheet({required this.initial});
  final Color initial;

  @override
  State<_ColorWheelSheet> createState() => _ColorWheelSheetState();
}

class _ColorWheelSheetState extends State<_ColorWheelSheet> {
  late double _hue = HSLColor.fromColor(widget.initial).hue;
  late double _light = HSLColor.fromColor(widget.initial).lightness.clamp(0.15, 0.85);

  Color get _color => HSLColor.fromAHSL(1, _hue, 0.85, _light).toColor();

  void _pick(Offset local, double size) {
    final c = Offset(size / 2, size / 2);
    final d = local - c;
    setState(() => _hue = (atan2(d.dy, d.dx) * 180 / pi + 360) % 360);
  }

  @override
  Widget build(BuildContext context) {
    const size = 220.0;
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
      decoration: GameDecor.panel(accent: GameColors.primary, radius: 22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'ANY COLOUR',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 2, color: GameColors.textMuted),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onPanDown: (d) => _pick(d.localPosition, size),
            onPanUpdate: (d) => _pick(d.localPosition, size),
            child: CustomPaint(
              size: const Size(size, size),
              painter: _WheelPainter(hue: _hue, color: _color),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.dark_mode_outlined, size: 16, color: GameColors.textMuted),
              Expanded(
                child: Slider(
                  value: _light,
                  min: 0.15,
                  max: 0.85,
                  activeColor: _color,
                  onChanged: (v) => setState(() => _light = v),
                ),
              ),
              const Icon(Icons.light_mode_outlined, size: 16, color: GameColors.textMuted),
            ],
          ),
          const SizedBox(height: 6),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(_color),
            style: FilledButton.styleFrom(backgroundColor: _color, foregroundColor: _light > 0.55 ? Colors.black : Colors.white),
            child: const Text('USE THIS COLOUR'),
          ),
        ],
      ),
    );
  }
}

class _WheelPainter extends CustomPainter {
  const _WheelPainter({required this.hue, required this.color});
  final double hue;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    final ring = Paint()
      ..shader = SweepGradient(
        colors: [for (var h = 0; h <= 360; h += 30) HSLColor.fromAHSL(1, h % 360.0, 0.85, 0.5).toColor()],
      ).createShader(Rect.fromCircle(center: c, radius: r))
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.34;
    canvas.drawCircle(c, r * 0.8, ring);
    // The chosen colour in the middle, and a marker on the ring.
    canvas.drawCircle(c, r * 0.5, Paint()..color = color);
    final a = hue * pi / 180;
    final m = Offset(c.dx + cos(a) * r * 0.8, c.dy + sin(a) * r * 0.8);
    canvas.drawCircle(m, r * 0.16, Paint()..color = Colors.white);
    canvas.drawCircle(m, r * 0.12, Paint()..color = HSLColor.fromAHSL(1, hue, 0.85, 0.5).toColor());
  }

  @override
  bool shouldRepaint(_WheelPainter old) => old.hue != hue || old.color != color;
}
