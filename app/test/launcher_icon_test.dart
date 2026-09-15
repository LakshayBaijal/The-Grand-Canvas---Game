import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/theme.dart';
import 'package:bad_mental_canvas/widgets/launcher_mark.dart';

/// Renders the launcher mark to the PNGs the app icon is built from.
///
/// The mark is drawn in code (`LauncherMark`), not stored as an image, so
/// this is how it becomes a file. Two of them:
///
///  * `icon_full.png` — the mark on its yellow. The legacy icon for
///    launchers that don't do adaptive icons.
///  * `icon_fg.png` — ink and paint on transparency, for the foreground
///    layer of an adaptive icon (everything sits inside the middle ~66%,
///    which is what survives every launcher's mask: circle, squircle,
///    rounded square).
///
/// Then `dart run flutter_launcher_icons` turns them into every mipmap. Not
/// a test of anything; a build step that happens to need a widget tester.
///
/// It only writes when asked:
///
///     REGEN_ICONS=1 flutter test test/launcher_icon_test.dart
///
/// Left to run on every `flutter test` it rewrote both PNGs each time, and
/// since antialiasing differs by a few pixels between machines, every test
/// run on every laptop left the tree dirty with a change nobody could see.
void main() {
  final regen = Platform.environment['REGEN_ICONS'] == '1';

  Future<void> shoot(
    WidgetTester tester,
    String name,
    Widget child, {
    Color? background,
  }) async {
    tester.view.physicalSize = const Size(1024, 1024);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildGameTheme(),
        home: RepaintBoundary(
          child: ColoredBox(
            color: background ?? Colors.transparent,
            child: Center(child: child),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final boundary = tester.firstRenderObject<RenderRepaintBoundary>(
        find.byType(RepaintBoundary),
      );
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (!regen) return;
      final out = Directory('assets/icon')..createSync(recursive: true);
      File(
        '${out.path}/$name.png',
      ).writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  }

  // The launcher mark, not the in-app logo: see LauncherMark for why. The
  // legacy icon carries its own yellow; the adaptive foreground is the ink
  // and paint alone, and the yellow comes from adaptive_icon_background in
  // pubspec.yaml (kept the same colour so both routes match).
  testWidgets('legacy icon: the mark on its yellow', (tester) async {
    await shoot(tester, 'icon_full', const LauncherMark(size: 1024));
  });

  testWidgets('adaptive foreground: ink and paint alone', (tester) async {
    await shoot(
      tester,
      'icon_fg',
      const LauncherMark(size: 1024, withBackground: false),
    );
  });
}
