import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bad_mental_canvas/models/lobby_state.dart';
import 'package:bad_mental_canvas/models/round_models.dart';
import 'package:bad_mental_canvas/screens/game_screen.dart';
import 'package:bad_mental_canvas/services/game_connection.dart';

/// Leaving a game has to tell the server, whichever way the player leaves.
///
/// This is a regression test for a bug that stranded people: the system back
/// gesture popped [GameScreen] directly, so `leave_lobby` was never sent, the
/// server went on believing the player was seated, and every later attempt to
/// create or join a friendly lobby was rejected with "You're already in a
/// lobby" — with no way out short of restarting the app.

class _SpyConnection extends GameConnection {
  int leaveCount = 0;

  // A game screen only ever exists on top of a live connection, and leaving
  // only tells the server when the socket is up (on a dead one there is
  // nobody to tell). The spy has no socket, so it says so explicitly.
  @override
  bool get isConnected => true;

  @override
  void leaveLobby() => leaveCount++;

  // The real one writes to a socket that does not exist in a test.
  @override
  void requestDoodle() {}
}

LobbyState _lobby() => const LobbyState(
      code: 'ABCD',
      hostId: 'me',
      mode: GameMode.friendly,
      players: [
        Player(id: 'me', nickname: 'Lakshay', isBot: false),
        Player(id: 'other', nickname: 'Sam', isBot: false),
      ],
    );

Future<void> _openGame(WidgetTester tester, _SpyConnection connection) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => ElevatedButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => GameScreen(
                connection: connection,
                initialLobby: _lobby(),
                myId: 'me',
              ),
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  // Fixed pumps rather than pumpAndSettle: the lobby runs a permanent idle
  // animation behind it, so the tree never reaches a settled state.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

/// Long enough for the pop to finish.
///
/// Two animations run back to back here — the phase switcher inside the game
/// and then the route transition out of it — so a single short pump leaves the
/// screen still on the tree and makes this look like a failure to pop.
Future<void> _settleRoute(WidgetTester tester) async {
  await tester.pump();
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

void main() {
  testWidgets('the system back gesture leaves the lobby on the server',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final connection = _SpyConnection();
    await _openGame(tester, connection);
    expect(find.byType(GameScreen), findsOneWidget);

    // What the OS back button/gesture actually does.
    await tester.binding.handlePopRoute();
    await _settleRoute(tester);

    expect(connection.leaveCount, 1,
        reason: 'backing out must tell the server, or the player stays seated '
            'and can never join another lobby');
    expect(find.byType(GameScreen), findsNothing,
        reason: 'the player should still end up back at the menu');
  });

  testWidgets('leaving twice does not double-send', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final connection = _SpyConnection();
    await _openGame(tester, connection);

    await tester.binding.handlePopRoute();
    await _settleRoute(tester);
    // A second gesture now belongs to the menu underneath, not the game.
    await tester.binding.handlePopRoute();
    await _settleRoute(tester);

    expect(connection.leaveCount, 1);
  });
}
