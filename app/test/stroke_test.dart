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
