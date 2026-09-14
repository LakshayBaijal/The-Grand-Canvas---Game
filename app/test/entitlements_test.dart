import 'package:bad_mental_canvas/models/styles.dart';
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

  group('styles are purchase-only', () {
    test('an ad unlocks colours but never paper or pens', () async {
      await entitlements.grantDayPass();

      // This is the whole business model: if watching a video granted styles
      // too, there would be no reason left to buy anything.
      expect(entitlements.hasFullPalette, isTrue);
      expect(entitlements.hasStyles, isFalse);
    });

    test('buying unlocks both', () async {
      await entitlements.grantLifetime();

      expect(entitlements.hasFullPalette, isTrue);
      expect(entitlements.hasStyles, isTrue);
    });

    test('a chosen style is ignored until it is owned, then applies', () async {
      await entitlements.choosePaper(PaperStyle.kraft);
      await entitlements.choosePen(PenStyle.crayon);

      // Chosen but not owned — everyone else must not see a sheet this player
      // hasn't paid for.
      expect(entitlements.paper, PaperStyle.plain);
      expect(entitlements.pen, PenStyle.pen);

      await entitlements.grantLifetime();
      expect(entitlements.paper, PaperStyle.kraft);
      expect(entitlements.pen, PenStyle.crayon);
    });

    test('a day pass does not bring chosen styles with it', () async {
      await entitlements.choosePaper(PaperStyle.graph);
      await entitlements.grantDayPass();

      expect(entitlements.hasFullPalette, isTrue);
      expect(entitlements.paper, PaperStyle.plain);
    });

    test('choices survive a restart', () async {
      await entitlements.grantLifetime();
      await entitlements.choosePaper(PaperStyle.dots);
      await entitlements.choosePen(PenStyle.brush);
      await entitlements.load();

      expect(entitlements.paper, PaperStyle.dots);
      expect(entitlements.pen, PenStyle.brush);
    });

    test('every style has a stable id that round-trips', () {
      for (final style in PaperStyle.values) {
        expect(PaperStyle.fromId(style.id), style);
      }
      for (final style in PenStyle.values) {
        expect(PenStyle.fromId(style.id), style);
      }
      // Unknown ids (an older client, a bot drawing) fall back to the free one.
      expect(PaperStyle.fromId(null), PaperStyle.plain);
      expect(PaperStyle.fromId('nonsense'), PaperStyle.plain);
      expect(PenStyle.fromId('nonsense'), PenStyle.pen);
    });
  });

  group('the thank-you pass', () {
    test('gives everything the pass gives, but only for a day', () async {
      await entitlements.grantThanksPass();

      expect(entitlements.hasFullPalette, isTrue);
      // The one place styles are given away. It is what makes the day worth
      // something: a screenshot of a brush never sold anyone a brush.
      expect(entitlements.hasStyles, isTrue);
      expect(entitlements.hasLifetime, isFalse, reason: 'it is not a purchase');
      expect(entitlements.dayPassLeft, isNotNull);
    });

    test('a chosen paper and pen actually apply while it runs', () async {
      await entitlements.grantThanksPass();
      await entitlements.choosePaper(PaperStyle.kraft);
      await entitlements.choosePen(PenStyle.brush);

      expect(entitlements.paper, PaperStyle.kraft);
      expect(entitlements.pen, PenStyle.brush);
    });

    test('when it runs out the styles lock again, choice intact', () async {
      SharedPreferences.setMockInitialValues({
        'thanks_pass_until': DateTime.now()
            .subtract(const Duration(minutes: 1))
            .millisecondsSinceEpoch,
        'style_paper': PaperStyle.kraft.id,
        'style_pen': PenStyle.brush.id,
      });
      await entitlements.load();

      expect(entitlements.hasStyles, isFalse);
      expect(entitlements.hasFullPalette, isFalse);
      // The choice is remembered, so buying the pass later restores what they
      // picked rather than dumping them back on plain paper.
      expect(entitlements.paper, PaperStyle.free);
      expect(entitlements.pen, PenStyle.free);
    });

    test('it survives a restart', () async {
      await entitlements.grantThanksPass();
      await entitlements.load();

      expect(entitlements.hasStyles, isTrue);
    });

    test('it and an ad pass do not eat each other', () async {
      // Different keys on purpose: a watched ad landing mid-thank-you must
      // not shorten either one.
      await entitlements.grantThanksPass();
      final thanks = entitlements.dayPassLeft!;
      await entitlements.grantDayPass();

      expect(entitlements.hasStyles, isTrue, reason: 'the thank-you still runs');
      expect(entitlements.dayPassLeft!.inMinutes, greaterThanOrEqualTo(thanks.inMinutes - 1));
    });
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
