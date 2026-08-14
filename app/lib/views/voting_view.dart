import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/countdown.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/presentation_sequence.dart';

/// Keep in sync with INVEST_SECONDS on the server (the server adds extra
/// time on top of this for the presentation sequence).
const _voteSeconds = 35;

/// Voting on the round's drawings.
///
/// Both modes open with the same one-at-a-time presentation, then split:
/// ranked games hand out a budget to invest (the "shark tank" mechanic from
/// Patently Stupid), friendly games just pick a 1st, 2nd and 3rd. Friendly
/// deliberately has no budget and no penalties — there's nothing at stake, so
/// there's nothing to get wrong.
class VotingView extends StatefulWidget {
  const VotingView({
    super.key,
    required this.event,
    required this.myId,
    required this.submitted,
    required this.total,
    required this.onInvest,
    required this.onRank,
  });

  final VotingPhaseEvent event;
  final String myId;
  final int submitted;
  final int total;
  final void Function(Map<String, int>) onInvest;
  final void Function(List<String>) onRank;

  @override
  State<VotingView> createState() => _VotingViewState();
}

class _VotingViewState extends State<VotingView> {
  bool _presented = false;

  @override
  Widget build(BuildContext context) {
    final event = widget.event;

    if (!_presented) {
      return PresentationSequence(
        entries: event.entries,
        onComplete: () => setState(() => _presented = true),
      );
    }

    return event.scoring.isMoney
        ? _InvestPanel(
            event: event,
            myId: widget.myId,
            submitted: widget.submitted,
            total: widget.total,
            onSubmit: widget.onInvest,
          )
        : _PodiumPanel(
            event: event,
            myId: widget.myId,
            submitted: widget.submitted,
            total: widget.total,
            onSubmit: widget.onRank,
          );
  }
}

/// Shared chrome: the prompt, the clock, and the "waiting for others" state.
class _VotingScaffold extends StatelessWidget {
  const _VotingScaffold({
    required this.title,
    required this.event,
    required this.submitted,
    required this.total,
    required this.isSubmitted,
    required this.body,
    required this.footer,
  });

  final String title;
  final VotingPhaseEvent event;
  final int submitted;
  final int total;
  final bool isSubmitted;
  final Widget body;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          '$title — ROUND ${event.roundIndex + 1} OF ${event.totalRounds}',
        ),
      ),
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
            if (!isSubmitted)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: CountdownBar(
                  deadlineMs: event.deadlineMs,
                  totalSeconds: _voteSeconds,
                ),
              ),
            Expanded(
              child: isSubmitted
                  ? Center(
                      child: WaitingIndicator(
                        label: 'Locked in! Waiting for the others…',
                        submitted: submitted,
                        total: total,
                      ),
                    )
                  : body,
            ),
            if (!isSubmitted) footer,
          ],
        ),
      ),
    );
  }
}

// --- ranked: spread a budget across the drawings ---------------------------

class _InvestPanel extends StatefulWidget {
  const _InvestPanel({
    required this.event,
    required this.myId,
    required this.submitted,
    required this.total,
    required this.onSubmit,
  });

  final VotingPhaseEvent event;
  final String myId;
  final int submitted;
  final int total;
  final void Function(Map<String, int>) onSubmit;

  @override
  State<_InvestPanel> createState() => _InvestPanelState();
}

class _InvestPanelState extends State<_InvestPanel> {
  late final Map<String, int> _allocations = {
    for (final e in widget.event.entries)
      if (e.artistId != widget.myId) e.artistId: 0,
  };
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
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Go back'),
          ),
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
    return _VotingScaffold(
      title: 'INVEST',
      event: event,
      submitted: widget.submitted,
      total: widget.total,
      isSubmitted: _submitted,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: event.entries.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final entry = event.entries[index];
          final isMine = entry.artistId == widget.myId;
          final amount = _allocations[entry.artistId] ?? 0;
          return _EntryRow(
            entry: entry,
            isMine: isMine,
            highlighted: amount > 0,
            trailing: isMine
                ? const _YoursTag()
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '\$$amount',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          color: GameColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _StepButton(
                            icon: Icons.remove_rounded,
                            onTap: amount > 0
                                ? () => _adjust(entry.artistId, -event.step)
                                : null,
                          ),
                          const SizedBox(width: 6),
                          _StepButton(
                            icon: Icons.add_rounded,
                            onTap: _remaining >= event.step
                                ? () => _adjust(entry.artistId, event.step)
                                : null,
                          ),
                        ],
                      ),
                    ],
                  ),
          );
        },
      ),
      footer: Padding(
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
            FilledButton(
              onPressed: _trySubmit,
              child: const Text('LOCK IN INVESTMENTS'),
            ),
          ],
        ),
      ),
    );
  }
}

// --- friendly: pick a podium ------------------------------------------------

class _PodiumPanel extends StatefulWidget {
  const _PodiumPanel({
    required this.event,
    required this.myId,
    required this.submitted,
    required this.total,
    required this.onSubmit,
  });

  final VotingPhaseEvent event;
  final String myId;
  final int submitted;
  final int total;
  final void Function(List<String>) onSubmit;

  @override
  State<_PodiumPanel> createState() => _PodiumPanelState();
}

class _PodiumPanelState extends State<_PodiumPanel> {
  /// Picks in order, best first. Tapping appends; tapping a pick removes it
  /// and everything below shifts up, so there's never a gap to reason about.
  final List<String> _picks = [];
  bool _submitted = false;

  static const _medals = ['🥇', '🥈', '🥉'];
  static const _points = [3, 2, 1];

  List<DrawingEntry> get _others =>
      widget.event.entries.where((e) => e.artistId != widget.myId).toList();

  int get _maxPicks => widget.event.places < _others.length
      ? widget.event.places
      : _others.length;

  void _toggle(String artistId) {
    if (_submitted) return;
    setState(() {
      if (_picks.contains(artistId)) {
        _picks.remove(artistId);
      } else if (_picks.length < _maxPicks) {
        _picks.add(artistId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final complete = _picks.length == _maxPicks;
    final nextPlace = _picks.length < _medals.length
        ? _medals[_picks.length]
        : '';

    return _VotingScaffold(
      title: 'VOTE',
      event: event,
      submitted: widget.submitted,
      total: widget.total,
      isSubmitted: _submitted,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: event.entries.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final entry = event.entries[index];
          final isMine = entry.artistId == widget.myId;
          final place = _picks.indexOf(entry.artistId);
          return GestureDetector(
            onTap: isMine ? null : () => _toggle(entry.artistId),
            child: _EntryRow(
              entry: entry,
              isMine: isMine,
              highlighted: place >= 0,
              trailing: isMine
                  ? const _YoursTag()
                  : place >= 0
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Keyed on the place so moving a pick up or down
                        // re-runs the pop rather than silently swapping.
                        TweenAnimationBuilder<double>(
                          key: ValueKey('${entry.artistId}-$place'),
                          tween: Tween(begin: 0, end: 1),
                          duration: const Duration(milliseconds: 320),
                          curve: Curves.easeOutBack,
                          builder: (context, v, child) =>
                              Transform.scale(scale: v, child: child),
                          child: Text(
                            _medals[place],
                            style: const TextStyle(fontSize: 26),
                          ),
                        ),
                        Text(
                          '+${_points[place]}',
                          style: const TextStyle(
                            color: GameColors.primary,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    )
                  : Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: GameColors.surfaceHigh,
                          width: 2,
                        ),
                      ),
                    ),
            ),
          );
        },
      ),
      footer: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              complete
                  ? 'Podium set!'
                  : 'Tap your favourite to award $nextPlace  '
                        '(${_picks.length}/$_maxPicks picked)',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: complete ? GameColors.lime : GameColors.primary,
              ),
            ),
            const SizedBox(height: 2),
            const Text(
              '1st is worth 3 points, 2nd 2, 3rd 1. Tap again to undo.',
              textAlign: TextAlign.center,
              style: TextStyle(color: GameColors.textMuted, fontSize: 11),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _picks.isEmpty
                  ? null
                  : () {
                      widget.onSubmit(List.of(_picks));
                      setState(() => _submitted = true);
                    },
              child: Text(
                complete
                    ? 'LOCK IN VOTES'
                    : 'LOCK IN ${_picks.length} VOTE'
                          '${_picks.length == 1 ? '' : 'S'}',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// --- shared bits ------------------------------------------------------------

class _EntryRow extends StatelessWidget {
  const _EntryRow({
    required this.entry,
    required this.isMine,
    required this.highlighted,
    required this.trailing,
  });

  final DrawingEntry entry;
  final bool isMine;
  final bool highlighted;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: GameDecor.panel(
        accent: highlighted ? GameColors.primary : null,
        radius: 16,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 72,
              height: 72,
              child: StaticDrawing(strokes: entry.strokes, paper: entry.paper),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'by ${entry.artistName}',
                  style: const TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          trailing,
        ],
      ),
    );
  }
}

class _YoursTag extends StatelessWidget {
  const _YoursTag();

  @override
  Widget build(BuildContext context) {
    return const Text(
      'YOURS',
      style: TextStyle(
        color: GameColors.textMuted,
        fontSize: 11,
        fontWeight: FontWeight.w700,
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
        child: Icon(
          icon,
          size: 16,
          color: onTap != null ? const Color(0xFF241800) : GameColors.textMuted,
        ),
      ),
    );
  }
}
