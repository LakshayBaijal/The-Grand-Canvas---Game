import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/services/entitlements.dart';

/// The ad's pass runs to midnight, local time, not 24 hours from the tap.
void main() {
  test('an afternoon ad runs to tonight', () {
    final until = Entitlements.nextMidnight(DateTime(2026, 9, 17, 15, 30));
    expect(until, DateTime(2026, 9, 18));
  });

  test('a late-evening ad runs to tomorrow night, not for forty minutes', () {
    final until = Entitlements.nextMidnight(DateTime(2026, 9, 17, 23, 20));
    expect(until, DateTime(2026, 9, 19));
  });

  test('just after midnight is the whole day', () {
    final until = Entitlements.nextMidnight(DateTime(2026, 9, 18, 0, 5));
    expect(until, DateTime(2026, 9, 19));
  });

  test('month ends are handled by the calendar, not by us', () {
    expect(Entitlements.nextMidnight(DateTime(2026, 9, 30, 10)), DateTime(2026, 10, 1));
    expect(Entitlements.nextMidnight(DateTime(2026, 12, 31, 23, 30)), DateTime(2027, 1, 2));
  });
}
