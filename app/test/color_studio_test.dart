import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/color_studio.dart';

void main() {
  test('hex round-trips', () {
    expect(hexOf(const Color(0xFF1E88E5)), '#1E88E5');
    expect(colorFromHex('#1E88E5'), const Color(0xFF1E88E5));
    expect(colorFromHex('1e88e5'), const Color(0xFF1E88E5));
    expect(colorFromHex('#F0A'), const Color(0xFFFF00AA), reason: 'short form');
    expect(colorFromHex('nope'), isNull);
    expect(colorFromHex('#12345'), isNull);
  });

  testWidgets('the studio opens, shows the numbers, and returns a colour', (tester) async {
    Color? result;
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await showColorStudio(context, initial: const Color(0xFF1E88E5));
          },
          child: const Text('open'),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.close_rounded), findsOneWidget, reason: 'a way out is always visible');
    expect(find.text('#1E88E5'), findsOneWidget, reason: 'hex field shows the current colour');
    expect(find.text('30'), findsOneWidget, reason: 'R');
    expect(find.text('136'), findsOneWidget, reason: 'G');
    expect(find.text('229'), findsOneWidget, reason: 'B');

    // Type a hex code and use it.
    await tester.enterText(find.widgetWithText(TextField, 'HEX'), '#FF0000');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    await tester.tap(find.text('SAVE'));
    await tester.pumpAndSettle();
    expect(result, const Color(0xFFFF0000));
  });
}

