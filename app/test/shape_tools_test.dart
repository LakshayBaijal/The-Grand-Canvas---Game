import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/shape_tools.dart';

/// Steady Hand has to be right in both directions: a shaky circle becomes a
/// circle, and a scribble stays a scribble. The shakes here are bigger than
/// a real hand's, on purpose.

final _rng = Random(7);
Offset _shake(Offset p, double amount) =>
    p + Offset((_rng.nextDouble() - 0.5) * amount, (_rng.nextDouble() - 0.5) * amount);

List<Offset> _shakyCircle({double r = 100, double shake = 10, int n = 60}) => [
      for (var i = 0; i <= n; i++)
        _shake(Offset(200 + cos(i / n * 2 * pi) * r, 200 + sin(i / n * 2 * pi) * r), shake),
    ];

List<Offset> _shakyLine(Offset a, Offset b, {double shake = 6, int n = 30}) => [
      for (var i = 0; i <= n; i++) _shake(Offset.lerp(a, b, i / n)!, shake),
    ];

List<Offset> _shakyPolygon(List<Offset> corners, {double shake = 6, int perSide = 15}) {
  final out = <Offset>[];
  for (var i = 0; i < corners.length; i++) {
    final a = corners[i];
    final b = corners[(i + 1) % corners.length];
    for (var j = 0; j < perSide; j++) {
      out.add(_shake(Offset.lerp(a, b, j / perSide)!, shake));
    }
  }
  out.add(corners.first);
  return out;
}

Rect _bounds(List<Offset> pts) {
  var r = Rect.fromPoints(pts.first, pts.first);
  for (final p in pts) {
    r = r.expandToInclude(Rect.fromPoints(p, p));
  }
  return r;
}

void main() {
  test('a shaky circle snaps to a circle', () {
    final shape = recognise(_shakyCircle())!;
    expect(shape.length, greaterThan(20));
    final b = _bounds(shape);
    expect((b.width - b.height).abs(), lessThan(2), reason: 'round, not oval');
    expect(b.width, closeTo(200, 25));
  });

  test('a shaky line snaps to a two-point line', () {
    final shape = recognise(_shakyLine(const Offset(20, 30), const Offset(300, 180)))!;
    expect(shape.length, 2);
  });

  test('a shaky square snaps to an axis-aligned rectangle', () {
    final shape = recognise(_shakyPolygon(const [
      Offset(50, 50), Offset(250, 50), Offset(250, 250), Offset(50, 250),
    ]))!;
    expect(shape.length, 5, reason: 'four corners plus the closing point');
    expect(shape[0].dx, shape[3].dx, reason: 'left edge is vertical');
    expect(shape[0].dy, shape[1].dy, reason: 'top edge is horizontal');
  });

  test('a shaky triangle snaps to a triangle', () {
    final shape = recognise(_shakyPolygon(const [
      Offset(150, 40), Offset(280, 260), Offset(20, 260),
    ]))!;
    expect(shape.length, 4);
  });

  test('a scribble is left alone', () {
    final scribble = [
      for (var i = 0; i < 80; i++)
        Offset(20 + i * 3.0, 150 + sin(i / 3) * 60 + cos(i / 7) * 30),
    ];
    expect(recognise(scribble), isNull);
    final zigzag = [
      for (var i = 0; i < 40; i++) Offset(20 + i * 6.0, i.isEven ? 100 : 200),
    ];
    expect(recognise(zigzag), isNull);
  });

  test('a dot is not a shape', () {
    expect(recognise([for (var i = 0; i < 10; i++) Offset(100 + i * 0.5, 100)]), isNull);
  });

  test('smoothing keeps the endpoints and reduces the wobble', () {
    final wobbly = _shakyLine(const Offset(0, 100), const Offset(300, 100), shake: 12, n: 60);
    final calm = smooth(wobbly);
    expect(calm.first, wobbly.first);
    expect(calm.last, wobbly.last);
    double wobble(List<Offset> pts) {
      var sum = 0.0;
      for (final p in pts) {
        sum += (p.dy - 100).abs();
      }
      return sum / pts.length;
    }
    expect(wobble(calm), lessThan(wobble(wobbly) * 0.8));
  });

}
