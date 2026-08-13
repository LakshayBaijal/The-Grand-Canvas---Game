import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/drawing_canvas.dart';

/// Shows every drawing from the round ranked by how much fake money it
/// attracted, who invested in it, and the running scores.
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
              for (var i = 0; i < event.entries.length; i++) ...[
                _EntryCard(rank: i + 1, entry: event.entries[i]),
                const SizedBox(height: 12),
              ],
              const SizedBox(height: 10),
              const Text(
                'SCORES',
                textAlign: TextAlign.center,
                style: TextStyle(color: GameColors.textMuted, letterSpacing: 3, fontSize: 12),
              ),
              const SizedBox(height: 10),
              for (final row in event.scores) _ScoreLine(row: row),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.rank, required this.entry});

  final int rank;
  final InvestmentResult entry;

  @override
  Widget build(BuildContext context) {
    final isTop = rank == 1 && entry.totalInvested > 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isTop ? GameColors.primary.withValues(alpha: 0.14) : GameColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isTop ? GameColors.primary : GameColors.surfaceHigh, width: 2),
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
                    Text(
                      '\$${entry.totalInvested} raised',
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
          if (entry.investors.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final investor in entry.investors)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: GameColors.surfaceHigh,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${investor.name} \$${investor.amount}',
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
  const _ScoreLine({required this.row});

  final ScoreRow row;

  @override
  Widget build(BuildContext context) {
    final breakdown = [
      if (row.raised > 0) '\$${row.raised} raised',
      if (row.bonus > 0) '+\$${row.bonus} placement',
      if (row.penalty > 0) '-\$${row.penalty} unspent',
    ].join('  ·  ');

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
