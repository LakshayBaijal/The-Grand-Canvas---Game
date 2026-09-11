/// The arithmetic behind the daily reminder, kept free of any plugin so it
/// can be tested as plain Dart.
///
/// The server hands over the next fortnight of prompts, each with the UTC
/// midnight it goes live at. The phone wants to fire once a day at a local
/// hour. The only real question is which prompt is *live* at that local
/// moment — for someone east of UTC the 9am notification is the same UTC day,
/// for someone far enough west it is still yesterday's prompt, and either way
/// it must be the one the app would show if they opened it right then.
library;

class UpcomingDay {
  const UpcomingDay({required this.day, required this.prompt, required this.startsAtMs});

  /// Whole days since the epoch, UTC.
  final int day;
  final String prompt;

  /// Midnight UTC at the start of this day: when the prompt goes live.
  final int startsAtMs;

  factory UpcomingDay.fromJson(Map<String, dynamic> json) => UpcomingDay(
        day: json['day'] as int,
        prompt: json['prompt'] as String,
        startsAtMs: json['startsAtMs'] as int,
      );

  Map<String, dynamic> toJson() => {'day': day, 'prompt': prompt, 'startsAtMs': startsAtMs};
}

/// One notification to schedule.
class PlannedReminder {
  const PlannedReminder({required this.fireAt, required this.day, required this.prompt});

  /// Local wall-clock time to fire.
  final DateTime fireAt;
  final int day;
  final String prompt;
}

const int _dayMs = 24 * 60 * 60 * 1000;

/// The prompt live at [instant], or null if [days] doesn't cover it.
UpcomingDay? promptLiveAt(List<UpcomingDay> days, DateTime instant) {
  final ms = instant.toUtc().millisecondsSinceEpoch;
  for (final d in days) {
    if (ms >= d.startsAtMs && ms < d.startsAtMs + _dayMs) return d;
  }
  return null;
}

/// Every reminder worth scheduling from [now]: one per local day at [hour],
/// skipping any that has already passed today, for as far as [days] reaches.
///
/// Two consecutive fire times can carry the same prompt when the local day
/// straddles the UTC boundary oddly (a 9am far west of UTC is still the
/// previous UTC day). That is correct — it is what the app would show — but
/// it would read as a repeat, so the second of any two identical prompts in a
/// row is dropped.
List<PlannedReminder> planReminders(
  List<UpcomingDay> days,
  DateTime now, {
  int hour = 9,
  int horizonDays = 14,
}) {
  final out = <PlannedReminder>[];
  for (var i = 0; i < horizonDays; i++) {
    final fireAt = DateTime(now.year, now.month, now.day + i, hour);
    if (!fireAt.isAfter(now)) continue;
    final live = promptLiveAt(days, fireAt);
    if (live == null) continue;
    if (out.isNotEmpty && out.last.day == live.day) continue;
    out.add(PlannedReminder(fireAt: fireAt, day: live.day, prompt: live.prompt));
  }
  return out;
}
