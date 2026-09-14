@Tags(['screenshot'])
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/theme.dart';
import 'package:bad_mental_canvas/widgets/logo.dart';
import 'package:bad_mental_canvas/widgets/pass_button.dart';

/// The shop, rendered so it can be looked at: the pass button as it sits at
/// the top of the home screen, and the sheet it opens. The sheet is the one
/// place the game asks for money, so "correct in code" is not enough.
///
/// Output lands in `build/screenshots/` (gitignored).

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

  testWidgets('the pass button, and the sheet it opens', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      RepaintBoundary(
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildGameTheme(),
          builder: (context, child) => AppBackground(child: child!),
          home: Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    const SizedBox(height: 10),
                    Row(
                      children: const [
                        GrandCanvasLogo(size: 40),
                        SizedBox(width: 10),
                        // Shrinks before the pass button ever has to.
                        Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: GrandCanvasWordmark(scale: 0.52),
                            ),
                          ),
                        ),
                        SizedBox(width: 10),
                        PassButton(),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('GET THE PASS'), findsOneWidget);
    await shoot(tester, 'shop_home_top');

    await tester.tap(find.text('GET THE PASS'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('THE PASS'), findsOneWidget);
    expect(find.text('EVERY PAPER'), findsOneWidget);
    expect(find.text('EVERY PEN'), findsOneWidget);
    expect(find.text('NO ADS'), findsOneWidget);
    await shoot(tester, 'shop_sheet');
  });
}
