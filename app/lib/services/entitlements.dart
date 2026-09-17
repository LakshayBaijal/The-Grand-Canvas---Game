import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/styles.dart';

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

  // Never rename these keys. They are what a paying player's pass is stored
  // under on their phone; a rename would silently lock everyone out after an
  // update. (Play also re-grants the pass on every launch, see PlayStore, so
  // even a wipe is recoverable, but the local record is what works offline.)
  static const _lifetimeKey = 'palette_lifetime';
  static const _dayPassKey = 'palette_day_pass_until';
  /// The thank-you for playing. Separate key from the ad's day pass because
  /// it's a wider grant — papers and pens as well as colour — and the two
  /// must be able to run at once without either shortening the other.
  static const _thanksKey = 'thanks_pass_until';
  static const _paperKey = 'style_paper';
  static const _penKey = 'style_pen';

  /// The thank-you pass is a flat day. The ad's pass is different: it runs
  /// to midnight -- see [grantDayPass].
  static const dayPass = Duration(hours: 24);

  /// A pass that would end within this long of being granted runs to the
  /// following midnight instead. Nobody should watch an ad at 11pm for an
  /// hour of colours.
  static const _tooShort = Duration(hours: 2);

  /// Finished games on this phone, for spacing the offer after a game.
  static const _gamesKey = 'games_finished';
  int _gamesFinished = 0;

  bool _lifetime = false;
  int _dayPassUntilMs = 0;
  int _thanksUntilMs = 0;
  PaperStyle _paper = PaperStyle.free;
  PenStyle _pen = PenStyle.free;

  bool get hasLifetime => _lifetime;

  /// Whether the thank-you pass is currently running.
  bool get hasThanksPass =>
      DateTime.now().millisecondsSinceEpoch < _thanksUntilMs;

  bool get hasFullPalette =>
      _lifetime ||
      hasThanksPass ||
      DateTime.now().millisecondsSinceEpoch < _dayPassUntilMs;

  /// Steady Hand -- hold still and a shaky shape snaps clean -- unlocks with
  /// the colours: the pass, or a watched video for the day. It is the thing
  /// most worth trying for a day, which is exactly why it's on the free
  /// route and not held back for the pass.
  bool get hasSteadyHand => hasFullPalette;

  /// Paper and pen styles, and the Steady Hand tools, are purchase-only — an
  /// ad never grants them. The
  /// thank-you is the one exception, and it is the whole point of it: a day
  /// of the real thing is a far better argument for buying the pass than a
  /// screenshot of it.
  bool get hasStyles => _lifetime || hasThanksPass;

  /// The chosen styles, falling back to the free ones whenever the pack isn't
  /// owned. Reading through this getter means a lapsed or refunded purchase
  /// can't leave someone drawing on paper they no longer have.
  PaperStyle get paper => hasStyles ? _paper : PaperStyle.free;
  PenStyle get pen => hasStyles ? _pen : PenStyle.free;

  /// Time left on a temporary pass, whichever is running longer, or null
  /// when there isn't one. Lifetime owners have no clock to show.
  Duration? get dayPassLeft {
    if (_lifetime) return null;
    final until = _dayPassUntilMs > _thanksUntilMs ? _dayPassUntilMs : _thanksUntilMs;
    final ms = until - DateTime.now().millisecondsSinceEpoch;
    return ms > 0 ? Duration(milliseconds: ms) : null;
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _lifetime = prefs.getBool(_lifetimeKey) ?? false;
    _dayPassUntilMs = prefs.getInt(_dayPassKey) ?? 0;
    _gamesFinished = prefs.getInt(_gamesKey) ?? 0;
    _thanksUntilMs = prefs.getInt(_thanksKey) ?? 0;
    _paper = PaperStyle.fromId(prefs.getString(_paperKey));
    _pen = PenStyle.fromId(prefs.getString(_penKey));
    notifyListeners();
  }

  Future<void> choosePaper(PaperStyle style) async {
    _paper = style;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_paperKey, style.id);
    notifyListeners();
  }

  Future<void> choosePen(PenStyle style) async {
    _pen = style;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_penKey, style.id);
    notifyListeners();
  }

  /// Earned by watching a rewarded ad. Runs until midnight, local time.
  ///
  /// A calendar day rather than 24 hours from now: "until tonight" is a
  /// thing a person can hold in their head, and every day starts fresh for
  /// everyone -- so the ad is worth watching again tomorrow, whenever
  /// yesterday's was watched. See [_tooShort] for the late-evening case.
  Future<void> grantDayPass() async {
    _dayPassUntilMs = nextMidnight(DateTime.now()).millisecondsSinceEpoch;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_dayPassKey, _dayPassUntilMs);
    notifyListeners();
  }

  /// The midnight an ad watched at [now] runs to. Local time, so it is the
  /// player's own midnight. Static and pure so it can be tested.
  static DateTime nextMidnight(DateTime now) {
    var midnight = DateTime(now.year, now.month, now.day + 1);
    if (midnight.difference(now) < _tooShort) {
      midnight = DateTime(now.year, now.month, now.day + 2);
    }
    return midnight;
  }

  /// A game just ended on this phone. Returns whether the after-game offer
  /// should be shown this time: every second game, and never while any pass
  /// is running -- the strip sells what they already have otherwise.
  Future<bool> noteGameFinished() async {
    _gamesFinished++;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_gamesKey, _gamesFinished);
    return _gamesFinished.isOdd && !hasFullPalette;
  }

  /// A day of everything, given for having played — not for rating anything.
  /// Google Play bans incentivised reviews, and its review API deliberately
  /// reports neither whether someone rated nor what they gave, so there is no
  /// signal to tie a reward to even if it were allowed. This is a milestone
  /// reward and nothing it shows mentions rating.
  Future<void> grantThanksPass() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final from = _thanksUntilMs > now ? _thanksUntilMs : now;
    _thanksUntilMs = from + dayPass.inMilliseconds;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_thanksKey, _thanksUntilMs);
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
    _thanksUntilMs = 0;
    _paper = PaperStyle.free;
    _pen = PenStyle.free;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lifetimeKey);
    await prefs.remove(_dayPassKey);
    await prefs.remove(_thanksKey);
    await prefs.remove(_paperKey);
    await prefs.remove(_penKey);
    notifyListeners();
  }
}
