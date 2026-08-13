import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/main.dart';

void main() {
  testWidgets('Home screen offers quick play and friend lobbies', (WidgetTester tester) async {
    await tester.pumpWidget(const BadMentalCanvasApp());

    expect(find.text('BAD MENTAL\nCANVAS'), findsOneWidget);
    expect(find.text('QUICK PLAY'), findsOneWidget);
    expect(find.text('CREATE PRIVATE LOBBY'), findsOneWidget);
    expect(find.text('JOIN WITH CODE'), findsOneWidget);
  });
}
