@Tags(['screenshot'])
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/round_models.dart';
import 'package:bad_mental_canvas/models/stroke.dart';
import 'package:bad_mental_canvas/theme.dart';
import 'package:bad_mental_canvas/widgets/money_showcase.dart';

/// Renders the reveal showcase to PNGs so it can actually be looked at.
///
/// Not an assertion test — it exists because a hand-painted banknote scattered
/// over a drawing is exactly the sort of thing that is correct in code and
/// wrong on screen. Runs as part of the normal suite (fast, deterministic,
/// and a decent smoke test that the widget doesn't crash); to look at just
/// these renders:
///
///   flutter test test/showcase_screenshot_test.dart
///
/// Output lands in `build/screenshots/` (gitignored, part of app/build/).

const _fontDir = 'D:/dev/flutter/bin/cache/artifacts/material_fonts';

Future<void> _loadFonts() async {
  for (final entry in {
    'Roboto': ['roboto-regular.ttf', 'roboto-bold.ttf', 'roboto-black.ttf'],
  }.entries) {
    final loader = FontLoader(entry.key);
    for (final file in entry.value) {
      final bytes = File('$_fontDir/$file').readAsBytesSync();
      loader.addFont(Future.value(ByteData.view(bytes.buffer)));
    }
    await loader.load();
  }
}

/// A rough scribble, so the canvas underneath the money is not empty.
///
/// Stroke points are stored as 0..1 fractions of the canvas (see
/// StaticDrawing/_StaticPainter, which multiplies by the real size at paint
/// time) -- these are laid out on a 0..300 sketch and divided down to match.
List<Stroke> _scribble() {
  const ref = 300.0;
  Stroke s(List<Point> pts, {double w = 4}) => Stroke(
        points: pts.map((p) => Point(p.x / ref, p.y / ref)).toList(),
        color: const Color(0xFF1A1A1A),
        width: w,
      );
  return [
    s([
      Point(60, 150), Point(90, 90), Point(150, 70),
      Point(210, 90), Point(240, 150), Point(210, 210),
      Point(150, 230), Point(90, 210), Point(60, 150),
    ]),
    s([Point(115, 130), Point(125, 130)], w: 9),
    s([Point(180, 130), Point(190, 130)], w: 9),
    s([
      Point(115, 180), Point(140, 198),
      Point(170, 198), Point(192, 180),
    ]),
    s([Point(150, 230), Point(150, 300)]),
    s([Point(150, 260), Point(95, 290)]),
    s([Point(150, 260), Point(205, 290)]),
  ];
}

RoundResult _entry({required int total, required List<Backer> backers}) => RoundResult(
      artistId: 'me',
      artistName: 'Lakshay',
      title: 'Lemon-scented TP',
      strokes: _scribble(),
      total: total,
      backers: backers,
    );

Future<void> _shoot(WidgetTester tester, String name) async {
  // toImage() does real rendering/encoding work that the fake-async zone
  // testWidgets runs in cannot resolve on its own -- without runAsync this
  // hangs until the test framework times it out, rather than failing fast.
  await tester.runAsync(() async {
    final boundary =
        tester.firstRenderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary));
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final out = Directory('build/screenshots')..createSync(recursive: true);
    File('${out.path}/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
  });
}

Future<void> _mount(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(1080, 2040);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildGameTheme(),
      home: RepaintBoundary(
        child: Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: child,
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(_loadFonts);

  testWidgets('funded drawing, money landed', (tester) async {
    await _mount(
      tester,
      MoneyShowcase(
        entry: _entry(total: 2000, backers: const [
          Backer(name: 'Ana', amount: 300),
          Backer(name: 'Bo', amount: 500),
          Backer(name: 'Cy', amount: 1000),
          Backer(name: 'Di', amount: 200),
        ]),
        isMoney: true,
        fundingGoal: 1000,
        duration: const Duration(milliseconds: 4600),
        isMine: false,
        rank: 1,
        totalEntries: 4,
      ),
    );
    // Run the whole entry out so the notes are down and the stamp has landed.
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    await _shoot(tester, 'showcase_funded');
  });

  testWidgets('mid-flight, halfway through the money', (tester) async {
    await _mount(
      tester,
      MoneyShowcase(
        entry: _entry(total: 2000, backers: const [
          Backer(name: 'Ana', amount: 300),
          Backer(name: 'Bo', amount: 500),
          Backer(name: 'Cy', amount: 1000),
          Backer(name: 'Di', amount: 200),
        ]),
        isMoney: true,
        fundingGoal: 1000,
        duration: const Duration(milliseconds: 4600),
        isMine: false,
        rank: 1,
        totalEntries: 4,
      ),
    );
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    await _shoot(tester, 'showcase_midflight');
  });

  testWidgets('not funded', (tester) async {
    await _mount(
      tester,
      MoneyShowcase(
        entry: _entry(total: 400, backers: const [
          Backer(name: 'Ana', amount: 400),
        ]),
        isMoney: true,
        fundingGoal: 1000,
        duration: const Duration(milliseconds: 4600),
        isMine: false,
        rank: 4,
        totalEntries: 4,
      ),
    );
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    await _shoot(tester, 'showcase_not_funded');
  });

  testWidgets('friendly mode counts points', (tester) async {
    await _mount(
      tester,
      MoneyShowcase(
        entry: _entry(total: 6, backers: const [
          Backer(name: 'Ana', amount: 3),
          Backer(name: 'Bo', amount: 2),
          Backer(name: 'Cy', amount: 1),
        ]),
        isMoney: false,
        fundingGoal: null,
        duration: const Duration(milliseconds: 4600),
        isMine: false,
        rank: 1,
        totalEntries: 3,
      ),
    );
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    await _shoot(tester, 'showcase_friendly');
  });
}
