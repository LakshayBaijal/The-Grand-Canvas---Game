import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/celebration.dart';
import '../widgets/drawing_canvas.dart';

/// Shows every drawing from the round, best first, who backed it, and the
/// running scores. Reads as money in ranked games and as vote points in
/// friendly ones — the layout is the same, only the units differ.
class RevealView extends StatelessWidget {
  const RevealView({super.key, required this.event});

  final RoundRevealEvent event;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('RESULTS — ROUND ${event.roundIndex + 1} OF ${event.totalRounds}')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Text(
                event.prompt,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 13,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 16),
              // Best first, arriving one after another so the winner lands
              // before the also-rans rather than everything appearing at once.
              for (var i = 0; i < event.entries.length; i++) ...[
                PopIn(
                  index: i,
                  child: _EntryCard(
                    rank: i + 1,
                    entry: event.entries[i],
                    scoring: event.scoring,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              const SizedBox(height: 10),
              const Text(
                'SCORES',
                textAlign: TextAlign.center,
                style: TextStyle(color: GameColors.textMuted, letterSpacing: 3, fontSize: 12),
              ),
              const SizedBox(height: 10),
              for (var i = 0; i < event.scores.length; i++)
                PopIn(
                  index: event.entries.length + i,
                  child: _ScoreLine(row: event.scores[i], scoring: event.scoring),
                ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.rank, required this.entry, required this.scoring});

  final int rank;
  final RoundResult entry;
  final Scoring scoring;

  @override
  Widget build(BuildContext context) {
    final isTop = rank == 1 && entry.total > 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: GameDecor.panel(
        accent: isTop ? GameColors.primary : null,
        radius: 18,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(width: 84, height: 84, child: StaticDrawing(strokes: entry.strokes)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (isTop) const Padding(
                          padding: EdgeInsets.only(right: 6),
                          child: Text('🏆', style: TextStyle(fontSize: 16)),
                        ),
                        Expanded(
                          child: Text(
                            entry.title,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'by ${entry.artistName}',
                      style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    CountUp(
                      value: entry.total,
                      prefix: scoring.isMoney ? '\$' : '',
                      suffix: scoring.isMoney
                          ? ' raised'
                          : entry.total == 1
                              ? ' point'
                              : ' points',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                        color: GameColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (entry.backers.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final backer in entry.backers)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: GameColors.surfaceHigh,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      scoring.isMoney
                          ? '${backer.name} \$${backer.amount}'
                          : '${backer.name} +${backer.amount}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ScoreLine extends StatelessWidget {
  const _ScoreLine({required this.row, required this.scoring});

  final ScoreRow row;
  final Scoring scoring;

  @override
  Widget build(BuildContext context) {
    // Friendly games have no bonuses and no penalties, so their breakdown is
    // just the points the drawing earned.
    final breakdown = scoring.isMoney
        ? [
            if (row.raised > 0) '\$${row.raised} raised',
            if (row.bonus > 0) '+\$${row.bonus} placement',
            if (row.penalty > 0) '-\$${row.penalty} unspent',
          ].join('  ·  ')
        : row.raised > 0
            ? '${row.raised} point${row.raised == 1 ? '' : 's'} from the table'
            : '';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.nickname,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                if (breakdown.isNotEmpty)
                  Text(
                    breakdown,
                    style: const TextStyle(color: GameColors.textMuted, fontSize: 11),
                  ),
              ],
            ),
          ),
          if (row.delta != 0)
            Padding(
              padding: const EdgeInsets.only(right: 10, top: 2),
              child: Text(
                row.delta > 0 ? '+${row.delta}' : '${row.delta}',
                style: TextStyle(
                  color: row.delta > 0 ? GameColors.lime : const Color(0xFFFF6B6B),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          Text(
            '${row.score}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: GameColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
