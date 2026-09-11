import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/theme.dart';
import 'package:bad_mental_canvas/widgets/logo.dart';

/// Renders the real logo widget to the PNGs the launcher icon is built from.
///
/// The logo is drawn in code (`GrandCanvasLogo`), not stored as an image, so
/// this is the only way to get the *same* mark onto the home screen as the
/// one that draws itself on the title screen. Two files:
///
///  * `icon_full.png` — the logo on the game's own background. The legacy
///    icon for launchers that don't do adaptive icons.
///  * `icon_fg.png` — the logo alone on transparency, sized for the safe zone
///    of an adaptive icon (the mark fills the middle ~62%, which is what
///    survives every launcher's mask: circle, squircle, rounded square).
///
/// Then `dart run flutter_launcher_icons` turns them into every mipmap. Not
/// a test of anything; a build step that happens to need a widget tester.
void main() {
  Future<void> shoot(WidgetTester tester, String name, Widget child, {Color? background}) async {
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
      final boundary =
          tester.firstRenderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary));
      final image = await boundary.toImage(pixelRatio: 1);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final out = Directory('assets/icon')..createSync(recursive: true);
      File('${out.path}/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  }

  testWidgets('legacy icon: logo on the game background', (tester) async {
    await shoot(
      tester,
      'icon_full',
      const GrandCanvasLogo(size: 760),
      background: GameColors.background,
    );
  });

  testWidgets('adaptive foreground: logo alone, inside the safe zone', (tester) async {
    await shoot(tester, 'icon_fg', const GrandCanvasLogo(size: 640));
  });
}
