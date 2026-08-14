import 'package:flutter/foundation.dart';

/// The seam where the real ad and billing SDKs plug in.
///
/// Nothing else in the app talks to an SDK directly — screens ask this for a
/// result and [Entitlements] records it. That keeps purchase logic out of the
/// UI, and means the two integrations below can be done independently.
abstract interface class Store {
  /// Shows a rewarded video. Returns true only if it was watched to the point
  /// where the reward is earned; false if it was skipped, dismissed, or no ad
  /// was available.
  Future<bool> showRewardedAd();

  /// Buys the lifetime palette unlock. Returns true on a completed,
  /// acknowledged purchase.
  Future<bool> buyLifetimePalette();

  /// Restores a previous purchase on a reinstall or a new device. Play
  /// requires this to exist for non-consumable products.
  Future<bool> restorePurchases();

  /// The price to show, formatted for the player's region.
  ///
  /// Must come from the store at runtime once billing is real — Play requires
  /// the localized price, and hardcoding rupees would be wrong for everyone
  /// outside India.
  String get lifetimePrice;
}

/// Stand-in used until the real SDKs are wired up.
///
/// **It grants everything for free.** That is correct for development and
/// wrong for release, so [assertReadyForRelease] fails the build-time check
/// while this is still the active implementation.
class DebugStore implements Store {
  const DebugStore();

  @override
  String get lifetimePrice => '₹99';

  @override
  Future<bool> showRewardedAd() async {
    // Stands in for the ~15s a real rewarded video takes, so the surrounding
    // UI (spinner, disabled buttons, the reward landing) is exercised.
    await Future<void>.delayed(const Duration(seconds: 2));
    return true;
  }

  @override
  Future<bool> buyLifetimePalette() async {
    await Future<void>.delayed(const Duration(seconds: 1));
    return true;
  }

  @override
  Future<bool> restorePurchases() async => false;
}

/// What a release build gets until the SDKs are wired up: every purchase
/// politely fails. Better than granting them, which is what would otherwise
/// reach the Play Store.
class UnavailableStore implements Store {
  const UnavailableStore();

  @override
  String get lifetimePrice => '₹99';

  @override
  Future<bool> showRewardedAd() async => false;

  @override
  Future<bool> buyLifetimePalette() async => false;

  @override
  Future<bool> restorePurchases() async => false;
}

/// Opt in with `--dart-define=DEV_UNLOCKS=true` to build a testable APK where
/// the buttons actually grant what they promise.
///
/// It has to be explicit, because `assert` is stripped from release builds —
/// an assertion guarding this would have silently done nothing in the exact
/// build that matters, and free purchases would have shipped.
const _devUnlocks = bool.fromEnvironment('DEV_UNLOCKS');

/// Swap this for the real implementation before shipping.
///
/// What that involves:
///  - **Ads**: `google_mobile_ads`, a rewarded ad unit, the AdMob app id in
///    `AndroidManifest.xml` and `Info.plist`, and preloading the next ad so
///    tapping "watch" doesn't sit on a spinner.
///  - **Billing**: `in_app_purchase`, a non-consumable product in the Play
///    Console, server-side or local receipt verification, and
///    `restorePurchases` hooked to the real query.
const Store store = (kDebugMode || _devUnlocks)
    ? DebugStore()
    : UnavailableStore();

/// True when unlocks are being granted without a real ad or payment, so the
/// UI can say so rather than looking like a working shop.
const bool unlocksAreFake = kDebugMode || _devUnlocks;
