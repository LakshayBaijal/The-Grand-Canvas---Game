import 'package:bad_mental_canvas/models/round_models.dart';
import 'package:bad_mental_canvas/views/results_view.dart';
import 'package:bad_mental_canvas/widgets/celebration.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

ScoreRow _row(String id, String name, int score) => ScoreRow(
      playerId: id,
      nickname: name,
      score: score,
      delta: score,
      raised: score,
      bonus: 0,
      penalty: 0,
    );

Widget _wrap(Widget child) => MaterialApp(home: child);

void main() {
  final scores = [_row('me', 'Lakshay', 2400), _row('them', 'Riya', 1800)];

  testWidgets('a ranked win celebrates and shows the trophies earned', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultsView(
          mode: GameMode.ranked,
          scores: scores,
          trophies: const {'me': 12, 'them': 7},
          isHost: false,
          onPlayAgain: () {},
          onLeave: () {},
          myId: 'me',
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('You win!'), findsOneWidget);
    expect(find.text('RANKED'), findsOneWidget);
    // The confetti is armed only for the player who actually won.
    expect(tester.widget<Confetti>(find.byType(Confetti)).play, isTrue);

    // Trophies count up, so assert on the landed value.
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('🏆+12'), findsOneWidget);
    expect(find.text('🏆+7'), findsOneWidget);

    // Ranked has no rematch — you queue again instead.
    expect(find.text('PLAY AGAIN'), findsNothing);
    expect(find.text('BACK TO MENU'), findsOneWidget);
  });

  testWidgets('losing names the winner and skips the celebration', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultsView(
          mode: GameMode.ranked,
          scores: scores,
          trophies: const {'me': 5, 'them': 12},
          isHost: false,
          onPlayAgain: () {},
          onLeave: () {},
          myId: 'them',
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('Lakshay wins!'), findsOneWidget);
    expect(find.text('You win!'), findsNothing);
    expect(tester.widget<Confetti>(find.byType(Confetti)).play, isFalse);
  });

  testWidgets('a friendly game shows no trophies and offers a rematch', (tester) async {
    await tester.pumpWidget(
      _wrap(
        ResultsView(
          mode: GameMode.friendly,
          scores: scores,
          trophies: const {},
          isHost: true,
          onPlayAgain: () {},
          onLeave: () {},
          myId: 'me',
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 4));

    expect(find.text('FRIENDLY'), findsOneWidget);
    expect(find.textContaining('🏆+'), findsNothing);
    expect(find.text('PLAY AGAIN'), findsOneWidget);
    expect(find.text('LEAVE GAME'), findsOneWidget);
    expect(find.textContaining('added to your profile'), findsNothing);
  });
}
