import 'dart:async';

import 'package:flutter/material.dart';

import '../models/round_models.dart';
import '../services/audio_service.dart';
import '../theme.dart';
import 'sketch_icons.dart';

/// Reveals who backed a drawing, one contribution at a time, with the total
/// climbing as each one lands.
///
/// The old version printed the final number and a row of chips all at once,
/// which threw away the most interesting moment in the round: watching a
/// drawing overtake another as the money comes in. Money arriving one stack at
/// a time — with a name attached to each — is the payoff for having voted.
///
/// Each entry runs its own tally, all in parallel, so a five-player round still
/// finishes inside the reveal phase rather than queueing up behind itself.
class BackerTally extends StatefulWidget {
  const BackerTally({
    super.key,
    required this.backers,
    required this.total,
    required this.isMoney,
    this.startDelay = Duration.zero,
    this.sound = false,
  });

  final List<Backer> backers;

  /// The authoritative total from the server. The tally counts toward this
  /// rather than summing locally, so a rounding difference can never leave
  /// the animation showing a number that disagrees with the score table.
  final int total;
  final bool isMoney;
  final Duration startDelay;

  /// Only the player's own drawing ticks — twenty pings across five cards
  /// would be noise, but hearing your own backers arrive is the good bit.
  final bool sound;

  @override
  State<BackerTally> createState() => _BackerTallyState();
}

class _BackerTallyState extends State<BackerTally> {
  static const _perBacker = Duration(milliseconds: 620);

  int _shown = 0;
  Timer? _timer;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    if (widget.backers.isEmpty) {
      _shown = 0;
      return;
    }
    Future.delayed(widget.startDelay, () {
      if (!mounted) return;
      setState(() => _started = true);
      _revealNext();
      _timer = Timer.periodic(_perBacker, (t) {
        if (!mounted || _shown >= widget.backers.length) {
          t.cancel();
          return;
        }
        _revealNext();
      });
    });
  }

  void _revealNext() {
    if (_shown >= widget.backers.length) return;
    setState(() => _shown++);
    if (widget.sound) AudioService.instance.sfx(Sfx.correct);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// What's landed so far. Once every backer is in, snap to the server's total
  /// so the displayed figure always matches the score table exactly.
  int get _running {
    if (_shown >= widget.backers.length) return widget.total;
    var sum = 0;
    for (var i = 0; i < _shown; i++) {
      sum += widget.backers[i].amount;
    }
    return sum;
  }

  @override
  Widget build(BuildContext context) {
    final done = _shown >= widget.backers.length;
    final unit = widget.isMoney
        ? ' raised'
        : widget.total == 1
            ? ' point'
            : ' points';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The running total. It grows very slightly as each stack lands, so
        // the number itself feels like it's being fed.
        AnimatedScale(
          scale: done ? 1.0 : 0.97,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.isMoney)
                const Padding(
                  padding: EdgeInsets.only(right: 5),
                  child: SketchIcon(SketchGlyph.coin, size: 15, color: GameColors.primary),
                ),
              // TweenAnimationBuilder re-runs from its previous value whenever
              // the target changes, so the number rolls up between stacks
              // instead of jumping.
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: _running.toDouble()),
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeOutCubic,
                builder: (context, v, _) => Text(
                  '${widget.isMoney ? '\$' : ''}${v.round()}$unit',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 17,
                    color: GameColors.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (widget.backers.isNotEmpty) ...[
          const SizedBox(height: 8),
          // Reserve the full height up front so cards don't jump as chips
          // arrive — a reflowing list during a staggered reveal looks broken.
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (var i = 0; i < widget.backers.length; i++)
                _BackerChip(
                  backer: widget.backers[i],
                  isMoney: widget.isMoney,
                  revealed: i < _shown,
                ),
            ],
          ),
        ],
        if (!_started && widget.backers.isNotEmpty) const SizedBox.shrink(),
      ],
    );
  }
}

class _BackerChip extends StatelessWidget {
  const _BackerChip({required this.backer, required this.isMoney, required this.revealed});

  final Backer backer;
  final bool isMoney;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: revealed ? 1 : 0,
      duration: const Duration(milliseconds: 240),
      child: AnimatedSlide(
        // Drops in from just above, like a note being put down on the pile.
        offset: revealed ? Offset.zero : const Offset(0, -0.35),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutBack,
        child: AnimatedScale(
          scale: revealed ? 1 : 0.8,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutBack,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: GameColors.surfaceHigh,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: revealed
                    ? GameColors.primary.withValues(alpha: 0.45)
                    : Colors.transparent,
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  backer.name,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                ),
                const SizedBox(width: 5),
                Text(
                  isMoney ? '\$${backer.amount}' : '+${backer.amount}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: GameColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
