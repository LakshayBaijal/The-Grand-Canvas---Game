import 'package:flutter/material.dart';

import '../models/stroke.dart';
import 'drawing_canvas.dart';

/// Replays a finished drawing stroke-by-stroke so it looks like somebody is
/// drawing it right now.
///
/// The server sends bot drawings as an ordered list of strokes, each an
/// ordered list of points — the same order the procedural "pen" laid them
/// down. Playing that back in order, at a human-ish speed, is all it takes to
/// turn a static doodle into a live one; nothing is streamed over the network
/// point by point.
///
/// [onCompleted] fires the moment the last stroke lands; [onFinished] fires a
/// beat later, so the finished drawing stays readable before the caller swaps
/// in the next one.
class LiveDoodle extends StatefulWidget {
  const LiveDoodle({
    super.key,
    required this.strokes,
    this.onCompleted,
    this.onFinished,
  });

  final List<Stroke> strokes;
  final VoidCallback? onCompleted;
  final VoidCallback? onFinished;

  @override
  State<LiveDoodle> createState() => _LiveDoodleState();
}

class _LiveDoodleState extends State<LiveDoodle> with SingleTickerProviderStateMixin {
  /// Roughly how long the hand spends on one captured point. The doodle engine
  /// emits ~200-500 points per drawing, so this lands most of them in the
  /// 8-16 second range.
  static const _msPerPoint = 26.0;

  /// Time charged for lifting the pen between strokes, expressed in points so
  /// it can live on the same timeline. Without it every stroke runs into the
  /// next and the whole thing reads as one continuous scribble.
  static const _penLiftUnits = 7.0;

  static const _holdWhenDone = Duration(milliseconds: 1600);

  late final AnimationController _controller = AnimationController(vsync: this)
    ..addStatusListener(_onStatus);

  /// Bumped on every replay, so the delayed callback from a drawing that has
  /// already been replaced can tell it's stale and stay quiet.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _play();
  }

  @override
  void didUpdateWidget(LiveDoodle oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.strokes, widget.strokes)) _play();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double get _totalUnits => widget.strokes.fold<double>(
        0,
        (sum, s) => sum + s.points.length + _penLiftUnits,
      );

  void _play() {
    _generation++;
    if (widget.strokes.isEmpty) return;
    _controller
      ..duration = Duration(
        milliseconds: (_totalUnits * _msPerPoint).round().clamp(4000, 22000),
      )
      ..forward(from: 0);
  }

  void _onStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    final generation = _generation;
    widget.onCompleted?.call();
    Future.delayed(_holdWhenDone, () {
      if (mounted && generation == _generation) widget.onFinished?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _LiveDoodlePainter(
        strokes: widget.strokes,
        progress: _controller,
        penLiftUnits: _penLiftUnits,
      ),
      size: Size.infinite,
    );
  }
}

class _LiveDoodlePainter extends CustomPainter {
  _LiveDoodlePainter({
    required this.strokes,
    required this.progress,
    required this.penLiftUnits,
  }) : super(repaint: progress);

  final List<Stroke> strokes;
  final Animation<double> progress;
  final double penLiftUnits;

  /// Stroke widths were authored for a full-screen drawing canvas; on a small
  /// preview they'd read as fat markers, so scale them with the box.
  static const _referenceWidth = 340.0;

  @override
  void paint(Canvas canvas, Size size) {
    paintPaperBackground(canvas, size);
    if (strokes.isEmpty) return;

    final widthScale = (size.width / _referenceWidth).clamp(0.45, 1.15);
    final total = strokes.fold<double>(0, (sum, s) => sum + s.points.length + penLiftUnits);
    var budget = progress.value * total;
    Offset? penTip;

    for (final stroke in strokes) {
      if (budget <= 0) break;
      final points = [
        for (final p in stroke.points) Offset(p.x * size.width, p.y * size.height),
      ];

      if (budget >= points.length) {
        // Fully drawn already.
        paintStrokePath(canvas, points, stroke.color, stroke.width * widthScale);
        penTip = points.last;
        budget -= points.length + penLiftUnits;
        continue;
      }

      // Mid-stroke: draw the whole points so far, then a partial segment to
      // the exact position the pen has reached, so the line grows smoothly
      // instead of snapping forward one captured point at a time.
      final whole = budget.floor();
      final partial = points.take(whole).toList();
      if (whole >= 1 && whole < points.length) {
        partial.add(Offset.lerp(points[whole - 1], points[whole], budget - whole)!);
      }
      paintStrokePath(canvas, partial, stroke.color, stroke.width * widthScale);
      if (partial.isNotEmpty) penTip = partial.last;
      budget = 0;
      break;
    }

    if (penTip != null && progress.value < 1) {
      _paintPenTip(canvas, penTip, widthScale);
    }
  }

  /// A soft halo with a solid nib in it — enough to read as "the pen is here"
  /// without pretending to be a drawn pencil.
  void _paintPenTip(Canvas canvas, Offset at, double scale) {
    canvas.drawCircle(
      at,
      9 * scale,
      Paint()..color = const Color(0xFF1A1A1A).withValues(alpha: 0.12),
    );
    canvas.drawCircle(at, 3.2 * scale, Paint()..color = const Color(0xFF1A1A1A));
  }

  @override
  bool shouldRepaint(covariant _LiveDoodlePainter oldDelegate) =>
      !identical(oldDelegate.strokes, strokes);
}
