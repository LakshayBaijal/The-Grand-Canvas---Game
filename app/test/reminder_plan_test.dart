import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/services/reminder_plan.dart';

const _day = 24 * 60 * 60 * 1000;

/// A fortnight starting at the UTC day containing [from].
List<UpcomingDay> fortnight(DateTime from) {
  final day0 = from.toUtc().millisecondsSinceEpoch ~/ _day;
  return List.generate(
    14,
    (i) => UpcomingDay(day: day0 + i, prompt: 'prompt ${day0 + i}', startsAtMs: (day0 + i) * _day),
  );
}

void main() {
  test('the live prompt is the one whose UTC day contains the instant', () {
    final days = fortnight(DateTime.utc(2026, 9, 12));
    expect(promptLiveAt(days, DateTime.utc(2026, 9, 12, 0, 0, 1))?.day, days[0].day);
    expect(promptLiveAt(days, DateTime.utc(2026, 9, 12, 23, 59))?.day, days[0].day);
    expect(promptLiveAt(days, DateTime.utc(2026, 9, 13, 0, 0))?.day, days[1].day);
    expect(promptLiveAt(days, DateTime.utc(2026, 9, 11, 23, 59)), isNull, reason: 'before the window');
    expect(promptLiveAt(days, DateTime.utc(2026, 10, 1)), isNull, reason: 'after the window');
  });

  test("a 9am that has already passed today isn't scheduled", () {
    // Local time in these tests is whatever the machine's is; only the
    // relationships matter, not the zone.
    final days = fortnight(DateTime.now());
    final now = DateTime(2026, 9, 12, 10); // 10am: today's 9am is gone
    final plan = planReminders(fortnight(now), now);
    expect(plan.first.fireAt.isAfter(now), isTrue);
    expect(plan.first.fireAt.day, 13);
    expect(days.length, 14);
  });

  test('one reminder per local day, at the hour, for as long as prompts last', () {
    final now = DateTime(2026, 9, 12, 8); // 8am: today's 9am is still ahead
    final plan = planReminders(fortnight(now), now);
    expect(plan.isNotEmpty, isTrue);
    expect(plan.first.fireAt, DateTime(2026, 9, 12, 9));
    for (var i = 1; i < plan.length; i++) {
      expect(plan[i].fireAt.difference(plan[i - 1].fireAt).inHours, anyOf(23, 24, 25),
          reason: 'consecutive days, allowing for a DST shift');
      expect(plan[i].fireAt.hour, 9);
    }
    // Never past what the server sent.
    expect(plan.length, lessThanOrEqualTo(14));
  });

  test('the same prompt is never announced twice in a row', () {
    final now = DateTime(2026, 9, 12, 8);
    final plan = planReminders(fortnight(now), now);
    for (var i = 1; i < plan.length; i++) {
      expect(plan[i].day, isNot(plan[i - 1].day));
    }
  });

  test('nothing to say when the server sent nothing', () {
    expect(planReminders(const [], DateTime(2026, 9, 12, 8)), isEmpty);
  });
}
