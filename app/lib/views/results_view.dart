import 'package:flutter/material.dart';

import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/celebration.dart';
import '../services/audio_service.dart';

class ResultsView extends StatefulWidget {
  const ResultsView({
    super.key,
    required this.mode,
    required this.scores,
    required this.trophies,
    required this.isHost,
    required this.onPlayAgain,
    required this.onLeave,
    this.myId,
  });

  final GameMode mode;
  final List<ScoreRow> scores;

  /// Ranked games only: playerId -> trophies won just now.
  final Map<String, int> trophies;
  final bool isHost;
  final VoidCallback onPlayAgain;
  final VoidCallback onLeave;

  /// Who this screen belongs to, so the celebration only fires for a win.
  final String? myId;

  @override
  State<ResultsView> createState() => _ResultsViewState();
}

class _ResultsViewState extends State<ResultsView> {
  @override
  void initState() {
    super.initState();
    // Fired once from initState rather than from build: a rebuild during
    // the count-up animations would otherwise retrigger the fanfare.
    final w = widget.scores.isNotEmpty ? widget.scores.first : null;
    final won = w != null && widget.myId != null && w.playerId == widget.myId;
    AudioService.instance.sfx(won ? Sfx.win : Sfx.lose);
  }

  @override
  Widget build(BuildContext context) {
    final mode = widget.mode;
    final scores = widget.scores;
    final trophies = widget.trophies;
    final isHost = widget.isHost;
    final onPlayAgain = widget.onPlayAgain;
    final onLeave = widget.onLeave;
    final myId = widget.myId;
    final winner = scores.isNotEmpty ? scores.first : null;
    final iWon = winner != null && myId != null && winner.playerId == myId;

    return Confetti(
      play: iWon,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('FINAL SCORES'),
          automaticallyImplyLeading: false,
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (winner != null) ...[
                  const SizedBox(height: 12),
                  const TrophyDrop(),
                  const SizedBox(height: 8),
                  Text(
                    iWon ? 'You win!' : '${winner.nickname} wins!',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: GameColors.primary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    mode.isRanked ? 'RANKED' : 'FRIENDLY',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: mode.isRanked
                          ? GameColors.lime
                          : GameColors.textMuted,
                      fontSize: 11,
                      letterSpacing: 3,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Expanded(
                  child: ListView.separated(
                    itemCount: scores.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final row = scores[index];
                      return PopIn(
                        index: index,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 16,
                          ),
                          decoration: GameDecor.panel(
                            accent: index == 0 ? GameColors.primary : null,
                            radius: 16,
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
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              CountUp(
                                value: row.score,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: GameColors.primary,
                                ),
                              ),
                              // What this game was actually worth on the ladder.
                              if (trophies[row.playerId] != null) ...[
                                const SizedBox(width: 12),
                                const SketchIcon(SketchGlyph.trophy, size: 13, color: GameColors.lime),
                                const SizedBox(width: 2),
                                CountUp(
                                  value: trophies[row.playerId]!,
                                  prefix: '+',
                                  duration: const Duration(milliseconds: 1200),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: GameColors.lime,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                // Ranked games have no host and no rematch — you queue again,
                // against whoever is around next time.
                if (mode.isRanked)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 4),
                    child: Text(
                      'Trophies have been added to your profile.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  )
                else if (isHost)
                  FilledButton(
                    onPressed: onPlayAgain,
                    child: const Text('PLAY AGAIN'),
                  )
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
                OutlinedButton(
                  onPressed: onLeave,
                  child: Text(mode.isRanked ? 'BACK TO MENU' : 'LEAVE GAME'),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
