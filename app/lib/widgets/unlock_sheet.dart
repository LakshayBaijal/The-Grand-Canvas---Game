import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../models/styles.dart';
import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'grand_pass_mark.dart';
import 'customize_sheet.dart';

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
/// The paid colours, in the order the toolbar shows them. Public because
/// every screen that offers them has to show the same seven — a second copy
/// of this list is how one of them ends up a colour short.
const paidColours = [
  Color(0xFFE53935),
  Color(0xFFFB8C00),
  Color(0xFF43A047),
  Color(0xFF1E88E5),
  Color(0xFF8E24AA),
  Color(0xFF6D4C41),
  Colors.white,
];

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
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF2A2140),
                      boxShadow: GameDecor.glow(const Color(0xFFFFC53D), strength: 0.9),
                    ),
                    child: const GrandPassMark(size: 34),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'GRAND PASS',
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
                    'All nine, in every game.',
                child: Row(
                  children: [
                    for (final c in paidColours)
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
                    'Seven sheets. Everyone sees yours.',
                child: _SwatchRow(
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
                    'Eight pens, from pencil to neon.',
                child: _SwatchRow(
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
                label: 'YOUR OWN PALETTE',
                note: 'Hold a swatch, pick any colour. It stays yours.',
                child: SizedBox(height: 30, child: _OwnColourPicture()),
              ),
              const _Perk(
                label: 'STEADY HAND',
                note: 'Draw a shape, hold still, and it snaps clean.',
                child: SizedBox(height: 64, child: _SteadyHandPicture()),
              ),
              const _Perk(
                label: 'NO ADS',
                note: 'Gone for good.',
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
                icon: const GrandPassMark(size: 20),
                label: Text('GET THE GRAND PASS — ${store.passPrice}'),
              ),

              const SizedBox(height: 22),
              // The video is the free route to colours for a day. Once
              // someone has taken it, it goes away for the rest of the day:
              // the only thing left to offer is the pass, and the sheet
              // shouldn't keep asking for the thing they already have.
              if (dayLeft == null) ...[
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
                  label: const Text(
                    'WATCH A VIDEO — COLOURS + STEADY UNTIL MIDNIGHT',
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Just the colours and Steady Hand, until midnight.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 11.5,
                    height: 1.4,
                  ),
                ),
              ] else
                Text(
                  'Colours and Steady Hand are yours for another ${_hm(dayLeft)}.',
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


/// Before and after, as a picture: the same circle drawn by a shaky finger,
/// then with Steady Hand. Painted rather than shipped as an image so it is
/// crisp at any size and in the game's own colours.
class _SteadyHandPicture extends StatelessWidget {
  const _SteadyHandPicture();

  @override
  Widget build(BuildContext context) {
    return const CustomPaint(painter: _SteadyHandPainter(), size: Size.infinite);
  }
}

class _SteadyHandPainter extends CustomPainter {
  const _SteadyHandPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final r = h * 0.36;
    final y = h / 2;
    final leftC = Offset(r + 6, y);
    final rightC = Offset(size.width - r - 6, y);
    final ink = Paint()
      ..color = GameColors.textPrimary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // The shaky one: a circle with a hand's tremor baked in.
    final shaky = Path();
    for (var i = 0; i <= 60; i++) {
      final a = i / 60 * 2 * math.pi;
      final wob = 1 + 0.11 * math.sin(a * 7) + 0.07 * math.cos(a * 3 + 1);
      final p = Offset(leftC.dx + math.cos(a) * r * wob, leftC.dy + math.sin(a) * r * wob);
      if (i == 0) {
        shaky.moveTo(p.dx, p.dy);
      } else {
        shaky.lineTo(p.dx, p.dy);
      }
    }
    canvas.drawPath(shaky, ink);

    // Arrow between, with the wand.
    final mid = Offset(size.width / 2, y);
    final arrow = Paint()
      ..color = GameColors.pink
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(mid + const Offset(-22, 0), mid + const Offset(18, 0), arrow);
    canvas.drawLine(mid + const Offset(18, 0), mid + const Offset(10, -7), arrow);
    canvas.drawLine(mid + const Offset(18, 0), mid + const Offset(10, 7), arrow);
    final sparkle = Paint()..color = GameColors.pink;
    for (final d in const [Offset(-4, -16), Offset(8, -19), Offset(2, -11)]) {
      canvas.drawCircle(mid + d, 1.8, sparkle);
    }

    // The steady one.
    canvas.drawCircle(rightC, r, ink..color = GameColors.primary);
  }

  @override
  bool shouldRepaint(_SteadyHandPainter old) => false;
}


/// A row of swatches that scrolls sideways once there are more than fit.
/// Seven papers and eight pens do not fit a phone; a clipped row said
/// "five pens" and a wrapped one made the sheet twice as tall.
class _SwatchRow extends StatelessWidget {
  const _SwatchRow({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(children: children),
    );
  }
}


/// Nine swatches, three of them made someone's own (gold ring), as the
/// picture for the palette perk.
class _OwnColourPicture extends StatelessWidget {
  const _OwnColourPicture();

  @override
  Widget build(BuildContext context) {
    const nine = [
      Colors.black, Color(0xFFFDD835), Color(0xFFFF7043), Color(0xFFFB8C00), Color(0xFF00BFA5),
      Color(0xFF1E88E5), Color(0xFFB39DDB), Color(0xFF6D4C41), Colors.white,
    ];
    const mine = {2, 4, 6};
    return Row(
      children: [
        for (var i = 0; i < nine.length; i++)
          Container(
            width: 24,
            height: 24,
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(
              color: nine[i],
              shape: BoxShape.circle,
              border: Border.all(
                color: mine.contains(i) ? const Color(0xFFFFC53D) : GameColors.surfaceHigh,
                width: mine.contains(i) ? 2.5 : 1.5,
              ),
            ),
          ),
      ],
    );
  }
}
