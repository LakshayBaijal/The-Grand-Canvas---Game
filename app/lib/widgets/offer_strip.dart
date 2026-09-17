import 'package:flutter/material.dart';

import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'grand_pass_mark.dart';
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
        final line = _note ?? (active ? 'Colours and Steady Hand are yours until midnight.' : null);
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          decoration: GameDecor.panel(accent: GameColors.pink, radius: 14),
          child: Row(
            children: [
              if (line != null)
                Expanded(
                  child: Text(
                    line,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                )
              else ...[
                const Icon(Icons.play_circle_outline_rounded, size: 20, color: GameColors.pink),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: _busy ? null : _watch,
                    behavior: HitTestBehavior.opaque,
                    child: Text(
                      _busy ? 'Loading the video…' : 'Watch a video → every colour + Steady Hand until midnight',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, height: 1.25),
                    ),
                  ),
                ),
              ],
              const SizedBox(width: 6),
              InkWell(
                onTap: () => showUnlockSheet(context),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const GrandPassMark(size: 15),
                      const SizedBox(width: 4),
                      Text(
                        store.passPrice,
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: GameColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
