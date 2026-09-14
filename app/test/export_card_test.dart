@Tags(['screenshot'])
library;

import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/stroke.dart';
import 'package:bad_mental_canvas/models/styles.dart';
import 'package:bad_mental_canvas/services/drawing_export.dart';

/// Renders the picture a player gets when they save or share a drawing, so
/// it can be looked at. This is the one thing from the game that travels to
/// group chats and feeds on its own; it had better look right.
///
/// Output lands in `build/screenshots/export_card*.png` (gitignored).

/// Where the SDK keeps Roboto. `flutter test` exports FLUTTER_ROOT, so this
/// works on whichever machine the tests are run from — it used to be one
/// developer's D: drive, which meant these five files simply failed to set
/// up anywhere else.
final _fontDir =
    '${Platform.environment['FLUTTER_ROOT'] ?? '/usr/local/flutter'}'
    '/bin/cache/artifacts/material_fonts';

Future<void> _loadFonts() async {
  final loader = FontLoader('Roboto');
  for (final file in [
    'roboto-regular.ttf',
    'roboto-bold.ttf',
    'roboto-black.ttf',
  ]) {
    final bytes = File('$_fontDir/$file').readAsBytesSync();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
}

List<Point> _circle(double cx, double cy, double r, [int n = 40]) => [
  for (var i = 0; i <= n; i++)
    Point(
      cx + r * math.cos(i / n * 2 * math.pi),
      cy + r * math.sin(i / n * 2 * math.pi),
    ),
];

/// A bear with a coffee, in several pens and colours, so the card shows the
/// styles as they really render.
List<Stroke> _bear() {
  Stroke s(List<Point> pts, Color c, double w, [PenStyle pen = PenStyle.pen]) =>
      Stroke(points: pts, color: c, width: w, style: pen);
  const ink = Color(0xFF1A1A1A);
  const brown = Color(0xFF6D4C41);
  const red = Color(0xFFE53935);
  const blue = Color(0xFF1E88E5);
  const yellow = Color(0xFFFDD835);
  return [
    s(_circle(0.5, 0.45, 0.22), ink, 5, PenStyle.marker),
    s(_circle(0.33, 0.27, 0.07, 20), ink, 4, PenStyle.marker),
    s(_circle(0.67, 0.27, 0.07, 20), ink, 4, PenStyle.marker),
    s([const Point(0.42, 0.42), const Point(0.43, 0.43)], ink, 7),
    s([const Point(0.58, 0.42), const Point(0.59, 0.43)], ink, 7),
    s(_circle(0.5, 0.52, 0.055, 20), brown, 4, PenStyle.crayon),
    s(
      [
        const Point(0.44, 0.58),
        const Point(0.5, 0.62),
        const Point(0.56, 0.58),
      ],
      ink,
      4,
    ),
    s(
      [
        const Point(0.72, 0.66),
        const Point(0.72, 0.8),
        const Point(0.86, 0.8),
        const Point(0.86, 0.66),
        const Point(0.72, 0.66),
      ],
      red,
      5,
      PenStyle.marker,
    ),
    s(
      [
        const Point(0.86, 0.69),
        const Point(0.92, 0.7),
        const Point(0.91, 0.77),
        const Point(0.86, 0.77),
      ],
      red,
      4,
    ),
    s(
      [
        const Point(0.76, 0.62),
        const Point(0.78, 0.58),
        const Point(0.76, 0.54),
      ],
      blue,
      3,
      PenStyle.pencil,
    ),
    s(
      [
        const Point(0.82, 0.62),
        const Point(0.84, 0.58),
        const Point(0.82, 0.54),
      ],
      blue,
      3,
      PenStyle.pencil,
    ),
    s(
      [const Point(0.2, 0.5), const Point(0.28, 0.5)],
      yellow,
      4,
      PenStyle.brush,
    ),
    s(
      [const Point(0.22, 0.42), const Point(0.28, 0.46)],
      yellow,
      4,
      PenStyle.brush,
    ),
  ];
}

void main() {
  setUpAll(_loadFonts);

  testWidgets('the shared picture, with and without an artist line', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final out = Directory('build/screenshots')..createSync(recursive: true);
      final mine = await DrawingExport.render(
        strokes: _bear(),
        paper: PaperStyle.kraft,
        title: 'The Shiver-Matic 3000',
        prompt: 'A bear who has just discovered coffee.',
      );
      File('${out.path}/export_card_mine.png').writeAsBytesSync(mine);
      final theirs = await DrawingExport.render(
        strokes: _bear(),
        paper: PaperStyle.graph,
        title: 'Cold Shoulder',
        prompt: 'A bear who has just discovered coffee.',
        artist: 'Riya',
      );
      File('${out.path}/export_card_theirs.png').writeAsBytesSync(theirs);
      expect(mine.length, greaterThan(10000));
      expect(theirs.length, greaterThan(10000));
    });
  });
}
