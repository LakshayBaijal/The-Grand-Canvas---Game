import 'dart:async';

import 'package:flutter/material.dart';

import '../models/daily_models.dart';
import '../models/game_event.dart';
import '../services/audio_service.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../widgets/ad_banner.dart';
import '../widgets/celebration.dart';
import '../widgets/drawing_actions.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/sketch_icons.dart';

/// Every finished Daily, newest first: the prompt, and the three drawings
/// the world hearted most. Frozen at midnight, kept forever, and each of the
/// three was paid trophies for being there.
class HallOfFameScreen extends StatefulWidget {
  const HallOfFameScreen({super.key, required this.connection});

  final GameConnection connection;

  @override
  State<HallOfFameScreen> createState() => _HallOfFameScreenState();
}

class _HallOfFameScreenState extends State<HallOfFameScreen> {
  StreamSubscription<GameEvent>? _sub;
  List<HallDay>? _days;
  bool _hasMore = false;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen((event) {
      if (!mounted) return;
      if (event is ArtistHiddenEvent) {
        setState(() {
          _days = _days
              ?.map(
                (d) => HallDay(
                  day: d.day,
                  prompt: d.prompt,
                  top: d.top
                      .where((e) => e.artistId != event.artistId)
                      .toList(),
                ),
              )
              .toList();
        });
        return;
      }
      if (event is! DailyHistoryEvent) return;
      setState(() {
        final current = _days ?? [];
        final seen = current.map((d) => d.day).toSet();
        _days = [...current, ...event.days.where((d) => !seen.contains(d.day))];
        _hasMore = event.hasMore;
        _loadingMore = false;
      });
    });
    widget.connection.dailyHistory();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _loadMore() {
    final days = _days;
    if (!_hasMore || _loadingMore || days == null || days.isEmpty) return;
    _loadingMore = true;
    widget.connection.dailyHistory(beforeDay: days.last.day);
  }

  @override
  Widget build(BuildContext context) {
    AudioService.instance.play(Music.leaderboard);
    final days = _days;
    return Scaffold(
      bottomNavigationBar: const AdBanner(),
      appBar: AppBar(title: const Text('HALL OF FAME')),
      body: SafeArea(
        child: days == null
            ? const Center(
                child: CircularProgressIndicator(color: GameColors.primary),
              )
            : days.isEmpty
            ? const _Empty()
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 30),
                itemCount: days.length + 1,
                itemBuilder: (context, i) {
                  if (i == days.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: _loadingMore
                          ? const Center(
                              child: CircularProgressIndicator(
                                color: GameColors.primary,
                              ),
                            )
                          : _hasMore
                          ? OutlinedButton(
                              onPressed: _loadMore,
                              child: const Text('EARLIER DAYS'),
                            )
                          : const SizedBox.shrink(),
                    );
                  }
                  return PopIn(
                    index: i < 6 ? i : 6,
                    child: _DayCard(
                      day: days[i],
                      onActions: (entry) => showDrawingActions(
                        context,
                        strokes: entry.strokes,
                        paper: entry.paper,
                        title: entry.title,
                        prompt: days[i].prompt,
                        artistLabel: entry.artistName,
                        onReport: (reason) async => widget.connection
                            .reportDrawing(entryId: entry.id, reason: reason),
                        onHide: () async =>
                            widget.connection.hideArtist(entryId: entry.id),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({required this.day, required this.onActions});

  final HallDay day;
  final void Function(DailyEntry entry) onActions;

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final d = day.date;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${d.day} ${_months[d.month - 1]} ${d.year}'.toUpperCase(),
            style: const TextStyle(
              color: GameColors.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            day.prompt,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(
                  child: i < day.top.length
                      ? HallTile(
                          entry: day.top[i],
                          prompt: day.prompt,
                          onActions: () => onActions(day.top[i]),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// One of the day's three, with its place, its hearts and who drew it.
/// Shared with the Daily gallery's own top-three strip.
class HallTile extends StatelessWidget {
  const HallTile({
    super.key,
    required this.entry,
    required this.prompt,
    this.isMe = false,
    this.onActions,
  });

  final DailyEntry entry;
  final String prompt;
  final bool isMe;

  /// Save / share / report / hide. Long-press here, or the button in the
  /// detail view.
  final VoidCallback? onActions;

  static const medalColors = {
    1: GameColors.primary,
    2: Color(0xFFC7CDD9),
    3: Color(0xFFD98756),
  };

  @override
  Widget build(BuildContext context) {
    final medal = medalColors[entry.rank] ?? GameColors.textMuted;
    return GestureDetector(
      onTap: () => showHallDetail(
        context,
        entry,
        prompt,
        isMe: isMe,
        onActions: onActions,
      ),
      onLongPress: onActions,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: StaticDrawing(
                    strokes: entry.strokes,
                    paper: entry.paper,
                  ),
                ),
              ),
              Positioned(
                left: 6,
                top: 6,
                child: Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: medal,
                    shape: BoxShape.circle,
                    boxShadow: GameDecor.glow(medal, strength: 0.5),
                  ),
                  child: Text(
                    '${entry.rank ?? ''}',
                    style: const TextStyle(
                      color: Color(0xFF231700),
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            entry.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
          ),
          Text(
            entry.artistName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: isMe ? GameColors.primary : GameColors.cyan,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Row(
            children: [
              const Icon(Icons.favorite, size: 12, color: GameColors.pink),
              const SizedBox(width: 3),
              Text(
                '${entry.hearts}',
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The drawing large, with everything known about it. [anonymous] is the
/// open-day gallery: no artist, no count, and a line saying when they come.
void showHallDetail(
  BuildContext context,
  DailyEntry entry,
  String prompt, {
  bool isMe = false,
  bool anonymous = false,
  VoidCallback? onActions,
}) {
  final d = entry.date;
  final rank = entry.rank;
  showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.82),
    builder: (context) => Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(18),
      child: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: StaticDrawing(
                    strokes: entry.strokes,
                    paper: entry.paper,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                entry.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                isMe
                    ? 'by you'
                    : anonymous
                    ? 'Artist revealed at midnight'
                    : 'by ${entry.artistName}',
                style: TextStyle(
                  color: anonymous && !isMe
                      ? GameColors.textMuted
                      : GameColors.cyan,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  if (anonymous && !isMe)
                    _Chip(
                      icon: Icon(
                        entry.heartedByMe
                            ? Icons.favorite
                            : Icons.favorite_border,
                        size: 13,
                        color: GameColors.pink,
                      ),
                      text: entry.heartedByMe
                          ? 'You hearted this'
                          : 'Not hearted yet',
                    )
                  else
                    _Chip(
                      icon: const Icon(
                        Icons.favorite,
                        size: 13,
                        color: GameColors.pink,
                      ),
                      text: '${entry.hearts} hearts',
                    ),
                  if (rank != null)
                    _Chip(
                      icon: SketchIcon(
                        SketchGlyph.medal,
                        size: 14,
                        color: HallTile.medalColors[rank] ?? GameColors.primary,
                      ),
                      text: rank == 1
                          ? '1st that day'
                          : rank == 2
                          ? '2nd that day'
                          : '3rd that day',
                    ),
                  if (rank != null && rank <= dailyTrophies.length)
                    _Chip(
                      icon: const SketchIcon(
                        SketchGlyph.trophy,
                        size: 14,
                        color: GameColors.primary,
                      ),
                      text: '+${dailyTrophies[rank - 1]} trophies',
                    ),
                  _Chip(
                    icon: const SketchIcon(
                      SketchGlyph.clock,
                      size: 13,
                      color: GameColors.textMuted,
                    ),
                    text: '${d.day}/${d.month}/${d.year}',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                prompt,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
              if (onActions != null) ...[
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    onActions();
                  },
                  icon: const Icon(Icons.more_horiz_rounded, size: 18),
                  label: Text(isMe ? 'SAVE OR SHARE' : 'SAVE · SHARE · REPORT'),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.text});

  final Widget icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: GameColors.surfaceHigh,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: GameColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 6),
          Text(
            text,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(36),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SketchIcon(SketchGlyph.trophy, size: 48, color: GameColors.primary),
            SizedBox(height: 16),
            Text(
              'Nothing here yet',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 8),
            Text(
              "A day's three most-hearted drawings land here at midnight. "
              'Draw today, and heart the ones you love.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: GameColors.textMuted,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
