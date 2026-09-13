import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';

/// The one banner in the game: a thin strip pinned to the bottom of the
/// menu-type screens (home, queue, lobby, boards, the Daily's front page).
///
/// Never on the canvas, the voting or the reveal — nothing sits on top of a
/// round. And never for a pass owner: no ads is part of what the pass buys,
/// so the strip takes zero height the moment the pass is owned.
///
/// The standard 320×50 banner. Until the ad has actually loaded the strip
/// stays at zero height rather than showing an empty box, so a screen with
/// no fill looks exactly as it did before.
class AdBanner extends StatefulWidget {
  const AdBanner({super.key});

  @override
  State<AdBanner> createState() => _AdBannerState();
}

class _AdBannerState extends State<AdBanner> {
  BannerAd? _ad;
  bool _loaded = false;
  bool _requested = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_requested) _load();
  }

  Future<void> _load() async {
    if (!store.bannersEnabled || Entitlements.instance.hasLifetime) return;
    _requested = true;
    // The standard 320×50 banner, on purpose: the smallest unit AdMob
    // serves and the one with the best fill. Adaptive banners can grow to
    // 90dp on tall phones, and the brief was "small".
    const size = AdSize.banner;
    final ad = BannerAd(
      size: size,
      adUnitId: AdIds.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (mounted) setState(() => _loaded = true);
        },
        onAdFailedToLoad: (ad, _) {
          ad.dispose();
          if (mounted) {
            setState(() {
              _ad = null;
              _loaded = false;
            });
          }
        },
      ),
    );
    _ad = ad;
    await ad.load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Entitlements.instance,
      builder: (context, _) {
        final ad = _ad;
        if (Entitlements.instance.hasLifetime || ad == null || !_loaded) {
          return const SizedBox.shrink();
        }
        return SafeArea(
          top: false,
          child: Container(
            width: double.infinity,
            height: ad.size.height.toDouble(),
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: GameColors.background,
              border: Border(top: BorderSide(color: GameColors.border)),
            ),
            child: SizedBox(
              width: ad.size.width.toDouble(),
              height: ad.size.height.toDouble(),
              child: AdWidget(ad: ad),
            ),
          ),
        );
      },
    );
  }
}
