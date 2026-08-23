import 'package:bad_mental_canvas/main.dart';
import 'package:bad_mental_canvas/widgets/sketch_icons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('first run asks for a name once, before anything else', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump(); // identity loads off disk
    // The title screen holds for a beat before anything else shows.
    await tester.pump(const Duration(seconds: 6));
    await tester.pump();

    expect(find.text('GRAND CANVAS'), findsWidgets);
    expect(find.text("LET'S GO"), findsOneWidget);
    // The menu is not reachable until there's a name to attach trophies to.
    expect(find.textContaining('QUICK'), findsNothing);
  });

  testWidgets('a returning player goes straight to the menu', (tester) async {
    SharedPreferences.setMockInitialValues({
      'player_id': 'test-device',
      'player_nickname': 'Lakshay',
    });

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 6));
    await tester.pump();

    // Never asked for a name again.
    expect(find.text("LET'S GO"), findsNothing);
    expect(find.text('Lakshay'), findsOneWidget);

    // Both modes are offered, and they're clearly separate things.
    expect(find.text('QUICK\nMATCH'), findsOneWidget);
    expect(find.text('PLAY WITH\nFRIENDS'), findsOneWidget);
    expect(find.text('LEADERBOARD'), findsOneWidget);

    // Creating and joining live behind the friends button, not on the menu.
    expect(find.text('CREATE A ROOM'), findsNothing);
    expect(find.widgetWithText(OutlinedButton, 'JOIN'), findsNothing);
  });

  testWidgets('the trophy count is visible without a connection', (tester) async {
    SharedPreferences.setMockInitialValues({
      'player_id': 'test-device',
      'player_nickname': 'Lakshay',
    });

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 6));
    await tester.pump();

    // No server, so no profile has arrived — it should still render a sane
    // zero rather than blocking the menu. The trophy count is now a hand-drawn
    // SketchIcon rather than an emoji baked into the text, so check each half.
    expect(find.text('0'), findsOneWidget);
    expect(
      find.byWidgetPredicate((w) => w is SketchIcon && w.glyph == SketchGlyph.trophy && w.size == 15),
      findsOneWidget,
    );
    expect(find.textContaining('Connecting'), findsOneWidget);
  });
}
