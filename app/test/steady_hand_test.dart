import 'dart:math';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/drawing_canvas.dart';

/// The Steady Hand tools, at the controller: what a drag becomes.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('holding still with Steady on snaps the stroke to a circle', () {
    fakeAsync((async) {
      final c = DrawingController()..steadyHand = true;
      c.startStroke(const Offset(300, 200));
      for (var i = 1; i <= 60; i++) {
        final a = i / 60 * 2 * pi;
        c.addPoint(Offset(200 + cos(a) * 100 + (i % 3) * 4, 200 + sin(a) * 100 - (i % 2) * 4));
      }
      async.elapse(const Duration(milliseconds: 500));
      c.endStroke();
      final pts = c.strokes.single.points;
      expect((pts.first - pts.last).distance, lessThan(1), reason: 'closed');
      // Every point at the same distance from the centre: a circle.
      for (final p in pts) {
        expect((p - const Offset(200, 200)).distance, closeTo(100, 6));
      }
    });
  });

  test('with Steady off, the same stroke is smoothed but not snapped', () {
    fakeAsync((async) {
      final c = DrawingController();
      c.startStroke(const Offset(300, 200));
      for (var i = 1; i <= 60; i++) {
        final a = i / 60 * 2 * pi;
        c.addPoint(Offset(200 + cos(a) * 100 + (i % 3) * 4, 200 + sin(a) * 100));
      }
      async.elapse(const Duration(milliseconds: 500));
      c.endStroke();
      final pts = c.strokes.single.points;
      var offRound = 0;
      for (final p in pts) {
        if (((p - const Offset(200, 200)).distance - 100).abs() > 1.5) offRound++;
      }
      expect(offRound, greaterThan(5), reason: 'still hand-drawn');
    });
  });

  test('undo then redo brings the stroke back; a new stroke clears redo', () {
    DrawingController draw(DrawingController c, Offset to) {
      c.startStroke(Offset.zero);
      c.addPoint(to);
      c.endStroke();
      return c;
    }
    final c = draw(DrawingController(), const Offset(100, 100));
    c.undo();
    expect(c.strokes, isEmpty);
    expect(c.canRedo, isTrue);
    c.redo();
    expect(c.strokes, hasLength(1));
    draw(c, const Offset(50, 50));
    c.undo();
    draw(c, const Offset(70, 70));
    expect(c.canRedo, isFalse);
  });
}
