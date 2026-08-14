import 'package:bad_mental_canvas/models/stroke.dart';
import 'package:bad_mental_canvas/widgets/live_doodle.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Stroke _stroke(int points) => Stroke(
      color: Colors.black,
      width: 4,
      points: [for (var i = 0; i < points; i++) Point(i / points, 0.5)],
    );

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(body: SizedBox(width: 300, height: 300, child: child)),
    );

void main() {
  testWidgets('replays a drawing, then reports completion and finish in order',
      (tester) async {
    final events = <String>[];

    await tester.pumpWidget(
      _wrap(
        LiveDoodle(
          strokes: [_stroke(100), _stroke(100)],
          onCompleted: () => events.add('completed'),
          onFinished: () => events.add('finished'),
        ),
      ),
    );

    // Still drawing part-way through.
    await tester.pump(const Duration(seconds: 2));
    expect(events, isEmpty);

    // Past the end of the replay, the drawing is done but stays on screen.
    await tester.pump(const Duration(seconds: 10));
    expect(events, ['completed']);

    // The hold expires and the caller is asked for the next drawing.
    await tester.pump(const Duration(seconds: 2));
    expect(events, ['completed', 'finished']);
  });

  testWidgets('a drawing swapped in mid-replay cannot fire the old callback',
      (tester) async {
    var finished = 0;

    final first = [_stroke(60)];
    await tester.pumpWidget(
      _wrap(LiveDoodle(strokes: first, onFinished: () => finished++)),
    );

    // Let the first replay complete, but interrupt during its hold.
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpWidget(
      _wrap(LiveDoodle(strokes: [_stroke(60)], onFinished: () => finished++)),
    );

    // The stale timer from the first drawing fires here and must stay quiet,
    // otherwise the caller gets asked for two drawings and the canvas skips.
    await tester.pump(const Duration(seconds: 2));
    expect(finished, 0);

    // Only the replay actually on screen reports in. It needs two pumps: one
    // to land the frame that completes the replay, then one to run out the
    // hold timer that frame scheduled.
    await tester.pump(const Duration(seconds: 8));
    expect(finished, 0);
    await tester.pump(const Duration(seconds: 2));
    expect(finished, 1);
  });

  testWidgets('an empty drawing never claims to have finished', (tester) async {
    var finished = 0;
    await tester.pumpWidget(
      _wrap(LiveDoodle(strokes: const [], onFinished: () => finished++)),
    );

    await tester.pump(const Duration(seconds: 30));
    expect(finished, 0);
  });
}
