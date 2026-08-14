import 'dart:math';

import 'package:flutter/material.dart';

import '../models/stroke.dart';

const paperColor = Color(0xFFFAF3E3);

/// A cream base plus faint speckles/fibers so the canvas reads as paper
/// rather than a flat white rectangle. Deterministic (fixed seed), so it
/// doesn't shimmer between repaints.
void paintPaperBackground(Canvas canvas, Size size) {
  canvas.drawRect(Offset.zero & size, Paint()..color = paperColor);
  final rnd = Random(3);

  final speck = Paint()..color = const Color(0xFFD8C79E).withValues(alpha: 0.4);
  for (var i = 0; i < 120; i++) {
    final p = Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height);
    canvas.drawCircle(p, rnd.nextDouble() * 0.7 + 0.3, speck);
  }

  final fiber = Paint()
    ..color = const Color(0xFFC2AF83).withValues(alpha: 0.22)
    ..strokeWidth = 0.6;
  for (var i = 0; i < 16; i++) {
    final y = rnd.nextDouble() * size.height;
    final x0 = rnd.nextDouble() * size.width;
    canvas.drawLine(
      Offset(x0, y),
      Offset(x0 + rnd.nextDouble() * 36 - 18, y + rnd.nextDouble() * 5 - 2.5),
      fiber,
    );
  }
}

class WorkingStroke {
  WorkingStroke({required this.color, required this.width, required this.points});
  final Color color;
  final double width;
  final List<Offset> points;
}

/// Holds the in-progress drawing (raw pixel-space strokes) and exposes it as
/// normalized [Stroke]s for submission once the canvas's rendered size is
/// known.
class DrawingController extends ChangeNotifier {
  static const _eraserWidth = 26.0;

  final List<WorkingStroke> _strokes = [];
  WorkingStroke? _current;
  Color _color = Colors.black;
  double _brushWidth = 6;
  bool _erasing = false;

  /// While erasing, painting uses the paper's own color and a wide, fixed
  /// stroke — so drawing "erases" simply by covering earlier strokes, with
  /// no separate raster/pixel-erase machinery needed.
  Color get color => _erasing ? paperColor : _color;
  double get brushWidth => _erasing ? _eraserWidth : _brushWidth;
  bool get isErasing => _erasing;
  bool get canUndo => _strokes.isNotEmpty;
  List<WorkingStroke> get strokes => List.unmodifiable(_strokes);
  WorkingStroke? get currentStroke => _current;

  set color(Color value) {
    _color = value;
    _erasing = false;
    notifyListeners();
  }

  set brushWidth(double value) {
    _brushWidth = value;
    _erasing = false;
    notifyListeners();
  }

  void selectEraser() {
    _erasing = true;
    notifyListeners();
  }

  void startStroke(Offset point) {
    // Use the public getters, not the raw fields — while erasing, those
    // resolve to the paper color/width instead of whatever was last picked.
    _current = WorkingStroke(color: color, width: brushWidth, points: [point]);
    notifyListeners();
  }

  void addPoint(Offset point) {
    _current?.points.add(point);
    notifyListeners();
  }

  void endStroke() {
    final current = _current;
    if (current != null && current.points.length > 1) {
      _strokes.add(current);
    }
    _current = null;
    notifyListeners();
  }

  void undo() {
    if (_strokes.isNotEmpty) {
      _strokes.removeLast();
      notifyListeners();
    }
  }

  List<Stroke> toNormalizedStrokes(Size canvasSize) {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return const [];
    return _strokes
        .map(
          (s) => Stroke(
            color: s.color,
            width: s.width,
            points: s.points
                .map((p) => Point(p.dx / canvasSize.width, p.dy / canvasSize.height))
                .toList(),
          ),
        )
        .toList();
  }
}

/// An interactive freehand-drawing surface. Wrap in a fixed-aspect-ratio
/// box (matching [GalleryScreen]'s renderer) so normalized coordinates map
/// back correctly regardless of device screen size.
class DrawingCanvas extends StatelessWidget {
  const DrawingCanvas({super.key, required this.controller});

  final DrawingController controller;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: GestureDetector(
        onPanStart: (details) => controller.startStroke(details.localPosition),
        onPanUpdate: (details) => controller.addPoint(details.localPosition),
        onPanEnd: (_) => controller.endStroke(),
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) => CustomPaint(
            painter: _DrawingPainter(controller),
            size: Size.infinite,
          ),
        ),
      ),
    );
  }
}

class _DrawingPainter extends CustomPainter {
  _DrawingPainter(this.controller) : super(repaint: controller);
  final DrawingController controller;

  @override
  void paint(Canvas canvas, Size size) {
    paintPaperBackground(canvas, size);
    for (final stroke in controller.strokes) {
      paintStrokePath(canvas, stroke.points, stroke.color, stroke.width);
    }
    final current = controller.currentStroke;
    if (current != null) {
      paintStrokePath(canvas, current.points, current.color, current.width);
    }
  }

  @override
  bool shouldRepaint(covariant _DrawingPainter oldDelegate) => true;
}

/// Renders a finished, normalized set of [Stroke]s (e.g. in the gallery
/// reveal) scaled up to the given box's actual pixel size.
class StaticDrawing extends StatelessWidget {
  const StaticDrawing({super.key, required this.strokes});

  final List<Stroke> strokes;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _StaticPainter(strokes), size: Size.infinite);
  }
}

class _StaticPainter extends CustomPainter {
  _StaticPainter(this.strokes);
  final List<Stroke> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    paintPaperBackground(canvas, size);
    for (final stroke in strokes) {
      final points = stroke.points.map((p) => Offset(p.x * size.width, p.y * size.height));
      paintStrokePath(canvas, points.toList(), stroke.color, stroke.width);
    }
  }

  @override
  bool shouldRepaint(covariant _StaticPainter oldDelegate) => oldDelegate.strokes != strokes;
}

void paintStrokePath(Canvas canvas, List<Offset> points, Color color, double width) {
  if (points.length < 2) return;
  final paint = Paint()
    ..color = color
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;
  final path = Path()..moveTo(points.first.dx, points.first.dy);
  for (final p in points.skip(1)) {
    path.lineTo(p.dx, p.dy);
  }
  canvas.drawPath(path, paint);
}
