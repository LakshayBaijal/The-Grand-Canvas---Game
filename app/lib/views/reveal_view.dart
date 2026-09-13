import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/celebration.dart';
import '../widgets/drawing_actions.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/backer_tally.dart';
import '../widgets/money_showcase.dart';

/// The round's results, in two acts.
///
/// **The showcase**: every drawing comes back full size, one at a time, and
/// the money it raised is thrown onto it a backer at a time — the moment the
/// round has been building towards. Worst first, so the drawing that won is
/// the last thing anyone sees.
///
/// **The scoreboard**: once every drawing has had its turn, the running totals
/// for the whole game.
///
/// A list of small cards showing everything at once, which is what this used
/// to be, gets the same information on screen in a fifth of the time and none
/// of it lands.
class RevealView extends StatefulWidget {
  const RevealView({super.key, required this.event, this.myId, this.onReport});

  final RoundRevealEvent event;

  /// Used only to decide whose drawing makes a sound.
  final String? myId;

  /// A report about someone's round drawing, for a person to read. Rounds
  /// have no entry ids, so it goes by artist and title.
  final void Function(String artistId, String title, String reason)? onReport;

  @override
  State<RevealView> createState() => _RevealViewState();
}

class _RevealViewState extends State<RevealView> {
  /// Must match SHOWCASE_SECONDS_PER_ENTRY on the server. If the phase timer
  /// runs out mid-showcase the last drawing never gets its turn, so the two
  /// numbers are load-bearing together.
  static const _perEntry = Duration(milliseconds: 4600);

  /// Which drawing is on screen. Once it runs past the end, the scoreboard
  /// takes over.
  int _index = 0;
  Timer? _timer;

  /// Worst first, so the winner is last. [RoundRevealEvent.entries] arrives
  /// best-first for the scoreboard, so this is its reverse.
  late final List<RoundResult> _order = widget.event.entries.reversed.toList();

  @override
  void initState() {
    super.initState();
    _advance();
  }

  void _advance() {
    _timer = Timer(_perEntry, () {
      if (!mounted) return;
      setState(() => _index++);
      if (_index < _order.length) _advance();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Lets an impatient table skip to the scores. The phase still ends on the
  /// server's clock, so skipping only ever costs you the animation.
  void _skip() {
    _timer?.cancel();
    setState(() => _index = _order.length);
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final showcasing = _index < _order.length;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'RESULTS — ROUND ${event.roundIndex + 1} OF ${event.totalRounds}',
        ),
        actions: [
          if (showcasing)
            TextButton(
              onPressed: _skip,
              child: const Text(
                'SKIP',
                style: TextStyle(fontSize: 12, letterSpacing: 1.5),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: showcasing ? _buildShowcase(event) : _buildScoreboard(event),
          ),
        ),
      ),
    );
  }

  Widget _buildShowcase(RoundRevealEvent event) {
    final entry = _order[_index];
    return Padding(
      // Keyed by artist so the switcher treats each drawing as a new screen
      // and cross-fades between them.
      key: ValueKey('showcase-${entry.artistId}'),
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      child: MoneyShowcase(
        entry: entry,
        isMoney: event.scoring.isMoney,
        fundingGoal: event.fundingGoal,
        duration: _perEntry,
        isMine: entry.artistId == widget.myId,
        // Displayed worst-first, so the rank is counted back from the end.
        rank: _order.length - _index,
        totalEntries: _order.length,
      ),
    );
  }

  Widget _buildScoreboard(RoundRevealEvent event) {
    return SingleChildScrollView(
      key: const ValueKey('scoreboard'),
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
          // Best first here, arriving one after another so the winner lands
          // before the also-rans.
          for (var i = 0; i < event.entries.length; i++) ...[
            PopIn(
              index: i,
              child: _EntryCard(
                rank: i + 1,
                entry: event.entries[i],
                scoring: event.scoring,
                // The money already landed during the showcase, so these are
                // a summary rather than a second animation of the same thing.
                startDelay: Duration(milliseconds: 320 + i * 90),
                isMine: event.entries[i].artistId == widget.myId,
                onActions: () {
                  final e = event.entries[i];
                  final mine = e.artistId == widget.myId;
                  showDrawingActions(
                    context,
                    strokes: e.strokes,
                    paper: e.paper,
                    title: e.title,
                    prompt: event.prompt,
                    artistLabel: e.artistName,
                    isMine: mine,
                    onReport: mine || widget.onReport == null
                        ? null
                        : (reason) async =>
                              widget.onReport!(e.artistId, e.title, reason),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 10),
          const Text(
            'SCORES',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: GameColors.textMuted,
              letterSpacing: 3,
              fontSize: 12,
            ),
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
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({
    required this.rank,
    required this.entry,
    required this.scoring,
    required this.startDelay,
    required this.isMine,
    required this.onActions,
  });

  final int rank;
  final RoundResult entry;
  final Scoring scoring;
  final Duration startDelay;
  final bool isMine;
  final VoidCallback onActions;

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
              // Tap the drawing to keep it or send it (or, if it isn't
              // yours, to say something's wrong with it). The reveal is the
              // moment people want to share, so this is where the button is.
              GestureDetector(
                onTap: onActions,
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(
                        width: 84,
                        height: 84,
                        child: StaticDrawing(
                          strokes: entry.strokes,
                          paper: entry.paper,
                        ),
                      ),
                    ),
                    Positioned(
                      right: 4,
                      bottom: 4,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.ios_share_rounded,
                          size: 13,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (isTop)
                          const Padding(
                            padding: EdgeInsets.only(right: 6),
                            child: SketchIcon(
                              SketchGlyph.trophy,
                              size: 16,
                              color: GameColors.primary,
                            ),
                          ),
                        Expanded(
                          child: Text(
                            entry.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'by ${entry.artistName}',
                      style: const TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Each backer's stack lands one at a time and the total
                    // climbs with them — see BackerTally.
                    BackerTally(
                      backers: entry.backers,
                      total: entry.total,
                      isMoney: scoring.isMoney,
                      startDelay: startDelay,
                      sound: isMine,
                    ),
                  ],
                ),
              ),
            ],
          ),
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
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (breakdown.isNotEmpty)
                  Text(
                    breakdown,
                    style: const TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 11,
                    ),
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
                  color: row.delta > 0
                      ? GameColors.lime
                      : const Color(0xFFFF6B6B),
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
