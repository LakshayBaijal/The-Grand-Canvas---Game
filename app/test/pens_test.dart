import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/styles.dart';
import 'package:bad_mental_canvas/widgets/drawing_canvas.dart';

/// Every pen and every paper can be painted, and a stroke keeps the pen it
/// was drawn with.
void main() {
  test('every pen paints without throwing, on every paper', () {
    final points = [for (var i = 0; i <= 30; i++) Offset(10 + i * 8.0, 60 + (i % 3) * 5.0)];
    for (final paper in PaperStyle.values) {
      for (final pen in PenStyle.values) {
        final rec = ui.PictureRecorder();
        final canvas = Canvas(rec);
        paintPaperBackground(canvas, const Size(300, 120), paper);
        paintStrokePath(canvas, points, Colors.red, 8, pen);
        rec.endRecording().dispose();
      }
    }
  });

  test('the wire ids of the new styles are short lowercase words', () {
    // The server passes a style through only if it matches /^[a-z]+$/ and is
    // at most 16 characters; anything else is silently dropped to the pen.
    for (final pen in PenStyle.values) {
      expect(RegExp(r'^[a-z]{1,16}$').hasMatch(pen.id), isTrue, reason: pen.id);
    }
    for (final paper in PaperStyle.values) {
      expect(RegExp(r'^[a-z]{1,16}$').hasMatch(paper.id), isTrue, reason: paper.id);
    }
  });

  test('changing the pen mid-drawing does not restyle earlier strokes', () {
    final c = DrawingController()..pen = PenStyle.marker;
    c.startStroke(Offset.zero);
    c.addPoint(const Offset(50, 50));
    c.endStroke();
    c.pen = PenStyle.neon;
    c.startStroke(const Offset(10, 10));
    c.addPoint(const Offset(60, 60));
    c.endStroke();
    final out = c.toNormalizedStrokes(const Size(100, 100));
    expect(out[0].style, PenStyle.marker);
    expect(out[1].style, PenStyle.neon);
  });

}
