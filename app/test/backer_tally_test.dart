import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/round_models.dart';
import 'package:bad_mental_canvas/widgets/backer_tally.dart';

/// The tally is the payoff moment of a round: money arrives one backer at a
/// time and the total climbs with it. The things worth pinning down are that
/// it never shows the final figure early, and that it always lands on exactly
/// the server's total — a tally that disagrees with the score table below it
/// would look like a bug even when the score is right.

Future<void> _pump(WidgetTester tester, Widget child) => tester.pumpWidget(
      MaterialApp(home: Scaffold(body: Center(child: child))),
    );

/// Every number currently rendered anywhere in the tree.
List<String> _texts(WidgetTester tester) =>
    tester.widgetList<Text>(find.byType(Text)).map((t) => t.data ?? '').toList();

bool _showsTotal(WidgetTester tester, String needle) =>
    _texts(tester).any((s) => s.contains(needle));

/// Runs the whole stagger out.
///
/// `pumpAndSettle` is no use here: between two stacks the widget has no
/// animation running, so it looks settled while the timer for the next backer
/// is still pending, and the pump stops after the first one. Stepping through
/// the interval by hand also lets the periodic timer reach the tick where it
/// cancels itself, which the test framework insists on.
Future<void> _runOut(WidgetTester tester, int backers) async {
  for (var i = 0; i < backers + 2; i++) {
    await tester.pump(const Duration(milliseconds: 620));
  }
}

void main() {
  const backers = [
    Backer(name: 'Ana', amount: 300),
    Backer(name: 'Bo', amount: 500),
    Backer(name: 'Cy', amount: 1500),
    Backer(name: 'Di', amount: 200),
  ];

  testWidgets('the total climbs one backer at a time, not all at once',
      (tester) async {
    await _pump(
      tester,
      const BackerTally(backers: backers, total: 2500, isMoney: true),
    );

    // Before anything has landed the full amount must not be on screen.
    await tester.pump();
    expect(_showsTotal(tester, '2500'), isFalse,
        reason: 'the final total was visible before any backer arrived');

    // Let the first stack land and its roll-up finish.
    await tester.pump(const Duration(milliseconds: 600));
    expect(_showsTotal(tester, '300'), isTrue);
    expect(_showsTotal(tester, '2500'), isFalse,
        reason: 'later backers were counted before they had arrived');

    // Run the rest of the stagger out.
    await _runOut(tester, backers.length);
    expect(_showsTotal(tester, '2500'), isTrue);
  });

  testWidgets('lands on the server total even when the parts disagree',
      (tester) async {
    // Server rounding can leave the parts summing to something other than the
    // total; the tally must show the authoritative figure, never its own sum.
    await _pump(
      tester,
      const BackerTally(
        backers: [Backer(name: 'Ana', amount: 10), Backer(name: 'Bo', amount: 10)],
        total: 25,
        isMoney: true,
      ),
    );

    await _runOut(tester, 2);
    expect(_showsTotal(tester, '25'), isTrue);
  });

  testWidgets('every backer gets a named chip', (tester) async {
    await _pump(
      tester,
      const BackerTally(backers: backers, total: 2500, isMoney: true),
    );
    await _runOut(tester, backers.length);

    for (final b in backers) {
      expect(find.text(b.name), findsOneWidget);
      expect(find.text('\$${b.amount}'), findsOneWidget);
    }
  });

  testWidgets('a drawing nobody backed still shows a settled zero',
      (tester) async {
    await _pump(
      tester,
      const BackerTally(backers: [], total: 0, isMoney: true),
    );
    await _runOut(tester, 0);

    expect(_showsTotal(tester, '0'), isTrue);
  });

  testWidgets('friendly mode counts points, and pluralises them',
      (tester) async {
    await _pump(
      tester,
      const BackerTally(
        backers: [Backer(name: 'Ana', amount: 1)],
        total: 1,
        isMoney: false,
      ),
    );
    await _runOut(tester, 1);

    expect(_showsTotal(tester, '1 point'), isTrue);
    expect(_showsTotal(tester, r'$'), isFalse,
        reason: 'friendly mode should never show currency');
  });
}
