import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/player_avatar.dart';

/// The face must never be a broken image: no URL means the letter, and a
/// URL that fails to load (as every URL does in a test) still shows the
/// letter underneath.
void main() {
  testWidgets('no picture: the initial on a disc', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: PlayerAvatar(name: 'riya', radius: 20),
    ));
    expect(find.text('R'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('a picture that cannot load leaves the initial showing', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: PlayerAvatar(
        name: 'Dev',
        radius: 20,
        avatarUrl: 'https://lh3.googleusercontent.com/a/nobody=s96-c',
      ),
    ));
    await tester.pump();
    expect(find.text('D'), findsOneWidget, reason: 'the letter is under the picture, not replaced by it');
    // The request goes out at the size we draw, not the size Google chose.
    final img = tester.widget<Image>(find.byType(Image)).image as NetworkImage;
    expect(img.url, endsWith('/a/nobody=s120-c'));
  });

  testWidgets('an empty name still draws something', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PlayerAvatar(name: '', radius: 20)));
    expect(find.text('?'), findsOneWidget);
  });
}
