import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/services/game_connection.dart';

/// Going live should be typing a hostname, not editing code: a LAN address
/// dials plain ws://, a hosted one dials wss://.
void main() {
  test('LAN addresses dial ws://', () {
    expect(serverUri('192.168.1.20:8090').toString(), 'ws://192.168.1.20:8090');
    expect(serverUri('10.0.0.5').toString(), 'ws://10.0.0.5');
    expect(serverUri('localhost:8090').toString(), 'ws://localhost:8090');
    expect(serverUri('lakshays-laptop.local:8090').toString(), 'ws://lakshays-laptop.local:8090');
    expect(serverUri('gameserver:8090').toString(), 'ws://gameserver:8090');
  });

  test('hosted addresses dial wss://', () {
    expect(serverUri('grandcanvas.up.railway.app').toString(), 'wss://grandcanvas.up.railway.app');
    expect(serverUri('play.whosegames.com').toString(), 'wss://play.whosegames.com');
    expect(serverUri('  play.whosegames.com  ').toString(), 'wss://play.whosegames.com');
  });

  test('an explicit scheme is always respected', () {
    expect(serverUri('ws://play.whosegames.com:8090').toString(), 'ws://play.whosegames.com:8090');
    expect(serverUri('wss://192.168.1.20').toString(), 'wss://192.168.1.20');
  });
}
