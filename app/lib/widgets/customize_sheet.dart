import 'dart:math';

import 'package:flutter/material.dart';

import '../models/styles.dart';
import '../services/entitlements.dart';
import '../theme.dart';
import 'drawing_canvas.dart';
import 'unlock_sheet.dart';

/// Pick your paper and your pen.
///
/// Both are part of the paid pack, never the ad — the purchase has to be worth
/// more than the free route or it isn't a product. Locked styles are still
/// shown and still previewed, because you can't want something you can't see;
/// tapping one explains itself instead of doing nothing.
Future<void> showCustomizeSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _CustomizeSheet(),
  );
}

class _CustomizeSheet extends StatelessWidget {
  const _CustomizeSheet();

  @override
  Widget build(BuildContext context) {
    final entitlements = Entitlements.instance;

    return ListenableBuilder(
      listenable: entitlements,
      builder: (context, _) {
        final owned = entitlements.hasStyles;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF221B52), GameColors.surface],
            ),
            border: Border.all(color: GameColors.cyan.withValues(alpha: 0.45), width: 1.6),
            boxShadow: GameDecor.glow(GameColors.cyan, strength: 0.6),
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
              const SizedBox(height: 16),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'PAPER & PENS',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.6,
                        color: GameColors.cyan,
                      ),
                    ),
                  ),
                  if (owned)
                    const Text(
                      'UNLOCKED',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: GameColors.lime,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                owned
                    ? 'Everyone sees your paper and pen when your drawing comes up.'
                    : 'Part of the one-off unlock. Everyone sees your paper and pen '
                        'when your drawing comes up.',
                style: const TextStyle(color: GameColors.textMuted, fontSize: 12, height: 1.35),
              ),
              const SizedBox(height: 18),
              _Section(
                label: 'PAPER',
                child: SizedBox(
                  height: 92,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: PaperStyle.values.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, i) {
                      final style = PaperStyle.values[i];
                      final locked = !owned && style != PaperStyle.free;
                      return _StyleTile(
                        label: style.label,
                        locked: locked,
                        selected: entitlements.paper == style,
                        onTap: locked
                            ? () => showUnlockSheet(context)
                            : () => entitlements.choosePaper(style),
                        preview: CustomPaint(painter: _PaperPreview(style)),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                label: 'PEN',
                child: SizedBox(
                  height: 92,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: PenStyle.values.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, i) {
                      final style = PenStyle.values[i];
                      final locked = !owned && style != PenStyle.free;
                      return _StyleTile(
                        label: style.label,
                        locked: locked,
                        selected: entitlements.pen == style,
                        onTap: locked
                            ? () => showUnlockSheet(context)
                            : () => entitlements.choosePen(style),
                        preview: CustomPaint(
                          painter: _PenPreview(style, entitlements.paper),
                        ),
                      );
                    },
                  ),
                ),
              ),
              if (!owned) ...[
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    showUnlockSheet(context);
                  },
                  icon: const Icon(Icons.lock_open_rounded, size: 18),
                  label: const Text('UNLOCK EVERYTHING'),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: GameColors.textMuted,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

class _StyleTile extends StatelessWidget {
  const _StyleTile({
    required this.label,
    required this.locked,
    required this.selected,
    required this.onTap,
    required this.preview,
  });

  final String label;
  final bool locked;
  final bool selected;
  final VoidCallback onTap;
  final Widget preview;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: selected ? GameColors.primary : GameColors.border,
                  width: selected ? 2.5 : 1.2,
                ),
                boxShadow: selected ? GameDecor.glow(GameColors.primary, strength: 0.5) : null,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    preview,
                    // Locked styles are shown, not hidden — you can't want
                    // something you've never seen.
                    if (locked)
                      Container(
                        color: Colors.black.withValues(alpha: 0.45),
                        child: const Icon(Icons.lock_rounded, size: 18, color: Colors.white),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: selected ? GameColors.primary : GameColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Previews use the real painters, so a swatch can't drift from what you
/// actually get.
class _PaperPreview extends CustomPainter {
  const _PaperPreview(this.style);

  final PaperStyle style;

  @override
  void paint(Canvas canvas, Size size) => paintPaperBackground(canvas, size, style);

  @override
  bool shouldRepaint(covariant _PaperPreview old) => old.style != style;
}

class _PenPreview extends CustomPainter {
  const _PenPreview(this.style, this.paper);

  final PenStyle style;
  final PaperStyle paper;

  @override
  void paint(Canvas canvas, Size size) {
    paintPaperBackground(canvas, size, paper);
    // One smooth sweep, identical for every pen, so what you're comparing is
    // the pen and nothing else. A tight zigzag read as a black blob at this
    // size and hid the very differences it was meant to show.
    final points = [
      for (var i = 0; i <= 40; i++)
        () {
          final t = i / 40;
          return Offset(
            size.width * (0.14 + 0.72 * t),
            size.height * (0.5 - 0.26 * sin(t * pi)),
          );
        }(),
    ];
    paintStrokePath(canvas, points, Colors.black, size.width * 0.14, style);
  }

  @override
  bool shouldRepaint(covariant _PenPreview old) => old.style != style || old.paper != paper;
}
