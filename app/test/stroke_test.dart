import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/stroke.dart';
import 'package:bad_mental_canvas/widgets/drawing_canvas.dart';

void main() {
  test('stroke survives a JSON round trip', () {
    const original = Stroke(
      color: Color(0xFFE53935),
      width: 7,
      points: [Point(0.1, 0.2), Point(0.5, 0.6)],
    );

    final restored = Stroke.fromJson(original.toJson());

    expect(restored.color.toARGB32(), original.color.toARGB32());
    expect(restored.width, original.width);
    expect(restored.points.length, 2);
    expect(restored.points[1].x, closeTo(0.5, 1e-9));
    expect(restored.points[1].y, closeTo(0.6, 1e-9));
  });

  test('controller normalizes points against the canvas size', () {
    final controller = DrawingController()
      ..startStroke(const Offset(100, 50))
      ..addPoint(const Offset(200, 100))
      ..endStroke();

    final strokes = controller.toNormalizedStrokes(const Size(400, 200));

    expect(strokes, hasLength(1));
    expect(strokes.first.points.first.x, closeTo(0.25, 1e-9));
    expect(strokes.first.points.first.y, closeTo(0.25, 1e-9));
    expect(strokes.first.points.last.x, closeTo(0.5, 1e-9));
    expect(strokes.first.points.last.y, closeTo(0.5, 1e-9));
  });

  test('a dragged stroke is thinned out without changing its shape', () {
    // Capture is one point per pan-update event, so a slow drag records a
    // point every few milliseconds whether the finger moved or not. This is
    // what that looks like: a gentle arc, sampled far more finely than anyone
    // could see, which is exactly what a real 75-second drawing produces.
    final controller = DrawingController()..startStroke(const Offset(0, 100));
    for (var i = 1; i <= 600; i++) {
      final t = i / 600;
      controller.addPoint(Offset(t * 400, 100 - sin(t * pi) * 60));
    }
    controller.endStroke();

    final simplified = controller.toNormalizedStrokes(const Size(400, 200)).single.points;

    // The arc is smooth, so most of those samples say nothing a straight line
    // between their neighbours did not already say.
    expect(simplified.length, lessThan(60));
    expect(simplified.length, greaterThan(4));

    // Endpoints are never dropped — a stroke that moved is a stroke that has
    // to still start and end where it did.
    expect(simplified.first.x, closeTo(0, 1e-9));
    expect(simplified.last.x, closeTo(1, 1e-9));

    // And the peak of the arc survives: at the halfway point the line should
    // still be up near y = 40/200, not flattened back down to the chord.
    final peak = simplified.map((p) => p.y).reduce(min);
    expect(peak, closeTo(0.2, 0.02));
  });

  test('a two-point stroke is left alone', () {
    // Nothing to remove between the two endpoints, and both are load-bearing.
    final controller = DrawingController()
      ..startStroke(const Offset(10, 10))
      ..addPoint(const Offset(300, 180))
      ..endStroke();

    expect(controller.toNormalizedStrokes(const Size(400, 200)).single.points, hasLength(2));
  });

  test('single-tap strokes are discarded, undo removes the last stroke', () {
    final controller = DrawingController()
      ..startStroke(const Offset(10, 10))
      ..endStroke(); // no drag, so nothing to draw
    expect(controller.canUndo, isFalse);

    controller
      ..startStroke(const Offset(10, 10))
      ..addPoint(const Offset(20, 20))
      ..endStroke();
    expect(controller.canUndo, isTrue);

    controller.undo();
    expect(controller.canUndo, isFalse);
  });

  test('selecting the eraser actually paints with the paper color', () {
    final controller = DrawingController()..color = Colors.black;

    controller.selectEraser();
    expect(controller.isErasing, isTrue);

    controller
      ..startStroke(const Offset(10, 10))
      ..addPoint(const Offset(30, 30))
      ..endStroke();

    // Regression check: earlier this used the raw fields instead of the
    // erasing-aware getters, so "erasing" silently drew in the old color.
    expect(controller.strokes.single.color, paperColor);
    expect(controller.strokes.single.width, greaterThan(6));
  });

  test('picking a color or brush size exits eraser mode', () {
    final controller = DrawingController()..selectEraser();
    expect(controller.isErasing, isTrue);

    controller.color = Colors.blue;
    expect(controller.isErasing, isFalse);

    controller.selectEraser();
    controller.brushWidth = 3;
    expect(controller.isErasing, isFalse);
  });
}
