import 'package:flutter/material.dart';

import '../models/round_models.dart';
import '../theme.dart';

class ResultsView extends StatelessWidget {
  const ResultsView({
    super.key,
    required this.scores,
    required this.isHost,
    required this.onPlayAgain,
    required this.onLeave,
  });

  final List<ScoreRow> scores;
  final bool isHost;
  final VoidCallback onPlayAgain;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final winner = scores.isNotEmpty ? scores.first : null;

    return Scaffold(
      appBar: AppBar(title: const Text('FINAL SCORES'), automaticallyImplyLeading: false),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (winner != null) ...[
                const SizedBox(height: 12),
                const Text('🏆', style: TextStyle(fontSize: 56), textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(
                  '${winner.nickname} wins!',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: GameColors.primary,
                  ),
                ),
                const SizedBox(height: 24),
              ],
              Expanded(
                child: ListView.separated(
                  itemCount: scores.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final row = scores[index];
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                      decoration: BoxDecoration(
                        color: index == 0 ? GameColors.surfaceHigh : GameColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: index == 0
                            ? Border.all(color: GameColors.primary, width: 2)
                            : null,
                      ),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 30,
                            child: Text(
                              '${index + 1}',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: GameColors.textMuted,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              row.nickname,
                              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                            ),
                          ),
                          Text(
                            '${row.score}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: GameColors.primary,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              if (isHost)
                FilledButton(onPressed: onPlayAgain, child: const Text('PLAY AGAIN'))
              else
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 18),
                  child: Text(
                    'Waiting for the host to start another round…',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: GameColors.textMuted),
                  ),
                ),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: onLeave, child: const Text('LEAVE GAME')),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
