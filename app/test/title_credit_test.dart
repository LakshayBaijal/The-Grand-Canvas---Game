import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/screens/title_screen.dart';
import 'package:bad_mental_canvas/theme.dart';

/// Where the SDK keeps Roboto. `flutter test` exports FLUTTER_ROOT, so this
/// works on whichever machine the tests are run from — it used to be one
/// developer's D: drive, which meant these five files simply failed to set
/// up anywhere else.
final _fontDir =
    '${Platform.environment['FLUTTER_ROOT'] ?? '/usr/local/flutter'}'
    '/bin/cache/artifacts/material_fonts';

/// Real fonts, or every glyph is a wide box and rows overflow that never
/// would on a phone.
Future<void> _loadFonts() async {
  final loader = FontLoader('Roboto');
  for (final file in ['roboto-regular.ttf', 'roboto-bold.ttf', 'roboto-black.ttf']) {
    final bytes = File('$_fontDir/$file').readAsBytesSync();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
}

/// The title screen with the studio credit, as a screenshot — so the credit
/// can be looked at in place rather than trusted from its code.
void main() {
  setUpAll(_loadFonts);

  testWidgets('title screen shows the studio credit', (tester) async {
    tester.view.physicalSize = const Size(1080, 2280);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGameTheme(),
        home: const RepaintBoundary(child: TitleScreen(status: 'CONNECTING')),
      ),
    );
    // Let the staggered entrance and the logo's own drawing finish.
    await tester.pump(const Duration(seconds: 3));

    expect(find.text('CREATED BY'), findsOneWidget);
    expect(find.text('DEVELOPER · LAKSHAY BAIJAL'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);

    await tester.runAsync(() async {
      final boundary =
          tester.firstRenderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary));
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final out = Directory('build/screenshots')..createSync(recursive: true);
      File('${out.path}/title_credit.png').writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  });
}
