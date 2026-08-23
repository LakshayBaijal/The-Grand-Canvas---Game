import 'package:flutter/material.dart';

import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'sketch_icons.dart';

/// The one place the game asks for money or attention.
///
/// It only ever opens because the player tapped something — a locked colour or
/// the unlock chip. Nothing here interrupts a round, and there is no timer or
/// trigger that opens it on its own.
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

  /// Swatches shown as a preview of what's behind the lock.
  static const _preview = [
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

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 26),
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
            const SizedBox(height: 18),
            const Text(
              'UNLOCK THE FULL PALETTE',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.6,
                color: GameColors.primary,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final c in _preview)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: c,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white24),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Black, yellow and the eraser are always free — this is purely '
              'about colour, so nobody can buy a better score.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: GameColors.textMuted,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _busy
                  ? null
                  : () => _run(
                      store.showRewardedAd,
                      entitlements.grantDayPass,
                      unlocksAreFake
                          ? 'No ad was available just now — try again in a bit.'
                          : 'Ads are not switched on in this build yet.',
                    ),
              icon: const Icon(Icons.play_circle_outline_rounded, size: 20),
              label: const Text('WATCH A SHORT VIDEO — 24 HOURS'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : () => _run(
                      store.buyLifetimePalette,
                      entitlements.grantLifetime,
                      unlocksAreFake
                          ? "That didn't go through — nothing was charged."
                          : 'Purchases are not switched on in this build yet.',
                    ),
              icon: const SketchIcon(SketchGlyph.lockOpen, size: 18, color: GameColors.textPrimary),
              label: Text('UNLOCK FOREVER — ${store.lifetimePrice}'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => _run(
                      store.restorePurchases,
                      entitlements.grantLifetime,
                      'No previous purchase found on this account.',
                    ),
              child: const Text(
                'Restore a previous purchase',
                style: TextStyle(fontSize: 12.5),
              ),
            ),
            if (_busy) ...[
              const SizedBox(height: 10),
              const Center(child: CircularProgressIndicator()),
            ],
            if (unlocksAreFake) ...[
              const SizedBox(height: 12),
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
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
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
    );
  }
}
