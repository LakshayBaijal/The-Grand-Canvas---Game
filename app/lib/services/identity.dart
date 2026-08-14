import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// The player's permanent account on this device.
///
/// [playerId] is generated once, the first time the app runs, and never
/// changes — it's what the server keys profiles and the leaderboard on, so
/// trophies survive closing the app, changing your name, or switching Wi-Fi.
/// Deleting the app is the only thing that clears it, exactly as if the
/// account lived on the device.
///
/// The nickname is stored alongside it so nobody has to retype it, but it's
/// just a label: renaming keeps the same account and the same trophies.
class Identity {
  const Identity({required this.playerId, required this.nickname});

  final String playerId;
  final String nickname;

  bool get hasNickname => nickname.trim().isNotEmpty;
}

const _idKey = 'player_id';
const _nicknameKey = 'player_nickname';

/// Loads the account, creating the id on first run. The nickname comes back
/// empty until the player picks one.
Future<Identity> loadIdentity() async {
  final prefs = await SharedPreferences.getInstance();
  var id = prefs.getString(_idKey);
  if (id == null || id.isEmpty) {
    id = _generateId();
    await prefs.setString(_idKey, id);
  }
  return Identity(playerId: id, nickname: prefs.getString(_nicknameKey) ?? '');
}

Future<void> saveNickname(String nickname) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_nicknameKey, nickname.trim());
}

/// A random 128-bit id, hex encoded. Uses [Random.secure] so two devices can't
/// collide onto one leaderboard entry.
String _generateId() {
  final rnd = Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}
