import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/stroke.dart';
import '../models/styles.dart';
import 'shape_tools.dart';

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
  PaperStyle.parchment: Color(0xFFEBDCB4),
  PaperStyle.canvas: Color(0xFFF3EEE2),
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

    case PaperStyle.parchment:
      // Old paper: darker toward the edges, a few tea-coloured blotches.
      final rnd = Random(11);
      final edge = Paint()
        ..shader = RadialGradient(
          colors: [Colors.transparent, const Color(0xFFB08A4E).withValues(alpha: 0.28)],
          stops: const [0.55, 1],
        ).createShader(Offset.zero & size);
      canvas.drawRect(Offset.zero & size, edge);
      for (var i = 0; i < 7; i++) {
        final c = Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height);
        final r = size.shortestSide * (0.04 + rnd.nextDouble() * 0.09);
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..color = const Color(0xFFB08A4E).withValues(alpha: 0.05 + rnd.nextDouble() * 0.06)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.5),
        );
      }

    case PaperStyle.canvas:
      // Linen: a fine weave in both directions.
      final thread = Paint()
        ..color = const Color(0xFFB7AE9A).withValues(alpha: 0.22)
        ..strokeWidth = max(0.5, size.shortestSide / 600);
      final weave = size.shortestSide / 90;
      for (var x = 0.0; x < size.width; x += weave) {
        canvas.drawLine(Offset(x, 0), Offset(x, size.height), thread);
      }
      for (var y = 0.0; y < size.height; y += weave) {
        canvas.drawLine(Offset(0, y), Offset(size.width, y), thread);
      }

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

    case PenStyle.ink:
      // A broad nib held at 45 degrees: thick on the down-strokes, thin on
      // the cross-strokes. Each segment is a quad whose width depends on
      // its direction, which is exactly what a real nib does.
      final fill = Paint()..color = color;
      const nib = pi / 4;
      final half = width * 0.75;
      for (var i = 1; i < points.length; i++) {
        final a = points[i - 1];
        final b = points[i];
        final d = b - a;
        if (d.distance < 0.01) continue;
        final angle = atan2(d.dy, d.dx);
        final w = half * (0.18 + 0.82 * sin(angle - nib).abs());
        final nx = cos(nib + pi / 2) * w;
        final ny = sin(nib + pi / 2) * w;
        canvas.drawPath(
          Path()
            ..moveTo(a.dx + nx, a.dy + ny)
            ..lineTo(b.dx + nx, b.dy + ny)
            ..lineTo(b.dx - nx, b.dy - ny)
            ..lineTo(a.dx - nx, a.dy - ny)
            ..close(),
          fill,
        );
        canvas.drawCircle(b, w * 0.9, fill);
      }
      canvas.drawCircle(points.first, half * 0.35, fill);

    case PenStyle.neon:
      // A tube of light: a wide soft glow in the colour, a tighter one, and
      // a near-white core.
      canvas.drawPath(
        pathFrom(),
        base(widthScale: 3.2, alpha: 0.28)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, width * 0.9),
      );
      canvas.drawPath(
        pathFrom(),
        base(widthScale: 1.6, alpha: 0.7)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, width * 0.3),
      );
      canvas.drawPath(
        pathFrom(),
        base(widthScale: 0.55)..color = Color.lerp(color, Colors.white, 0.75)!,
      );

    case PenStyle.rainbow:
      // The hue walks round the wheel along the stroke, starting from the
      // chosen colour. Segment by segment, round-capped so it reads as one
      // continuous line.
      final hsv = HSVColor.fromColor(color);
      final n = points.length - 1;
      for (var i = 1; i < points.length; i++) {
        final t = (i - 1) / max(1, n);
        final c = hsv.withHue((hsv.hue + t * 360) % 360).withSaturation(max(0.6, hsv.saturation)).withValue(max(0.75, hsv.value)).toColor();
        canvas.drawLine(points[i - 1], points[i], base()..color = c);
      }

    case PenStyle.spray:
      // Airbrush: a cloud of dots around the path. Seeded from the point
      // index so the cloud is the same on every repaint and on every
      // other phone.
      final dot = Paint()..color = color.withValues(alpha: color.a * 0.55);
      final spread = width * 1.4;
      for (var i = 0; i < points.length; i++) {
        final rnd = Random(i * 7919 + 13);
        final p = points[i];
        for (var k = 0; k < 9; k++) {
          final a = rnd.nextDouble() * pi * 2;
          final r = sqrt(rnd.nextDouble()) * spread;
          canvas.drawCircle(
            Offset(p.dx + cos(a) * r, p.dy + sin(a) * r),
            width * (0.06 + rnd.nextDouble() * 0.1),
            dot,
          );
        }
      }

  }
}

class WorkingStroke {
  WorkingStroke({
    required this.color,
    required this.width,
    required this.points,
    this.style = PenStyle.pen,
  });
  final Color color;
  final double width;
  final List<Offset> points;

  /// Captured when the stroke starts. It used to be looked up from the
  /// current pen at paint time, which quietly restyled every earlier stroke
  /// whenever the pen was changed mid-drawing.
  final PenStyle style;
}

/// Holds the in-progress drawing (raw pixel-space strokes) and exposes it as
/// normalized [Stroke]s for submission once the canvas's rendered size is
/// known.
class DrawingController extends ChangeNotifier {
  static const _eraserWidth = 26.0;

  final List<WorkingStroke> _strokes = [];
  final List<WorkingStroke> _redo = [];
  WorkingStroke? _current;
  Color _color = Colors.black;

  // --- Steady Hand -----------------------------------------------------------
  bool _steadyHand = false;
  /// Fires when the finger has held still mid-stroke: the Steady Hand cue.
  Timer? _holdTimer;
  /// Set once a stroke has been snapped to a shape; further movement in the
  /// same touch is ignored so the shape does not get a tail.
  bool _snapped = false;
  /// Where the finger actually is. The recorded freehand point trails it
  /// (see [steadied]); on lift the stroke is pinned to this so it ends where
  /// the finger did.
  Offset? _raw;

  bool get steadyHand => _steadyHand;

  set steadyHand(bool value) {
    _steadyHand = value;
    notifyListeners();
  }

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
  bool get canRedo => _redo.isNotEmpty;
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
      stroke.color == _paperInk ? PenStyle.pen : stroke.style;

  void startStroke(Offset point) {
    // Use the public getters, not the raw fields — while erasing, those
    // resolve to the paper color/width instead of whatever was last picked.
    _current = WorkingStroke(
      color: color,
      width: brushWidth,
      points: [point],
      style: _erasing ? PenStyle.pen : _pen,
    );
    _snapped = false;
    notifyListeners();
  }

  void addPoint(Offset point) {
    final current = _current;
    if (current == null || _snapped) return;
    _raw = point;
    final next = steadied(current.points.last, point);
    if (next == null) return;
    current.points.add(next);
    _armHold();
    notifyListeners();
  }

  /// Steady Hand: hold the finger still for a beat and the stroke so far
  /// snaps to the shape it was trying to be. The pause is the signal --
  /// nobody holds still in the middle of a scribble, but everyone pauses
  /// for a moment before lifting off a circle they've just closed.
  void _armHold() {
    _holdTimer?.cancel();
    if (!_steadyHand || _erasing) return;
    _holdTimer = Timer(const Duration(milliseconds: 380), () {
      final current = _current;
      if (current == null || _snapped) return;
      final shape = recognise(current.points);
      if (shape == null) return;
      current.points
        ..clear()
        ..addAll(shape);
      _snapped = true;
      HapticFeedback.mediumImpact();
      notifyListeners();
    });
  }

  void endStroke() {
    _holdTimer?.cancel();
    final current = _current;
    if (current != null && _raw != null && !_snapped) {
      // End exactly where the finger lifted, not a fraction short of it.
      if ((current.points.last - _raw!).distance > 0.01) current.points.add(_raw!);
    }
    if (current != null && current.points.length > 1) {
      if (!_snapped && !_erasing) {
        final calm = smooth(current.points);
        current.points
          ..clear()
          ..addAll(calm);
      }
      _strokes.add(current);
      _redo.clear();
    }
    _current = null;
    _raw = null;
    _snapped = false;
    notifyListeners();
  }

  void undo() {
    if (_strokes.isNotEmpty) {
      _redo.add(_strokes.removeLast());
      notifyListeners();
    }
  }

  void redo() {
    if (_redo.isNotEmpty) {
      _strokes.add(_redo.removeLast());
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    super.dispose();
  }

  List<Stroke> toNormalizedStrokes(Size canvasSize) {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return const [];
    return _strokes
        .map(
          (s) => Stroke(
            color: s.color,
            width: s.width,
            style: styleFor(s),
            points: _simplify(
              s.points
                  .map((p) => Point(p.dx / canvasSize.width, p.dy / canvasSize.height))
                  .toList(),
              _simplifyTolerance,
            ),
          ),
        )
        .toList();
  }
}

/// How far a point may sit from the line it would be dropped from, in canvas
/// fractions. 0.0012 is just over one pixel on a 1000px canvas — below what
/// anyone can see on a hand-drawn wobble, and well under the width of even the
/// thinnest pen.
const double _simplifyTolerance = 0.0012;

/// Ramer–Douglas–Peucker: keeps the points that define the shape and drops the
/// ones a straight line already covers.
///
/// Capture is one point per pan-update event, so a 120Hz phone records about
/// 120 points per second of contact whether the finger moved a pixel or a
/// centimetre. A busy 75-second drawing is thousands of points, and every one
/// of them is stored, sent to every other player, and replayed. Freehand input
/// is mostly redundant by nature — this typically removes 80-90% of a stroke
/// with no visible change to it.
///
/// Iterative rather than recursive: a single stroke can be long enough that the
/// recursive form is a real stack-depth risk on a slow drag.
List<Point> _simplify(List<Point> points, double tolerance) {
  if (points.length < 3) return points;

  final keep = List<bool>.filled(points.length, false);
  keep[0] = true;
  keep[points.length - 1] = true;

  final stack = <List<int>>[
    [0, points.length - 1],
  ];

  while (stack.isNotEmpty) {
    final range = stack.removeLast();
    final first = range[0];
    final last = range[1];
    if (last <= first + 1) continue;

    final a = points[first];
    final b = points[last];
    final dx = b.x - a.x;
    final dy = b.y - a.y;
    final span = sqrt(dx * dx + dy * dy);

    var worst = 0.0;
    var worstAt = first;
    for (var i = first + 1; i < last; i++) {
      final p = points[i];
      // Perpendicular distance to AB — or, when the stroke has looped back to
      // where it started, plain distance from that point.
      final d = span < 1e-9
          ? sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y))
          : ((dx * (a.y - p.y)) - ((a.x - p.x) * dy)).abs() / span;
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }

    if (worst > tolerance) {
      keep[worstAt] = true;
      stack.add([first, worstAt]);
      stack.add([worstAt, last]);
    }
  }

  final out = <Point>[];
  for (var i = 0; i < points.length; i++) {
    if (keep[i]) out.add(points[i]);
  }
  return out;
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
