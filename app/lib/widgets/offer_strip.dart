import 'package:flutter/material.dart';

import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'unlock_sheet.dart';

/// The after-game offer: a short video for the day's colours and Steady
/// Hand, with the Grand Pass as the second line.
///
/// Shown on the results screen, because that is when people are actually
/// paying attention -- they just won, lost, or laughed -- rather than mid-
/// drawing with the clock running, which is where the locked colours used
/// to be the only way in. Every second game, and never while a pass is
/// running; see [Entitlements.noteGameFinished].
class OfferStrip extends StatefulWidget {
  const OfferStrip({super.key});

  @override
  State<OfferStrip> createState() => _OfferStripState();
}

class _OfferStripState extends State<OfferStrip> {
  bool _busy = false;
  String? _note;

  Future<void> _watch() async {
    setState(() {
      _busy = true;
      _note = null;
    });
    final ok = await store.showRewardedAd();
    if (!mounted) return;
    if (ok) {
      await Entitlements.instance.grantDayPass();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _note = 'Every colour and Steady Hand are yours until midnight.';
      });
      return;
    }
    setState(() {
      _busy = false;
      _note = 'No video was available just now — try again in a bit.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Entitlements.instance,
      builder: (context, _) {
        final e = Entitlements.instance;
        if (e.hasLifetime) return const SizedBox.shrink();
        final active = e.hasFullPalette;
        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: GameDecor.panel(accent: GameColors.pink, radius: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (active || _note != null)
                Text(
                  _note ?? 'Every colour and Steady Hand are yours until midnight.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                )
              else
                FilledButton.icon(
                  onPressed: _busy ? null : _watch,
                  style: FilledButton.styleFrom(
                    backgroundColor: GameColors.pink,
                    foregroundColor: const Color(0xFF2A0A1A),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.play_circle_outline_rounded, size: 20),
                  label: const Text(
                    'WATCH A SHORT VIDEO → EVERY COLOUR + STEADY HAND UNTIL MIDNIGHT',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, letterSpacing: 0.4),
                  ),
                ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () => showUnlockSheet(context),
                child: Text(
                  'Or the Grand Pass — ${store.passPrice}, once, forever',
                  style: const TextStyle(color: GameColors.textMuted, fontSize: 12.5),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
