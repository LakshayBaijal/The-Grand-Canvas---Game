import 'dart:math';

import 'package:flutter/material.dart';

import '../models/stroke.dart';
import '../models/styles.dart';

const paperColor = Color(0xFFFAF3E3);

/// Base tint for each paper. Kept light across the board so the free black pen
/// is always readable — a dark sheet would turn a cosmetic into a trap.
const paperBase = {
  PaperStyle.plain: paperColor,
  PaperStyle.graph: Color(0xFFF7F6EF),
  PaperStyle.ruled: Color(0xFFFCFBF4),
  PaperStyle.dots: Color(0xFFF8F5EC),
  PaperStyle.kraft: Color(0xFFE8D3AE),
  PaperStyle.sticky: Color(0xFFFFF07A),
};

/// A cream base plus faint speckles/fibers so the canvas reads as paper rather
/// than a flat white rectangle, then whatever ruling the chosen style adds.
/// Deterministic (fixed seed), so it doesn't shimmer between repaints.
void paintPaperBackground(Canvas canvas, Size size, [PaperStyle style = PaperStyle.plain]) {
  canvas.drawRect(Offset.zero & size, Paint()..color = paperBase[style] ?? paperColor);
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

  _paintRuling(canvas, size, style);
}

void _paintRuling(Canvas canvas, Size size, PaperStyle style) {
  // Ruling is sized as a fraction of the sheet, so a thumbnail and a
  // full-screen canvas show the same paper rather than two different ones.
  final step = size.shortestSide / 14;

  switch (style) {
    case PaperStyle.plain:
    case PaperStyle.kraft:
    case PaperStyle.sticky:
      break;

    case PaperStyle.graph:
      final line = Paint()
        ..color = const Color(0xFF6FA8C7).withValues(alpha: 0.30)
        ..strokeWidth = max(0.6, size.shortestSide / 420);
      for (var x = step; x < size.width; x += step) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), line);
      }
      for (var y = step; y < size.height; y += step) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), line);
      }

    case PaperStyle.ruled:
      final line = Paint()
        ..color = const Color(0xFF7FA6C4).withValues(alpha: 0.38)
        ..strokeWidth = max(0.7, size.shortestSide / 400);
      for (var y = step * 1.5; y < size.height; y += step) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), line);
      }
      canvas.drawLine(
        Offset(size.width * 0.13, 0),
        Offset(size.width * 0.13, size.height),
        Paint()
          ..color = const Color(0xFFE28B8B).withValues(alpha: 0.5)
          ..strokeWidth = max(0.8, size.shortestSide / 380),
      );

    case PaperStyle.dots:
      final dot = Paint()..color = const Color(0xFF8A8579).withValues(alpha: 0.42);
      final r = max(0.7, size.shortestSide / 320);
      for (var x = step; x < size.width; x += step) {
        for (var y = step; y < size.height; y += step) {
          canvas.drawCircle(Offset(x, y), r, dot);
        }
      }
  }
}

/// Lays a path down in the manner of [style]. Widths and colours are the
/// caller's; this only changes how the line is put on the paper.
void paintStrokePath(
  Canvas canvas,
  List<Offset> points,
  Color color,
  double width, [
  PenStyle style = PenStyle.pen,
]) {
  if (points.length < 2) return;

  Path pathFrom([Offset shift = Offset.zero]) {
    final path = Path()..moveTo(points.first.dx + shift.dx, points.first.dy + shift.dy);
    for (final p in points.skip(1)) {
      path.lineTo(p.dx + shift.dx, p.dy + shift.dy);
    }
    return path;
  }

  Paint base({double widthScale = 1, double alpha = 1, StrokeCap cap = StrokeCap.round}) => Paint()
    ..color = color.withValues(alpha: color.a * alpha)
    ..strokeWidth = width * widthScale
    ..strokeCap = cap
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;

  switch (style) {
    case PenStyle.pen:
      canvas.drawPath(pathFrom(), base());

    case PenStyle.marker:
      // Chisel tip: wider, squared off, slightly translucent so overlaps
      // darken the way a real marker does.
      canvas.drawPath(pathFrom(), base(widthScale: 1.5, alpha: 0.72, cap: StrokeCap.square));

    case PenStyle.crayon:
      // Waxy texture: several offset passes at low alpha. The offsets come
      // from the pass index, so the grain is stable across repaints.
      for (var pass = 0; pass < 4; pass++) {
        final a = (pass * 1.7) % (pi * 2);
        canvas.drawPath(
          pathFrom(Offset(cos(a), sin(a)) * (width * 0.16)),
          base(widthScale: 0.78, alpha: 0.34),
        );
      }

    case PenStyle.pencil:
      // Graphite: thin, faint, and broken up by a couple of offset passes.
      canvas.drawPath(pathFrom(), base(widthScale: 0.62, alpha: 0.55));
      canvas.drawPath(pathFrom(const Offset(0.6, -0.6)), base(widthScale: 0.4, alpha: 0.3));
      canvas.drawPath(pathFrom(const Offset(-0.6, 0.6)), base(widthScale: 0.4, alpha: 0.3));

    case PenStyle.brush:
      // Loaded brush: a soft wide body under a solid core.
      canvas.drawPath(
        pathFrom(),
        base(widthScale: 1.9, alpha: 0.22)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, width * 0.35),
      );
      canvas.drawPath(pathFrom(), base(widthScale: 0.85));
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
  PenStyle _pen = PenStyle.pen;
  PaperStyle _paper = PaperStyle.plain;

  Color get _paperInk => paperBase[_paper] ?? paperColor;

  /// While erasing, painting uses the paper's own color and a wide, fixed
  /// stroke — so drawing "erases" simply by covering earlier strokes, with
  /// no separate raster/pixel-erase machinery needed.
  Color get color => _erasing ? _paperInk : _color;
  double get brushWidth => _erasing ? _eraserWidth : _brushWidth;
  bool get isErasing => _erasing;
  bool get canUndo => _strokes.isNotEmpty;
  List<WorkingStroke> get strokes => List.unmodifiable(_strokes);
  WorkingStroke? get currentStroke => _current;

  PenStyle get pen => _pen;
  PaperStyle get paper => _paper;

  set pen(PenStyle value) {
    _pen = value;
    notifyListeners();
  }

  /// The eraser paints in the paper's own colour, so switching sheets has to
  /// re-tint it or earlier erases show up as coloured smears.
  set paper(PaperStyle value) {
    _paper = value;
    notifyListeners();
  }

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

  /// An erase is a paper-coloured stroke, and must stay a plain one — a
  /// textured pen would leave visible grain where you rubbed something out.
  PenStyle styleFor(WorkingStroke stroke) =>
      stroke.color == _paperInk ? PenStyle.pen : _pen;

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
            style: styleFor(s),
            points: s.points
                .map((p) => Point(p.dx / canvasSize.width, p.dy / canvasSize.height))
                .toList(),
          ),
        )
        .toList();
  }
}

/// An interactive freehand-drawing surface. Wrap in a fixed-aspect-ratio
/// box (matching the gallery renderer) so normalized coordinates map back
/// correctly regardless of device screen size.
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
    paintPaperBackground(canvas, size, controller.paper);
    for (final stroke in controller.strokes) {
      paintStrokePath(
        canvas,
        stroke.points,
        stroke.color,
        stroke.width,
        controller.styleFor(stroke),
      );
    }
    final current = controller.currentStroke;
    if (current != null) {
      paintStrokePath(
        canvas,
        current.points,
        current.color,
        current.width,
        controller.styleFor(current),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DrawingPainter oldDelegate) => true;
}

/// Renders a finished, normalized set of [Stroke]s (e.g. in the gallery
/// reveal) scaled up to the given box's actual pixel size.
class StaticDrawing extends StatelessWidget {
  const StaticDrawing({super.key, required this.strokes, this.paper = PaperStyle.plain});

  final List<Stroke> strokes;
  final PaperStyle paper;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _StaticPainter(strokes, paper), size: Size.infinite);
  }
}

class _StaticPainter extends CustomPainter {
  _StaticPainter(this.strokes, this.paper);
  final List<Stroke> strokes;
  final PaperStyle paper;

  @override
  void paint(Canvas canvas, Size size) {
    paintPaperBackground(canvas, size, paper);
    for (final stroke in strokes) {
      final points = stroke.points.map((p) => Offset(p.x * size.width, p.y * size.height));
      paintStrokePath(canvas, points.toList(), stroke.color, stroke.width, stroke.style);
    }
  }

  @override
  bool shouldRepaint(covariant _StaticPainter oldDelegate) =>
      oldDelegate.strokes != strokes || oldDelegate.paper != paper;
}
