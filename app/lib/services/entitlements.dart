import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// What the player has unlocked.
///
/// The free game is complete — every mode, every prompt, the full canvas, the
/// leaderboard. The only thing gated is the **colour palette**: black, yellow
/// and the eraser are always available, which is enough to draw anything the
/// game asks for. Colour is decoration, so paying for it never buys an
/// advantage over anyone else. That matters for a competitive mode.
///
/// Deliberately no interstitials, no banners, no "watch an ad to continue".
/// The only ad in the game is one the player chooses to watch, from a screen
/// they opened themselves.
class Entitlements extends ChangeNotifier {
  Entitlements._();

  /// One instance for the app; [load] is called once at startup.
  static final instance = Entitlements._();

  static const _lifetimeKey = 'palette_lifetime';
  static const _dayPassKey = 'palette_day_pass_until';

  /// How long one watched ad is worth.
  static const dayPass = Duration(hours: 24);

  bool _lifetime = false;
  int _dayPassUntilMs = 0;

  bool get hasLifetime => _lifetime;

  bool get hasFullPalette =>
      _lifetime || DateTime.now().millisecondsSinceEpoch < _dayPassUntilMs;

  /// Time left on a watched-ad pass, or null when there isn't one running.
  Duration? get dayPassLeft {
    if (_lifetime) return null;
    final ms = _dayPassUntilMs - DateTime.now().millisecondsSinceEpoch;
    return ms > 0 ? Duration(milliseconds: ms) : null;
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _lifetime = prefs.getBool(_lifetimeKey) ?? false;
    _dayPassUntilMs = prefs.getInt(_dayPassKey) ?? 0;
    notifyListeners();
  }

  /// Earned by watching a rewarded ad. Extends rather than replaces, so
  /// watching a second one part-way through a pass isn't wasted.
  Future<void> grantDayPass() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final from = _dayPassUntilMs > now ? _dayPassUntilMs : now;
    _dayPassUntilMs = from + dayPass.inMilliseconds;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_dayPassKey, _dayPassUntilMs);
    notifyListeners();
  }

  Future<void> grantLifetime() async {
    _lifetime = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_lifetimeKey, true);
    notifyListeners();
  }

  /// For testing the locked state during development.
  @visibleForTesting
  Future<void> reset() async {
    _lifetime = false;
    _dayPassUntilMs = 0;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lifetimeKey);
    await prefs.remove(_dayPassKey);
    notifyListeners();
  }
}
