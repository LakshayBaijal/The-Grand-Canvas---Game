import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/round_models.dart';
import '../services/audio_service.dart';
import '../theme.dart';
import 'drawing_canvas.dart';
import 'sketch_icons.dart';

/// One drawing's moment: the picture back on screen at full size, with the
/// money it raised thrown onto it a backer at a time.
///
/// The old reveal printed a row of name chips and a final number, which is
/// accurate and completely flat. The interesting part of a round is *watching*
/// the money arrive — a note landing with somebody's name on it says who
/// backed you and how hard, in the same beat. This is the screen that pays off
/// having drawn the thing.
///
/// Timing is driven from outside via [duration] so it can be kept in step with
/// SHOWCASE_SECONDS_PER_ENTRY on the server; if the phase moved on halfway
/// through an entry the last drawing would never get its turn.
class MoneyShowcase extends StatefulWidget {
  const MoneyShowcase({
    super.key,
    required this.entry,
    required this.isMoney,
    required this.fundingGoal,
    required this.duration,
    required this.isMine,
    this.rank,
    this.totalEntries,
  });

  final RoundResult entry;

  /// Money games count dollars; friendly games count vote points and have no
  /// funding threshold to clear.
  final bool isMoney;
  final int? fundingGoal;
  final Duration duration;

  /// Only the player's own drawing makes noise — five of these in a row all
  /// pinging would be a racket.
  final bool isMine;

  final int? rank;
  final int? totalEntries;

  @override
  State<MoneyShowcase> createState() => _MoneyShowcaseState();
}

class _MoneyShowcaseState extends State<MoneyShowcase> with TickerProviderStateMixin {
  /// How long the card takes to arrive before any money is thrown at it.
  static const _entrance = Duration(milliseconds: 420);

  /// Fraction of the entry's time that the stamp and the final total get to
  /// sit still at the end. Without a beat here the screen cuts away at the
  /// exact moment the result becomes readable.
  static const _tailFraction = 0.28;

  int _landed = 0;
  bool _stamped = false;
  final _timers = <Timer>[];

  late final AnimationController _stampController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
  );

  /// Where each note comes to rest on the canvas, and how it sits.
  ///
  /// Fixed per entry rather than re-rolled on rebuild: a note that jumps to a
  /// new spot when the total ticks over would look like a glitch. Seeded off
  /// the artist so the same drawing always scatters the same way.
  late final List<_NoteSpot> _spots = _layOutNotes();

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  List<_NoteSpot> _layOutNotes() {
    final rnd = math.Random(widget.entry.artistId.hashCode);
    final n = widget.entry.backers.length;
    if (n == 0) return [];
    // Notes sit on a ring around the centre rather than a grid. A grid put a
    // note directly in the middle whenever there were one or two backers,
    // which the funded/not-funded stamp then landed on top of and hid
    // completely -- exactly the thing this screen exists to show.
    final startAngle = rnd.nextDouble() * 2 * math.pi;
    return List.generate(n, (i) {
      final angle = startAngle +
          (2 * math.pi * i / n) +
          (rnd.nextDouble() - 0.5) * 0.4;
      final radius = 0.30 + rnd.nextDouble() * 0.12;
      // Stretched more horizontally than vertically to suit a portrait card.
      return _NoteSpot(
        dx: (0.5 + math.cos(angle) * radius * 1.35).clamp(0.14, 0.86),
        dy: (0.5 + math.sin(angle) * radius).clamp(0.18, 0.82),
        angle: (rnd.nextDouble() - 0.5) * 0.5,
        fromLeft: math.cos(angle) < 0,
      );
    });
  }

  void _schedule() {
    final backers = widget.entry.backers.length;
    final total = widget.duration;
    final tail = total * _tailFraction;
    // Everything between the entrance and the tail belongs to the money.
    final window = total - _entrance - tail;
    final gap = backers == 0
        ? Duration.zero
        : Duration(
            microseconds: (window.inMicroseconds / backers).clamp(
              180000, // never so fast the notes blur together
              620000, // never so slow the screen feels stalled
            ).round(),
          );

    for (var i = 0; i < backers; i++) {
      _timers.add(Timer(_entrance + gap * i, () {
        if (!mounted) return;
        setState(() => _landed++);
        if (widget.isMine) AudioService.instance.sfx(Sfx.correct);
      }));
    }

    // The verdict lands just after the last note, whether or not anyone backed
    // it — a drawing nobody funded still deserves to be told so.
    final stampAt = _entrance + gap * backers + const Duration(milliseconds: 180);
    _timers.add(Timer(stampAt, () {
      if (!mounted) return;
      setState(() => _stamped = true);
      _stampController.forward();
      if (widget.isMine) {
        AudioService.instance.sfx(_funded ? Sfx.win : Sfx.lose);
      }
    }));
  }

  bool get _funded {
    final goal = widget.fundingGoal;
    if (!widget.isMoney || goal == null) return true;
    return widget.entry.total >= goal;
  }

  /// What has arrived so far. Snaps to the server's figure once everything has
  /// landed, so the number on screen can never disagree with the scoreboard.
  int get _running {
    if (_landed >= widget.entry.backers.length) return widget.entry.total;
    var sum = 0;
    for (var i = 0; i < _landed; i++) {
      sum += widget.entry.backers[i].amount;
    }
    return sum;
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _stampController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final goal = widget.fundingGoal;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The title, on a hard black bar. It is the one piece of text the
        // player wrote themselves, so it gets to look like a label on an
        // exhibit rather than a caption.
        _TitlePlate(title: entry.title, rank: widget.rank, of: widget.totalEntries),
        const SizedBox(height: 4),
        Text(
          'by ${entry.artistName}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: GameColors.textMuted, fontSize: 12.5),
        ),
        const SizedBox(height: 10),

        // The drawing, with the money landing on top of it.
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: GameColors.border,
                            width: 1.4,
                          ),
                        ),
                        child: StaticDrawing(
                          strokes: entry.strokes,
                          paper: entry.paper,
                        ),
                      ),
                    ),
                  ),
                  for (var i = 0; i < entry.backers.length; i++)
                    _FlyingNote(
                      key: ValueKey('note-$i'),
                      backer: entry.backers[i],
                      spot: _spots[i],
                      isMoney: widget.isMoney,
                      area: constraints.biggest,
                      landed: i < _landed,
                    ),
                  if (_stamped)
                    Center(
                      child: _FundedStamp(
                        controller: _stampController,
                        funded: _funded,
                        // Friendly games have no funding threshold, so the
                        // stamp just marks that the votes are in.
                        label: !widget.isMoney
                            ? 'VOTES IN'
                            : _funded
                                ? 'FUNDED!'
                                : 'NOT FUNDED',
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 12),

        // The running total, big enough to read from across a room.
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: _running.toDouble()),
          duration: const Duration(milliseconds: 380),
          curve: Curves.easeOutCubic,
          builder: (context, v, _) => Text(
            widget.isMoney
                ? '\$${v.round()}'
                : '${v.round()}${v.round() == 1 ? ' point' : ' points'}',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 42,
              height: 1,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
              color: _stamped && !_funded ? GameColors.textMuted : GameColors.lime,
            ),
          ),
        ),
        if (widget.isMoney && goal != null) ...[
          const SizedBox(height: 6),
          Text(
            _stamped && !_funded
                ? '\$${goal - entry.total} short of funding'
                : '\$$goal needed to fund!',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: GameColors.textMuted,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }
}

/// Where one note ends up, as fractions of the canvas.
class _NoteSpot {
  const _NoteSpot({
    required this.dx,
    required this.dy,
    required this.angle,
    required this.fromLeft,
  });

  final double dx;
  final double dy;
  final double angle;

  /// Which side it flies in from, so they don't all arrive on the same arc.
  final bool fromLeft;
}

/// A single backer's note, thrown onto the drawing.
class _FlyingNote extends StatelessWidget {
  const _FlyingNote({
    super.key,
    required this.backer,
    required this.spot,
    required this.isMoney,
    required this.area,
    required this.landed,
  });

  final Backer backer;
  final _NoteSpot spot;
  final bool isMoney;
  final Size area;
  final bool landed;

  @override
  Widget build(BuildContext context) {
    const noteW = 78.0;
    const noteH = 44.0;
    final restLeft = area.width * spot.dx - noteW / 2;
    final restTop = area.height * spot.dy - noteH / 2;
    // Comes in from off the side it was assigned, low, as if tossed.
    final startLeft = spot.fromLeft ? -noteW - 30 : area.width + 30;

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 460),
      curve: Curves.easeOutBack,
      left: landed ? restLeft : startLeft,
      top: landed ? restTop : area.height + noteH,
      width: noteW,
      height: noteH,
      child: AnimatedOpacity(
        opacity: landed ? 1 : 0,
        duration: const Duration(milliseconds: 160),
        child: AnimatedRotation(
          turns: landed ? spot.angle / (2 * math.pi) : (spot.fromLeft ? -0.4 : 0.4),
          duration: const Duration(milliseconds: 460),
          curve: Curves.easeOutBack,
          child: CustomPaint(
            painter: _BanknotePainter(
              amount: backer.amount,
              name: backer.name,
              isMoney: isMoney,
            ),
          ),
        ),
      ),
    );
  }
}

/// A hand-drawn banknote.
///
/// Painted rather than shipped as an image, for the same reason everything
/// else in this game is: a stock money graphic next to a wobbly biro drawing
/// looks like it wandered in from another app. The wobble here is the same
/// trick used by the logo and the sketch icons.
class _BanknotePainter extends CustomPainter {
  _BanknotePainter({
    required this.amount,
    required this.name,
    required this.isMoney,
  });

  final int amount;
  final String name;
  final bool isMoney;

  static const _green = Color(0xFF2FA84F);
  static const _paper = Color(0xFFEFF7EA);

  @override
  void paint(Canvas canvas, Size size) {
    final seed = (amount * 31 + name.hashCode) & 0xFFFF;
    final rnd = math.Random(seed);
    // A note is a rectangle drawn by a shaky hand, so every corner is a little
    // off and no two notes are identical.
    double jitter() => (rnd.nextDouble() - 0.5) * 2.4;

    final path = Path()
      ..moveTo(1.5 + jitter(), 2.5 + jitter())
      ..lineTo(size.width - 2 + jitter(), 1.5 + jitter())
      ..lineTo(size.width - 1.5 + jitter(), size.height - 2.5 + jitter())
      ..lineTo(2 + jitter(), size.height - 1.5 + jitter())
      ..close();

    canvas.drawShadow(path, Colors.black.withValues(alpha: 0.5), 3, false);
    canvas.drawPath(path, Paint()..color = _paper);
    canvas.drawPath(
      path,
      Paint()
        ..color = _green
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.1
        ..strokeJoin = StrokeJoin.round,
    );

    // The oval a banknote always has in the middle, sketched not printed.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.width / 2, size.height / 2 - 2),
        width: size.width * 0.52,
        height: size.height * 0.5,
      ),
      Paint()
        ..color = _green.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.1,
    );

    _text(
      canvas,
      isMoney ? '\$$amount' : '+$amount',
      Offset(size.width / 2, size.height / 2 - 8),
      13,
      FontWeight.w900,
      _green,
      size.width,
    );
    // Whose money it is. This is the whole point of a note over a number.
    _text(
      canvas,
      name,
      Offset(size.width / 2, size.height / 2 + 7),
      9,
      FontWeight.w700,
      _green.withValues(alpha: 0.85),
      size.width - 8,
    );
  }

  void _text(
    Canvas canvas,
    String value,
    Offset center,
    double fontSize,
    FontWeight weight,
    Color color,
    double maxWidth,
  ) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        // Pinned explicitly: a raw TextPainter doesn't inherit the app's
        // theme-level fontFamily the way a Text widget would.
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: weight,
          color: color,
          fontFamily: 'Roboto',
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      ellipsis: '…',
    )..layout(maxWidth: maxWidth);
    painter.paint(canvas, Offset(center.dx - painter.width / 2, center.dy - painter.height / 2));
  }

  @override
  bool shouldRepaint(_BanknotePainter old) =>
      old.amount != amount || old.name != name || old.isMoney != isMoney;
}

/// The verdict, slammed on like a rubber stamp.
class _FundedStamp extends StatelessWidget {
  const _FundedStamp({
    required this.controller,
    required this.funded,
    required this.label,
  });

  final AnimationController controller;
  final bool funded;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colour = funded ? const Color(0xFF1EA84A) : const Color(0xFFC94040);
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        // Comes down from well oversized, which is what makes it read as
        // stamped rather than faded in.
        final t = Curves.easeOutBack.transform(controller.value);
        return Transform.rotate(
          angle: -0.14 * t,
          child: Transform.scale(scale: 2.4 - 1.4 * t, child: Opacity(opacity: t.clamp(0, 1), child: child)),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        decoration: BoxDecoration(
          color: colour,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 2.5),
          boxShadow: [
            BoxShadow(color: colour.withValues(alpha: 0.5), blurRadius: 18, spreadRadius: 2),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (funded)
              const Padding(
                padding: EdgeInsets.only(right: 7),
                child: SketchIcon(SketchGlyph.coin, size: 15, color: Colors.white),
              ),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The drawing's title on a black plate, the way a gallery labels a piece.
class _TitlePlate extends StatelessWidget {
  const _TitlePlate({required this.title, this.rank, this.of});

  final String title;
  final int? rank;
  final int? of;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              title.isEmpty ? 'UNTITLED' : title.toUpperCase(),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.4,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
