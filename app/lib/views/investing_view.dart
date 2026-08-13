import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/countdown.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/paper_frame.dart';

/// Keep in sync with INVEST_SECONDS on the server (the server adds extra
/// time on top of this for the presentation sequence below).
const _investSeconds = 35;

/// Everyone gets a fixed budget and spreads it across every drawing but
/// their own — the "shark tank" investment mechanic from Patently Stupid.
/// Opens with a one-at-a-time presentation of every entry before the
/// interactive allocation screen appears.
class InvestingView extends StatefulWidget {
  const InvestingView({
    super.key,
    required this.event,
    required this.myId,
    required this.submitted,
    required this.total,
    required this.onSubmit,
  });

  final InvestingPhaseEvent event;
  final String myId;
  final int submitted;
  final int total;
  final void Function(Map<String, int>) onSubmit;

  @override
  State<InvestingView> createState() => _InvestingViewState();
}

class _InvestingViewState extends State<InvestingView> {
  late final Map<String, int> _allocations = {
    for (final e in widget.event.entries)
      if (e.artistId != widget.myId) e.artistId: 0,
  };
  bool _presented = false;
  bool _submitted = false;

  int get _spent => _allocations.values.fold(0, (a, b) => a + b);
  int get _remaining => widget.event.budget - _spent;

  void _adjust(String artistId, int delta) {
    if (_submitted) return;
    final current = _allocations[artistId] ?? 0;
    final next = (current + delta).clamp(0, current + _remaining);
    setState(() => _allocations[artistId] = next);
  }

  void _doSubmit() {
    if (_submitted) return;
    widget.onSubmit(_allocations);
    setState(() => _submitted = true);
  }

  Future<void> _trySubmit() async {
    if (_remaining <= 0) {
      _doSubmit();
      return;
    }
    final proceed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: GameColors.surfaceHigh,
        title: const Text('Unspent money!'),
        content: Text(
          "You still have \$$_remaining left. Unspent money is deducted from "
          'your own winnings this round — invest it or lose it.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Go back')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Submit anyway'),
          ),
        ],
      ),
    );
    if (proceed == true) _doSubmit();
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;

    if (!_presented) {
      return _PresentationSequence(
        entries: event.entries,
        onComplete: () => setState(() => _presented = true),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text('INVEST — ROUND ${event.roundIndex + 1} OF ${event.totalRounds}')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 6),
              child: Text(
                event.prompt,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 13,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
            if (!_submitted)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: CountdownBar(deadlineMs: event.deadlineMs, totalSeconds: _investSeconds),
              ),
            Expanded(
              child: _submitted
                  ? Center(
                      child: WaitingIndicator(
                        label: 'Locked in! Waiting for the others…',
                        submitted: widget.submitted,
                        total: widget.total,
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      itemCount: event.entries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final entry = event.entries[index];
                        final isMine = entry.artistId == widget.myId;
                        return _EntryRow(
                          entry: entry,
                          isMine: isMine,
                          amount: _allocations[entry.artistId] ?? 0,
                          canIncrease: !isMine && _remaining >= event.step,
                          onIncrease: () => _adjust(entry.artistId, event.step),
                          onDecrease: () => _adjust(entry.artistId, -event.step),
                        );
                      },
                    ),
            ),
            if (!_submitted)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('💰', style: TextStyle(fontSize: 18)),
                        const SizedBox(width: 8),
                        Text(
                          '\$$_remaining left to invest',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: _remaining > 0 ? GameColors.pink : GameColors.lime,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _remaining > 0
                          ? 'Unspent money is deducted from your own winnings!'
                          : "You're all in — nice.",
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: GameColors.textMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _trySubmit, child: const Text('LOCK IN INVESTMENTS')),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Shows each drawing one at a time — image first, then its title fades in
/// up top — before handing off to the interactive allocation screen.
class _PresentationSequence extends StatefulWidget {
  const _PresentationSequence({required this.entries, required this.onComplete});

  final List<DrawingEntry> entries;
  final VoidCallback onComplete;

  @override
  State<_PresentationSequence> createState() => _PresentationSequenceState();
}

class _PresentationSequenceState extends State<_PresentationSequence> {
  // Keep the sum in step with PRESENT_SECONDS_PER_ENTRY on the server.
  static const _imageOnlyDelay = Duration(milliseconds: 1500);
  static const _titleHoldDelay = Duration(milliseconds: 2000);

  int _index = 0;
  bool _showTitle = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _showImage();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _showImage() {
    _showTitle = false;
    _timer = Timer(_imageOnlyDelay, () {
      if (!mounted) return;
      setState(() => _showTitle = true);
      _timer = Timer(_titleHoldDelay, _advance);
    });
  }

  void _advance() {
    if (!mounted) return;
    if (_index >= widget.entries.length - 1) {
      widget.onComplete();
      return;
    }
    setState(() => _index += 1);
    _showImage();
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entries[_index];

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${_index + 1} / ${widget.entries.length}',
                style: const TextStyle(color: GameColors.textMuted, letterSpacing: 2, fontSize: 12),
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 78,
                child: AnimatedOpacity(
                  opacity: _showTitle ? 1 : 0,
                  duration: const Duration(milliseconds: 450),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        entry.title,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: GameColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'by ${entry.artistName}',
                        style: const TextStyle(color: GameColors.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                child: AspectRatio(
                  key: ValueKey(entry.artistId),
                  aspectRatio: 1,
                  child: PaperCanvas(
                    seed: entry.artistId.hashCode,
                    child: StaticDrawing(strokes: entry.strokes),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({
    required this.entry,
    required this.isMine,
    required this.amount,
    required this.canIncrease,
    required this.onIncrease,
    required this.onDecrease,
  });

  final DrawingEntry entry;
  final bool isMine;
  final int amount;
  final bool canIncrease;
  final VoidCallback onIncrease;
  final VoidCallback onDecrease;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: amount > 0 ? GameColors.surfaceHigh : GameColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: amount > 0 ? Border.all(color: GameColors.primary, width: 2) : null,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 72,
              height: 72,
              child: StaticDrawing(strokes: entry.strokes),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'by ${entry.artistName}',
                  style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isMine)
            const Text(
              'YOURS',
              style: TextStyle(color: GameColors.textMuted, fontSize: 11, fontWeight: FontWeight.w700),
            )
          else
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '\$$amount',
                  style: const TextStyle(fontWeight: FontWeight.w900, color: GameColors.primary),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _StepButton(icon: Icons.remove_rounded, onTap: amount > 0 ? onDecrease : null),
                    const SizedBox(width: 6),
                    _StepButton(icon: Icons.add_rounded, onTap: canIncrease ? onIncrease : null),
                  ],
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: onTap != null ? GameColors.primary : GameColors.surfaceHigh,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 16, color: onTap != null ? const Color(0xFF241800) : GameColors.textMuted),
      ),
    );
  }
}
