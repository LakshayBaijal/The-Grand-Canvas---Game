import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/daily_models.dart';
import 'package:bad_mental_canvas/models/stroke.dart';
import 'package:bad_mental_canvas/screens/hall_of_fame_screen.dart';
import 'package:bad_mental_canvas/theme.dart';

const _fontDir = 'D:/dev/flutter/bin/cache/artifacts/material_fonts';

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

List<Stroke> _scribble(int seed) => [
  Stroke(
    color: const Color(0xFF1A1A1A),
    width: 5,
    points: [
      for (var i = 0; i <= 20; i++)
        Point(0.15 + i * 0.035, 0.5 + 0.3 * ((i * seed) % 7 - 3) / 3),
    ],
  ),
  Stroke(
    color: const Color(0xFFE53935),
    width: 4,
    points: const [Point(0.2, 0.8), Point(0.8, 0.2)],
  ),
];

DailyEntry _entry(int rank, String name, String title, int hearts) =>
    DailyEntry(
      id: rank,
      day: 20700,
      artistId: 'p$rank',
      artistName: name,
      title: title,
      strokes: _scribble(rank + 1),
      createdMs: 0,
      hearts: hearts,
      rank: rank,
    );

/// The top-three strip and the detail dialog, as screenshots — the two new
/// pieces of the Daily worth looking at rather than trusting.
void main() {
  setUpAll(_loadFonts);

  Future<void> shoot(WidgetTester tester, String name) async {
    await tester.runAsync(() async {
      final boundary = tester.firstRenderObject<RenderRepaintBoundary>(
        find.byType(RepaintBoundary),
      );
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final out = Directory('build/screenshots')..createSync(recursive: true);
      File(
        '${out.path}/$name.png',
      ).writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  }

  testWidgets('three medalled tiles in a row, and the detail dialog', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 1400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final top = [
      _entry(1, 'Riya', 'The Shiver-Matic', 42),
      _entry(2, 'Dev', 'Cold Shoulder', 31),
      _entry(3, 'Maya', 'Brrr', 9),
    ];
    const prompt = 'A bear who has just discovered coffee.';

    await tester.pumpWidget(
      // The boundary wraps the whole app so the dialog, which lives in the
      // navigator's overlay above the page, is in the screenshot too.
      RepaintBoundary(
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildGameTheme(),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < 3; i++) ...[
                        if (i > 0) const SizedBox(width: 10),
                        Expanded(
                          child: HallTile(
                            entry: top[i],
                            prompt: prompt,
                            isMe: i == 1,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('The Shiver-Matic'), findsOneWidget);
    expect(find.text('42'), findsOneWidget);
    await shoot(tester, 'hall_tiles');

    await tester.tap(find.text('Cold Shoulder'));
    await tester.pumpAndSettle();
    expect(find.text('31 hearts'), findsOneWidget);
    expect(find.text('2nd that day'), findsOneWidget);
    expect(find.text('+40 trophies'), findsOneWidget);
    expect(find.text('by you'), findsOneWidget);
    await shoot(tester, 'hall_detail');
  });
}
