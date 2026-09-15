import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/lively_prompt.dart';

/// The prompt has to survive being animated: every letter still on screen,
/// in order, and the line not reflowing as weights change.
void main() {
  testWidgets('every letter of the prompt is rendered, in order', (tester) async {
    const prompt = 'A watched pot never boils.';
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Center(child: SizedBox(width: 320, child: LivelyPrompt(text: prompt, answer: 'boils')))),
    ));
    await tester.pump();
    final letters = tester.widgetList<Text>(find.byType(Text)).map((t) => t.data).join();
    expect(letters, prompt.replaceAll(' ', ''));
  });

  testWidgets('the layout holds still while the wave runs', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Center(child: SizedBox(width: 320, child: LivelyPrompt(text: 'The early bird catches the worm.', answer: 'worm')))),
    ));
    await tester.pump();
    final before = tester.getSize(find.byType(LivelyPrompt));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 450));
    }
    expect(tester.getSize(find.byType(LivelyPrompt)), before);
  });
}
