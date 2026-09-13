import 'dart:async';
import 'dart:io';

import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

/// The seam where the ad and billing SDKs plug in.
///
/// Nothing else in the app talks to an SDK directly — screens ask this for a
/// result and [Entitlements] records it. That keeps purchase logic out of the
/// UI, and means the two integrations can be swapped or faked independently.
abstract interface class Store {
  /// Called once at startup, after the Flutter binding is ready.
  Future<void> init();

  /// Shows a rewarded video. Returns true only if it was watched to the point
  /// where the reward is earned; false if it was skipped, dismissed, or no ad
  /// was available.
  Future<bool> showRewardedAd();

  /// Buys the pass. Returns true on a completed, acknowledged purchase.
  Future<bool> buyPass();

  /// Restores a previous purchase on a reinstall or a new device. Play
  /// requires this to exist for non-consumable products.
  Future<bool> restorePurchases();

  /// The price to show, formatted for the player's region. Comes from the
  /// store once it has answered; the placeholder is only for the first
  /// seconds after launch, or when billing is unreachable.
  String get passPrice;

  /// Whether a banner has any chance of loading: false in a fake store, so
  /// the layout doesn't reserve space for nothing.
  bool get bannersEnabled;
}

/// Ad unit and product ids. Baked in at build time from `.env` through
/// `build-app.ps1` (`--dart-define=ADMOB_BANNER_ID=…` and so on). Left
/// empty, every id falls back to Google's official *test* units, which
/// serve real-looking ads that never earn anything — so a build without ids
/// is safe to install and still shows the whole flow working.
class AdIds {
  AdIds._();

  static const _banner = String.fromEnvironment('ADMOB_BANNER_ID');
  static const _rewarded = String.fromEnvironment('ADMOB_REWARDED_ID');
  static const _product = String.fromEnvironment('PASS_PRODUCT_ID');

  static const testBanner = 'ca-app-pub-3940256099942544/6300978111';
  static const testRewarded = 'ca-app-pub-3940256099942544/5224354917';

  static String get banner => _banner.isEmpty ? testBanner : _banner;
  static String get rewarded => _rewarded.isEmpty ? testRewarded : _rewarded;

  /// The in-app product in the Play Console. Non-consumable, one price.
  static String get passProduct =>
      _product.isEmpty ? 'grand_canvas_pass' : _product;

  /// True while any ad id is still a Google test unit. Shown in the sheet so
  /// a build that would earn nothing can't be mistaken for the real thing.
  static bool get usingTestAds => _banner.isEmpty || _rewarded.isEmpty;
}

/// The real thing: AdMob for the video and the banner, Google Play Billing
/// for the pass.
class PlayStore implements Store {
  PlayStore();

  /// Lazy on purpose: touching the instance starts the Play connection,
  /// which must not happen just because a screen mentioned the store.
  InAppPurchase get _iap => InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _purchases;
  ProductDetails? _product;
  bool _billingAvailable = false;

  /// Whoever is waiting on a purchase or a restore right now. Play answers
  /// on a stream rather than returning from the call, so the call parks a
  /// completer here and the stream resolves it.
  Completer<bool>? _pending;

  RewardedAd? _rewarded;
  bool _loadingRewarded = false;

  /// Widget tests run with no platform underneath; an ad request there
  /// would be a channel call into nothing.
  static final _underTest = Platform.environment.containsKey('FLUTTER_TEST');

  @override
  bool get bannersEnabled => !_underTest;

  @override
  String get passPrice => _product?.price ?? '₹99';

  @override
  Future<void> init() async {
    if (_underTest) return;
    // Ads. The app id lives in AndroidManifest.xml (via a Gradle placeholder
    // read from .env); this only starts the SDK and warms the first video.
    unawaited(MobileAds.instance.initialize().then((_) => _loadRewarded()));

    // Billing. Listen first so a purchase that completed while the app was
    // closed (or a refund) is heard the moment the stream replays it.
    _purchases = _iap.purchaseStream.listen(
      _onPurchases,
      onError: (_) {
        _pending?.complete(false);
        _pending = null;
      },
    );
    try {
      _billingAvailable = await _iap.isAvailable();
      if (_billingAvailable) {
        final response = await _iap.queryProductDetails({AdIds.passProduct});
        if (response.productDetails.isNotEmpty) {
          _product = response.productDetails.first;
        }
      }
    } catch (_) {
      _billingAvailable = false;
    }
  }

  /// Resolves whatever's pending, and — the part that matters when nothing
  /// is pending — hands a finished purchase to [onPassOwned] so a reinstall
  /// or a refund is honoured without anyone tapping anything.
  void _onPurchases(List<PurchaseDetails> purchases) {
    for (final p in purchases) {
      if (p.productID != AdIds.passProduct) continue;
      switch (p.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          if (p.pendingCompletePurchase) unawaited(_iap.completePurchase(p));
          onPassOwned?.call(true);
          _pending?.complete(true);
          _pending = null;
        case PurchaseStatus.error:
        case PurchaseStatus.canceled:
          _pending?.complete(false);
          _pending = null;
        case PurchaseStatus.pending:
          // Slow payment methods sit here; the stream fires again when Play
          // hears back. Leave the completer parked.
          break;
      }
    }
  }

  /// Set by [Entitlements] so an out-of-band purchase (a restore Play does on
  /// its own, or a purchase finished while the sheet was closed) still lands.
  void Function(bool owned)? onPassOwned;

  @override
  Future<bool> buyPass() async {
    final product = _product;
    if (!_billingAvailable || product == null) return false;
    if (_pending != null) return _pending!.future;
    final completer = _pending = Completer<bool>();
    try {
      final started = await _iap.buyNonConsumable(
        purchaseParam: PurchaseParam(productDetails: product),
      );
      if (!started) {
        _pending = null;
        return false;
      }
    } catch (_) {
      _pending = null;
      return false;
    }
    // The stream resolves it. A cap so a dead sheet never hangs forever.
    return completer.future.timeout(
      const Duration(minutes: 3),
      onTimeout: () {
        _pending = null;
        return false;
      },
    );
  }

  @override
  Future<bool> restorePurchases() async {
    if (!_billingAvailable) return false;
    if (_pending != null) return _pending!.future;
    final completer = _pending = Completer<bool>();
    try {
      await _iap.restorePurchases();
    } catch (_) {
      _pending = null;
      return false;
    }
    // Play replies with one `restored` per owned product, or with nothing at
    // all when there isn't one — hence the short timeout for "nothing".
    return completer.future.timeout(
      const Duration(seconds: 8),
      onTimeout: () {
        _pending = null;
        return false;
      },
    );
  }

  void _loadRewarded() {
    if (_loadingRewarded || _rewarded != null) return;
    _loadingRewarded = true;
    RewardedAd.load(
      adUnitId: AdIds.rewarded,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewarded = ad;
          _loadingRewarded = false;
        },
        onAdFailedToLoad: (error) {
          _loadingRewarded = false;
          // Try again in a bit; no fill is normal for a brand-new app.
          Future<void>.delayed(const Duration(seconds: 45), _loadRewarded);
        },
      ),
    );
  }

  @override
  Future<bool> showRewardedAd() async {
    var ad = _rewarded;
    if (ad == null) {
      // Not preloaded (first launch, or the last one was just used). Give
      // it a few seconds rather than failing on the spot.
      _loadRewarded();
      for (var i = 0; i < 12 && _rewarded == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
      ad = _rewarded;
      if (ad == null) return false;
    }
    _rewarded = null;
    final done = Completer<bool>();
    var earned = false;
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        if (!done.isCompleted) done.complete(earned);
        _loadRewarded();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        if (!done.isCompleted) done.complete(false);
        _loadRewarded();
      },
    );
    await ad.show(onUserEarnedReward: (_, _) => earned = true);
    return done.future;
  }

  void dispose() {
    _purchases?.cancel();
    _rewarded?.dispose();
  }
}

/// Stand-in for development: **grants everything for free**, plays no ad.
class DebugStore implements Store {
  const DebugStore();

  @override
  bool get bannersEnabled => false;

  @override
  String get passPrice => '₹99';

  @override
  Future<void> init() async {}

  @override
  Future<bool> showRewardedAd() async {
    // Stands in for the ~15s a real rewarded video takes, so the surrounding
    // UI (spinner, disabled buttons, the reward landing) is exercised.
    await Future<void>.delayed(const Duration(seconds: 2));
    return true;
  }

  @override
  Future<bool> buyPass() async {
    await Future<void>.delayed(const Duration(seconds: 1));
    return true;
  }

  @override
  Future<bool> restorePurchases() async => false;
}

/// Opt in with `--dart-define=DEV_UNLOCKS=true` to build a testable APK where
/// the buttons grant what they promise without an ad or a payment.
///
/// It has to be explicit, because `assert` is stripped from release builds —
/// an assertion guarding this would have silently done nothing in the exact
/// build that matters, and free purchases would have shipped.
const _devUnlocks = bool.fromEnvironment('DEV_UNLOCKS');

/// Every build talks to the real SDKs unless it opts out. With no ids in
/// `.env` that means Google's test ad units and a product Play won't know,
/// which is the right default: ads visibly work, nothing can be charged.
final Store store = _devUnlocks ? const DebugStore() : PlayStore();

/// True when unlocks are being granted without a real ad or payment, so the
/// UI can say so rather than looking like a working shop.
const bool unlocksAreFake = _devUnlocks;
