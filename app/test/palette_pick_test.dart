import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bad_mental_canvas/services/entitlements.dart';
import 'package:bad_mental_canvas/views/draw_view.dart';

/// Hold a swatch, pick a colour, close the picker with the X: the swatch is
/// that colour now, and it is the colour you draw with. This was the bug --
/// the colour was only kept if you found SAVE.
void main() {
  testWidgets('a picked colour is kept even when the picker is closed with the X', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await Entitlements.instance.load();
    await tester.pumpWidget(MaterialApp(
      home: DrawView(
        prompt: 'Draw a frog',
        roundIndex: 0,
        totalRounds: 1,
        submitted: 0,
        total: 1,
        unlocked: true,
        onSubmit: (_, _, _) {},
      ),
    ));
    await tester.pump();

    const slot = 2;
    final swatch = find.byKey(const ValueKey('swatch-$slot'));
    expect(swatch, findsOneWidget);
    await tester.longPress(swatch);
    // Fixed pumps, not pumpAndSettle: the prompt above the canvas animates
    // forever, so the tree never settles.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('YOUR COLOUR'), findsOneWidget, reason: 'the picker opened');

    await tester.enterText(find.widgetWithText(TextField, 'HEX'), '#123456');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(Entitlements.instance.paletteIsCustom(slot), isTrue);
    expect(Entitlements.instance.paletteColour(slot, Colors.red), const Color(0xFF123456));
    final box = tester.widget<Container>(swatch);
    expect((box.decoration! as BoxDecoration).color, const Color(0xFF123456), reason: 'the swatch shows it');
  });
}
