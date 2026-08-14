import 'package:bad_mental_canvas/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('first run asks for a name once, before anything else', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump(); // identity loads off disk

    expect(find.text('BAD MENTAL\nCANVAS'), findsOneWidget);
    expect(find.text("LET'S GO"), findsOneWidget);
    // The menu is not reachable until there's a name to attach trophies to.
    expect(find.text('RANKED'), findsNothing);
  });

  testWidgets('a returning player goes straight to the menu', (tester) async {
    SharedPreferences.setMockInitialValues({
      'player_id': 'test-device',
      'player_nickname': 'Lakshay',
    });

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump();

    // Never asked for a name again.
    expect(find.text("LET'S GO"), findsNothing);
    expect(find.text('Lakshay'), findsOneWidget);

    // Both modes are offered, and they're clearly separate things.
    expect(find.text('RANKED'), findsOneWidget);
    expect(find.text('PLAY WITH FRIENDS'), findsOneWidget);
    expect(find.text('LEADERBOARD'), findsOneWidget);
  });

  testWidgets('the trophy count is visible without a connection', (tester) async {
    SharedPreferences.setMockInitialValues({
      'player_id': 'test-device',
      'player_nickname': 'Lakshay',
    });

    await tester.pumpWidget(const BadMentalCanvasApp());
    await tester.pump();

    // No server, so no profile has arrived — it should still render a sane
    // zero rather than blocking the menu.
    expect(find.text('🏆 0'), findsOneWidget);
    expect(find.textContaining('Connecting'), findsOneWidget);
  });
}
