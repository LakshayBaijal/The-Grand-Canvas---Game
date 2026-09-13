import 'package:flutter/material.dart';

import '../models/styles.dart';
import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'customize_sheet.dart';
import 'sketch_icons.dart';

/// The one place the game asks for money or attention.
///
/// It only ever opens because the player tapped something — the pass button,
/// a locked colour, a locked paper. Nothing here interrupts a round, and
/// there is no timer or trigger that opens it on its own.
///
/// Two offers, in this order:
///
///  * **The pass** — every colour, every paper, every pen, and no ads,
///    once, forever. Shown with the real swatches and the real paper and pen
///    painters, because the old sheet only listed "styles" in a sentence and
///    nobody knew what they were buying.
///  * **Today only** — a short video for every colour for 24 hours. Papers
///    and pens are never given away for a video, so the pass stays worth
///    more than the free route.
Future<void> showUnlockSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _UnlockSheet(),
  );
}

class _UnlockSheet extends StatefulWidget {
  const _UnlockSheet();

  @override
  State<_UnlockSheet> createState() => _UnlockSheetState();
}

class _UnlockSheetState extends State<_UnlockSheet> {
  bool _busy = false;
  String? _error;

  /// The paid colours, in the order the toolbar shows them.
  static const _colours = [
    Color(0xFFE53935),
    Color(0xFFFB8C00),
    Color(0xFF43A047),
    Color(0xFF1E88E5),
    Color(0xFF8E24AA),
    Color(0xFF6D4C41),
    Colors.white,
  ];

  Future<void> _run(
    Future<bool> Function() action,
    Future<void> Function() grant,
    String failure,
  ) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final ok = await action();
    if (!mounted) return;
    if (ok) {
      await grant();
      if (mounted) Navigator.of(context).pop();
      return;
    }
    setState(() {
      _busy = false;
      _error = failure;
    });
  }

  @override
  Widget build(BuildContext context) {
    final entitlements = Entitlements.instance;
    final dayLeft = entitlements.dayPassLeft;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF221B52), GameColors.surface],
          ),
          border: Border.all(
            color: GameColors.primary.withValues(alpha: 0.5),
            width: 1.6,
          ),
          boxShadow: GameDecor.glow(GameColors.primary, strength: 0.8),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: GameColors.surfaceHigh,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const SketchIcon(
                    SketchGlyph.sparkle,
                    size: 18,
                    color: GameColors.primary,
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'THE PASS',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        color: GameColors.primary,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: GameColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${store.passPrice} · ONCE',
                      style: const TextStyle(
                        color: Color(0xFF241800),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Pay once. Yours forever, in every mode.',
                style: TextStyle(color: GameColors.textMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 14),

              // What's in it — shown, not described.
              _Perk(
                label: 'EVERY COLOUR',
                note:
                    'Black and yellow are always free. These seven join them.',
                child: Row(
                  children: [
                    for (final c in _colours)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24),
                        ),
                      ),
                  ],
                ),
              ),
              _Perk(
                label: 'EVERY PAPER',
                note:
                    'Graph, ruled, dotted, kraft, sticky note. Everyone sees it '
                    'when your drawing comes up.',
                child: Row(
                  children: [
                    for (final p in PaperStyle.values)
                      if (p != PaperStyle.free)
                        _Swatch(
                          label: p.label,
                          child: CustomPaint(painter: PaperPreviewPainter(p)),
                        ),
                  ],
                ),
              ),
              _Perk(
                label: 'EVERY PEN',
                note:
                    'Marker, crayon, pencil, brush. Same colours, different hand.',
                child: Row(
                  children: [
                    for (final p in PenStyle.values)
                      if (p != PenStyle.free)
                        _Swatch(
                          label: p.label,
                          child: CustomPaint(
                            painter: PenPreviewPainter(p, PaperStyle.plain),
                          ),
                        ),
                  ],
                ),
              ),
              const _Perk(
                label: 'NO ADS',
                note: 'The banner goes away for good.',
                child: SizedBox.shrink(),
              ),
              const SizedBox(height: 6),
              FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () => _run(
                        store.buyPass,
                        entitlements.grantLifetime,
                        unlocksAreFake
                            ? "That didn't go through — nothing was charged."
                            : "Couldn't reach the Play Store. Check you're signed "
                                  'in to Google Play and try again.',
                      ),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
                icon: const SketchIcon(
                  SketchGlyph.lockOpen,
                  size: 18,
                  color: Color(0xFF241800),
                ),
                label: Text('GET THE PASS — ${store.passPrice}'),
              ),

              const SizedBox(height: 22),
              Row(
                children: [
                  const Expanded(child: Divider(color: GameColors.border)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'OR, JUST FOR TODAY',
                      style: TextStyle(
                        color: GameColors.textMuted.withValues(alpha: 0.9),
                        fontSize: 10,
                        letterSpacing: 2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Expanded(child: Divider(color: GameColors.border)),
                ],
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy
                    ? null
                    : () => _run(
                        store.showRewardedAd,
                        entitlements.grantDayPass,
                        'No video was available just now — try again in a bit.',
                      ),
                icon: const Icon(Icons.play_circle_outline_rounded, size: 20),
                label: const Text('WATCH A SHORT VIDEO — COLOURS FOR 24 HOURS'),
              ),
              const SizedBox(height: 6),
              Text(
                dayLeft != null
                    ? 'You have colours for another ${_hm(dayLeft)}. Watching '
                          'again adds 24 hours on top.'
                    : 'A video unlocks the colours only. Papers, pens and no '
                          'ads are pass-only.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 11.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: _busy
                    ? null
                    : () => _run(
                        store.restorePurchases,
                        entitlements.grantLifetime,
                        'No previous purchase found on this Google account.',
                      ),
                child: const Text(
                  'Already bought it? Restore purchase',
                  style: TextStyle(fontSize: 12.5),
                ),
              ),
              if (_busy) ...[
                const SizedBox(height: 6),
                const Center(child: CircularProgressIndicator()),
              ],
              if (unlocksAreFake) ...[
                const SizedBox(height: 10),
                Text(
                  'TEST BUILD — nothing is charged and no ad plays.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: GameColors.lime.withValues(alpha: 0.85),
                    fontSize: 11,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ] else if (AdIds.usingTestAds) ...[
                const SizedBox(height: 10),
                Text(
                  'TEST ADS — Google sample ads; they earn nothing yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: GameColors.lime.withValues(alpha: 0.85),
                    fontSize: 11,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFF6B6B),
                    fontSize: 12.5,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _hm(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes % 60;
    if (h == 0) return '$m min';
    return m == 0 ? '$h h' : '$h h $m min';
  }
}

/// One line of the pass: a label, the thing itself, and one sentence.
class _Perk extends StatelessWidget {
  const _Perk({required this.label, required this.note, required this.child});

  final String label;
  final String note;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3, right: 10),
            child: Icon(Icons.check_rounded, size: 16, color: GameColors.lime),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                    color: GameColors.textPrimary,
                  ),
                ),
                if (child is! SizedBox) ...[const SizedBox(height: 6), child],
                const SizedBox(height: 4),
                Text(
                  note,
                  style: const TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 11.5,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A small live preview with its name under it, drawn by the real painter
/// so it can't drift from what the pass actually gives.
class _Swatch extends StatelessWidget {
  const _Swatch({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(7),
            child: SizedBox(width: 40, height: 40, child: child),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(
              color: GameColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
