import 'package:flutter/material.dart';
import 'package:in_app_review/in_app_review.dart';

import '../models/styles.dart';
import '../theme.dart';
import 'customize_sheet.dart';
import 'sketch_icons.dart';
import 'unlock_sheet.dart';

/// Shown once, after a player has stuck around for a few ranked games.
///
/// Two things happen here, and it matters a great deal that they are two
/// things and not one:
///
///  1. **A thank-you.** Everything the pass contains — every colour, every
///     paper, every pen — for 24 hours, given for having played. A milestone
///     reward, the same as any game handing out something on level 5.
///  2. **Then, separately, the store's review sheet**, opened after this one
///     closes, with no reward attached to it and nothing on this screen
///     mentioning it.
///
/// They are not a trade, and the copy must never imply they are. Google Play
/// bans offering "incentives in exchange for ratings or reviews" outright —
/// it is an app-removal offence, not a warning — and Play's review API is
/// built to make the trade impossible anyway: it reports neither whether the
/// player rated nor what score they gave, by design, so there is no signal a
/// reward could be gated on even if the policy allowed it.
///
/// What is left is the honest version of the same idea, and the one that
/// actually works: give something to a player who stayed, and ask a player
/// in a good mood. Nothing is conditional, so nobody can feel cheated, and
/// the 5% who would have rated badly are not being paid to show up.
Future<void> showThanksSheet(BuildContext context) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _ThanksSheet(),
  );

  // Asked after the sheet is gone, so the two are never on screen together
  // and the reward is already banked whatever happens next. Play decides
  // whether the dialog actually appears — it has its own quota — and tells
  // us nothing either way, which is fine: this is the last we hear of it.
  await requestReview();
}

/// Opens the store's own review dialog, if the platform has one and is
/// willing to show it right now. Silent on every failure: a review prompt is
/// the least important thing the app does, and a player who has just been
/// given something must never see an error because of it.
Future<void> requestReview() async {
  try {
    final review = InAppReview.instance;
    if (await review.isAvailable()) await review.requestReview();
  } catch (_) {
    // Nothing to recover, nothing worth telling anyone.
  }
}

class _ThanksSheet extends StatelessWidget {
  const _ThanksSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        decoration: BoxDecoration(
          color: GameColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: GameColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Center(
              child: SketchIcon(
                SketchGlyph.star,
                size: 34,
                color: GameColors.primary,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'THANKS FOR PLAYING',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.4,
                color: GameColors.primary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'A few games in, so the whole art shop is yours for the next '
              '24 hours — every colour, every paper, every pen. Nothing to '
              'watch, nothing to pay.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: GameColors.textMuted,
              ),
            ),
            const SizedBox(height: 18),
            const _WhatYouGot(),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              style: FilledButton.styleFrom(
                backgroundColor: GameColors.primary,
                foregroundColor: GameColors.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'START DRAWING',
                style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The colours as swatches and the papers and pens drawn by their real
/// painters — the same argument the pass sheet makes, for the same reason:
/// nobody wants what they can't see.
class _WhatYouGot extends StatelessWidget {
  const _WhatYouGot();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final color in paidColours)
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  border: Border.all(color: GameColors.border, width: 2),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            children: [
              for (final paper in PaperStyle.values)
                _Swatch(child: CustomPaint(painter: PaperPreviewPainter(paper))),
              for (final pen in PenStyle.pens)
                _Swatch(
                  child: CustomPaint(
                    painter: PenPreviewPainter(pen, PaperStyle.plain),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(width: 56, height: 44, child: child),
      ),
    );
  }
}
