import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bad_mental_canvas/models/game_event.dart';
import 'package:bad_mental_canvas/models/lobby_state.dart';
import 'package:bad_mental_canvas/models/round_models.dart';
import 'package:bad_mental_canvas/screens/game_screen.dart';
import 'package:bad_mental_canvas/services/game_connection.dart';
import 'package:bad_mental_canvas/views/draw_view.dart';

/// A dropped connection mid-round must not throw away the round.
///
/// The reconnect screen used to *replace* the phase view, which disposed the
/// drawing view and everything in it -- so a two-second blip came back to a
/// blank canvas. It is now laid over the top, and the view underneath stays
/// exactly where it was.

class _FeedConnection extends GameConnection {
  final _feed = StreamController<GameEvent>.broadcast();

  @override
  Stream<GameEvent> get events => _feed.stream;

  void emit(GameEvent e) => _feed.add(e);

  @override
  bool get isConnected => true;

  @override
  Future<bool> reconnect() async => false;

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

void main() {
  testWidgets('the drawing view survives a disconnect', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final connection = _FeedConnection();
    await tester.pumpWidget(
      MaterialApp(
        home: GameScreen(connection: connection, initialLobby: _lobby(), myId: 'me'),
      ),
    );
    await tester.pump();

    connection.emit(RoundStartEvent(
      prompt: 'Draw a thing',
      deadlineMs: DateTime.now().millisecondsSinceEpoch + 60_000,
      roundIndex: 0,
      totalRounds: 2,
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(DrawView), findsOneWidget);
    final before = tester.state(find.byType(DrawView));

    connection.emit(const DisconnectedEvent());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Lost the connection — getting you back in'), findsOneWidget);
    expect(find.byType(DrawView), findsOneWidget,
        reason: 'the reconnect notice goes over the drawing, not in place of it');
    expect(identical(tester.state(find.byType(DrawView)), before), isTrue,
        reason: 'same widget state: the strokes are still there');

    // The same round arriving again on resume lands on the same view.
    connection.emit(RoundStartEvent(
      prompt: 'Draw a thing',
      deadlineMs: DateTime.now().millisecondsSinceEpoch + 50_000,
      roundIndex: 0,
      totalRounds: 2,
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Lost the connection — getting you back in'), findsNothing);
    expect(identical(tester.state(find.byType(DrawView)), before), isTrue);

    // Timers the drawing view owns; let them out before the test ends.
    await tester.pumpWidget(const SizedBox());
  });
}
