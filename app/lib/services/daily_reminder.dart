import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';
// latest_all, not latest: the smaller set drops legacy alias names, and
// Android still reports India as "Asia/Calcutta" (the database's name is
// "Asia/Kolkata"). Without the aliases the lookup fails on every phone in
// the game's home market and the reminder fires at the wrong hour.
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'reminder_plan.dart';

/// "Today's prompt: A snail on its way somewhere important." at 9am.
///
/// Entirely local: the server supplies the next fortnight of prompts whenever
/// the app connects, and the phone schedules a notification a day from that.
/// No push service, no tokens, nothing for the server to send — and if the
/// app isn't opened for two weeks, the reminders simply run out, which is the
/// polite thing for them to do.
///
/// Off until the player says yes. The question is asked once, right after
/// their first Daily submission — the moment they have just found out what
/// the reminder would be *for* — and never again unless they change it from
/// the gallery.
class DailyReminder extends ChangeNotifier {
  DailyReminder._();

  static final instance = DailyReminder._();

  static const _enabledKey = 'daily_reminder_enabled';
  static const _decidedKey = 'daily_reminder_decided';
  static const _cacheKey = 'daily_reminder_days';
  static const _channelId = 'daily_prompt';
  static const hour = 9;

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  bool _enabled = false;
  bool _decided = false;

  /// Set when the app was opened by tapping a reminder, and cleared once the
  /// home screen has acted on it.
  bool launchedFromReminder = false;

  /// Fires when a reminder is tapped while the app is already running.
  VoidCallback? onTapped;

  bool get enabled => _enabled;

  /// Whether the player has ever answered the "remind me?" question.
  bool get decided => _decided;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _enabled = prefs.getBool(_enabledKey) ?? false;
    _decided = prefs.getBool(_decidedKey) ?? false;

    tzdata.initializeTimeZones();
    try {
      final info = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(info.identifier));
    } catch (e) {
      // Unknown name. Rather than fall back to UTC (a wrong hour for
      // everyone east or west of Greenwich), take any zone whose current
      // offset matches the phone's: the reminder then fires at the right
      // local hour even if the name is one we've never heard of.
      debugPrint('DailyReminder: could not resolve the local timezone ($e)');
      final offset = DateTime.now().timeZoneOffset;
      for (final location in tz.timeZoneDatabase.locations.values) {
        if (location.currentTimeZone.offset == offset) {
          tz.setLocalLocation(location);
          debugPrint('DailyReminder: using ${location.name} by offset');
          break;
        }
      }
    }

    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
        onDidReceiveNotificationResponse: (_) => onTapped?.call(),
      );
      final launch = await _plugin.getNotificationAppLaunchDetails();
      launchedFromReminder = launch?.didNotificationLaunchApp ?? false;
      _ready = true;
    } catch (e) {
      debugPrint('DailyReminder: notifications unavailable ($e)');
    }

    // Re-arm from the last known fortnight, so a phone that was rebooted or
    // had the app killed still has its reminders before the next connection.
    if (_enabled) {
      final cached = prefs.getString(_cacheKey);
      if (cached != null) {
        final days = (jsonDecode(cached) as List)
            .map((d) => UpcomingDay.fromJson(d as Map<String, dynamic>))
            .toList();
        await schedule(days);
      }
    }
    notifyListeners();
  }

  /// Asks the OS, then remembers the answer either way. Returns whether the
  /// reminder is now on.
  Future<bool> enable() async {
    var granted = true;
    if (_ready) {
      final android = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      granted = await android?.requestNotificationsPermission() ?? true;
    }
    await _setEnabled(granted);
    return granted;
  }

  Future<void> disable() async {
    await _setEnabled(false);
    if (_ready) await _plugin.cancelAll();
  }

  Future<void> _setEnabled(bool on) async {
    _enabled = on;
    _decided = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, on);
    await prefs.setBool(_decidedKey, true);
    notifyListeners();
  }

  /// Records that the player declined, so the question isn't asked again.
  Future<void> decline() => _setEnabled(false);

  /// Replaces every pending reminder with one per day from [days].
  Future<void> schedule(List<UpcomingDay> days) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _cacheKey,
      jsonEncode(days.map((d) => d.toJson()).toList()),
    );
    if (!_enabled || !_ready) return;

    await _plugin.cancelAll();
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        'Daily prompt',
        channelDescription: "Each morning's drawing prompt",
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
        styleInformation: BigTextStyleInformation(''),
      ),
    );
    for (final r in planReminders(days, DateTime.now(), hour: hour)) {
      final when = tz.TZDateTime.from(r.fireAt, tz.local);
      try {
        await _plugin.zonedSchedule(
          id: r.day % 100000,
          scheduledDate: when,
          notificationDetails: details,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          title: "Today's prompt",
          body: r.prompt,
          payload: 'daily',
        );
      } catch (e) {
        debugPrint('DailyReminder: could not schedule day ${r.day} ($e)');
      }
    }
  }
}
