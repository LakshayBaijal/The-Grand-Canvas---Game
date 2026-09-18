import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/models/game_event.dart';
import 'package:bad_mental_canvas/services/game_connection.dart';

/// A connection the server has stopped answering is dead, however open the
/// socket claims to be. The app must notice on its own -- the OS takes
/// minutes -- and go through the ordinary disconnect path.
void main() {
  test('a silent server is treated as a dropped connection', () async {
    // A server that says hello and then never speaks again.
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final sockets = <WebSocket>[];
    server.listen((req) async {
      final ws = await WebSocketTransformer.upgrade(req);
      sockets.add(ws);
      ws.add(jsonEncode({'type': 'welcome', 'connectionId': 'x'}));
      ws.listen((_) {}); // reads pings, answers nothing
    });

    final c = GameConnection(
      keepaliveEvery: const Duration(milliseconds: 60),
      silence: const Duration(milliseconds: 200),
    );
    final dropped = Completer<void>();
    final sub = c.events.listen((e) {
      if (e is DisconnectedEvent && !dropped.isCompleted) dropped.complete();
    });

    await c.connect('127.0.0.1:${server.port}');
    expect(c.isConnected, isTrue);
    expect(c.isResponsive, isTrue);

    // Well under a second: two silent keepalives and the watchdog hangs up.
    await dropped.future.timeout(const Duration(seconds: 3));
    expect(c.isConnected, isFalse, reason: 'the socket was closed by the app');

    await sub.cancel();
    for (final s in sockets) {
      await s.close();
    }
    await server.close(force: true);
    c.dispose();
  });

  test('a server that answers is left alone', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final sockets = <WebSocket>[];
    server.listen((req) async {
      final ws = await WebSocketTransformer.upgrade(req);
      sockets.add(ws);
      ws.add(jsonEncode({'type': 'welcome', 'connectionId': 'x'}));
      ws.listen((msg) {
        if (jsonDecode(msg as String)['type'] == 'ping') {
          ws.add(jsonEncode({'type': 'pong', 'serverTimeMs': 0}));
        }
      });
    });
    final c = GameConnection(
      keepaliveEvery: const Duration(milliseconds: 60),
      silence: const Duration(milliseconds: 200),
    );
    var drops = 0;
    final sub = c.events.listen((e) {
      if (e is DisconnectedEvent) drops++;
    });
    await c.connect('127.0.0.1:${server.port}');
    await Future<void>.delayed(const Duration(milliseconds: 700));
    expect(drops, 0);
    expect(c.isConnected, isTrue);
    await sub.cancel();
    await c.disconnect();
    for (final s in sockets) {
      await s.close();
    }
    await server.close(force: true);
    c.dispose();
  });
}
