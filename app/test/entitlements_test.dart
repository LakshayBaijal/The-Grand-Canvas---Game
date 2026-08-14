import 'package:bad_mental_canvas/services/entitlements.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final entitlements = Entitlements.instance;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await entitlements.reset();
  });

  test('the palette starts locked', () async {
    await entitlements.load();
    expect(entitlements.hasFullPalette, isFalse);
    expect(entitlements.hasLifetime, isFalse);
    expect(entitlements.dayPassLeft, isNull);
  });

  test('watching an ad unlocks it for a day', () async {
    await entitlements.grantDayPass();

    expect(entitlements.hasFullPalette, isTrue);
    expect(entitlements.hasLifetime, isFalse);
    final left = entitlements.dayPassLeft!;
    expect(left.inHours, greaterThanOrEqualTo(23));
    expect(left.inHours, lessThanOrEqualTo(24));
  });

  test('a second ad extends the pass instead of wasting it', () async {
    await entitlements.grantDayPass();
    await entitlements.grantDayPass();

    // Watching again part-way through should stack, not restart from now.
    expect(entitlements.dayPassLeft!.inHours, greaterThanOrEqualTo(47));
  });

  test('a day pass survives a restart', () async {
    await entitlements.grantDayPass();
    await entitlements.load(); // as if the app were reopened
    expect(entitlements.hasFullPalette, isTrue);
  });

  test('an expired pass locks the palette again', () async {
    SharedPreferences.setMockInitialValues({
      'palette_day_pass_until': DateTime.now().millisecondsSinceEpoch - 1000,
    });
    await entitlements.load();

    expect(entitlements.hasFullPalette, isFalse);
    expect(entitlements.dayPassLeft, isNull);
  });

  test('buying it is permanent and survives a restart', () async {
    await entitlements.grantLifetime();
    await entitlements.load();

    expect(entitlements.hasLifetime, isTrue);
    expect(entitlements.hasFullPalette, isTrue);
    // Nothing to count down — it never runs out.
    expect(entitlements.dayPassLeft, isNull);
  });

  test('listeners fire so the palette repaints the moment it unlocks', () async {
    await entitlements.load();
    var notified = 0;
    void listener() => notified++;
    entitlements.addListener(listener);

    await entitlements.grantDayPass();
    await entitlements.grantLifetime();

    expect(notified, 2);
    entitlements.removeListener(listener);
  });
}
