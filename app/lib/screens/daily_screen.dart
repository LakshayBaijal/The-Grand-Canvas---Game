import 'dart:async';

import 'package:flutter/material.dart';

import '../models/daily_models.dart';
import '../models/game_event.dart';
import '../models/stroke.dart';
import '../models/styles.dart';
import '../services/audio_service.dart';
import '../services/daily_reminder.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../views/draw_view.dart';
import '../widgets/celebration.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/sketch_icons.dart';
import 'hall_of_fame_screen.dart';

/// The Daily: one prompt for the whole world, a drawing with no clock and
/// nothing locked, and then everyone else's take on the same idea.
///
/// Nobody votes and nothing is scored — but anyone who drew can give a heart
/// to any drawing that isn't theirs, once, and it can never be taken back.
/// The three most-hearted drawings of the day are the day's top three; at
/// midnight they go into the Hall of Fame and their artists win trophies.
/// The gallery is only open to people who drew — the server refuses it
/// otherwise, and this screen never even asks until it knows the player has
/// submitted.
class DailyScreen extends StatefulWidget {
  const DailyScreen({super.key, required this.connection, required this.myId});

  final GameConnection connection;
  final String myId;

  @override
  State<DailyScreen> createState() => _DailyScreenState();
}

enum _Stage { loading, intro, drawing, sending, gallery }

class _DailyScreenState extends State<DailyScreen> {
  StreamSubscription<GameEvent>? _sub;

  /// Ticks once a minute so "new prompt in 3h 12m" stays honest, and so the
  /// screen notices midnight if someone leaves it open.
  Timer? _clock;

  _Stage _stage = _Stage.loading;
  DailyInfoEvent? _info;

  /// Which day the loaded gallery belongs to, so a page arriving after
  /// midnight doesn't get mixed into the new day's wall.
  int? _galleryDay;
  final List<DailyEntry> _entries = [];

  /// Yesterday's winners, names and all. Comes with the gallery's first page.
  HallDay? _yesterday;
  bool _hasMore = false;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_onEvent);
    widget.connection.dailyInfo();
    _clock = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      final info = _info;
      if (info != null &&
          DateTime.now().millisecondsSinceEpoch >= info.endsAtMs) {
        widget.connection.dailyInfo();
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _clock?.cancel();
    super.dispose();
  }

  void _onEvent(GameEvent event) {
    if (!mounted) return;
    switch (event) {
      case DailyInfoEvent():
        // The one moment to ask about the morning reminder: they've just sent
        // their first drawing in, so they know exactly what it would be for.
        final justSubmitted = _stage == _Stage.sending && event.submitted;
        setState(() {
          _info = event;
          if (event.submitted) {
            if (_galleryDay != event.day) {
              _galleryDay = event.day;
              _entries.clear();
              _hasMore = false;
              _loadingMore = false;
              widget.connection.dailyGallery();
            }
            _stage = _Stage.gallery;
          } else if (_stage != _Stage.drawing) {
            // A player mid-drawing when a new day arrives keeps their canvas;
            // everything else lands on the front page.
            _stage = _Stage.intro;
          }
        });
        if (justSubmitted && !DailyReminder.instance.decided) _offerReminder();
      case DailyGalleryEvent():
        if (event.day != _galleryDay) return;
        setState(() {
          final seen = _entries.map((e) => e.id).toSet();
          _entries.addAll(event.entries.where((e) => !seen.contains(e.id)));
          _entries.sort((a, b) => b.id.compareTo(a.id));
          // Only the first page carries yesterday; later pages send null.
          if (event.yesterday != null) _yesterday = event.yesterday;
          _hasMore = event.hasMore;
          _loadingMore = false;
        });
      case DailyHeartedEvent():
        // The tap already painted the heart; this just confirms it stuck.
        // (No count comes back while the day is open: the wall is blind.)
        setState(() {
          for (var i = 0; i < _entries.length; i++) {
            if (_entries[i].id == event.entryId) {
              _entries[i] = _entries[i].copyWith(heartedByMe: true);
            }
          }
        });
      case ErrorEvent():
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(event.message)));
        if (_stage == _Stage.sending) setState(() => _stage = _Stage.intro);
        _loadingMore = false;
      case DisconnectedEvent():
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lost the connection to the server')),
        );
      default:
        break;
    }
  }

  void _startDrawing() => setState(() => _stage = _Stage.drawing);

  /// One heart, and it stays. Painted immediately so the tap feels like it
  /// landed; the server's reply confirms it.
  void _heart(DailyEntry entry) {
    if (entry.heartedByMe || entry.artistId == widget.myId) return;
    setState(() {
      for (var i = 0; i < _entries.length; i++) {
        if (_entries[i].id == entry.id) {
          _entries[i] = _entries[i].copyWith(heartedByMe: true);
        }
      }
    });
    widget.connection.heartDaily(entry.id);
  }

  void _openHall() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HallOfFameScreen(connection: widget.connection),
      ),
    );
  }

  Future<void> _offerReminder() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tomorrow\'s prompt at 9am?'),
        content: const Text(
          'One notification a morning with the day\'s prompt — nothing else, ever. '
          'You can switch it off from the gallery.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('NO THANKS'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('REMIND ME'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (yes == true) {
      final on = await DailyReminder.instance.enable();
      if (on) widget.connection.dailyUpcoming();
    } else {
      await DailyReminder.instance.decline();
    }
  }

  Future<void> _toggleReminder(bool on) async {
    if (on) {
      final granted = await DailyReminder.instance.enable();
      if (granted) widget.connection.dailyUpcoming();
    } else {
      await DailyReminder.instance.disable();
    }
    if (mounted) setState(() {});
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        backgroundColor: GameColors.surfaceHigh,
        title: const Text('Leave the daily?'),
        content: const Text(
          "Your drawing hasn't been sent in. It'll be gone if you leave.",
          style: TextStyle(color: GameColors.textMuted, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialog).pop(false),
            child: const Text('KEEP DRAWING'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialog).pop(true),
            child: const Text(
              'LEAVE',
              style: TextStyle(color: GameColors.pink),
            ),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  void _submit(List<Stroke> strokes, String title, PaperStyle paper) {
    setState(() => _stage = _Stage.sending);
    widget.connection.submitDaily(strokes, title, paper);
  }

  void _loadMore() {
    if (!_hasMore || _loadingMore || _entries.isEmpty) return;
    _loadingMore = true;
    widget.connection.dailyGallery(beforeId: _entries.last.id);
  }

  Future<void> _refresh() async {
    _galleryDay = null;
    widget.connection.dailyInfo();
  }

  @override
  Widget build(BuildContext context) {
    AudioService.instance.play(
      _stage == _Stage.drawing ? Music.drawing : Music.presentation,
    );
    final info = _info;

    switch (_stage) {
      case _Stage.loading:
        return const _Holding(label: 'Finding today\'s prompt…');
      case _Stage.sending:
        return const _Holding(label: 'Sending it in…');
      case _Stage.drawing:
        // There is no clock here, so a drawing can be an hour's work — and the
        // app bar's back arrow would throw it away without a word. Ask first.
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _confirmLeave();
          },
          child: DrawView(
            prompt: info?.prompt ?? '',
            unlocked: true,
            heading: 'TODAY',
            screenTitle: 'THE DAILY',
            onSubmit: _submit,
          ),
        );
      case _Stage.intro:
        return _Intro(info: info!, onDraw: _startDrawing, onHall: _openHall);
      case _Stage.gallery:
        return _Gallery(
          info: info!,
          entries: _entries,
          yesterday: _yesterday,
          hasMore: _hasMore,
          loadingMore: _loadingMore,
          myId: widget.myId,
          onLoadMore: _loadMore,
          onRefresh: _refresh,
          onDrawAgain: _startDrawing,
          onHeart: _heart,
          onHall: _openHall,
          reminderOn: DailyReminder.instance.enabled,
          onToggleReminder: _toggleReminder,
        );
    }
  }
}

/// "3h 12m", "under a minute", or "a new one any moment".
String _timeLeft(int endsAtMs) {
  final ms = endsAtMs - DateTime.now().millisecondsSinceEpoch;
  if (ms <= 0) return 'a new one any moment';
  final minutes = (ms / 60000).ceil();
  if (minutes < 1) return 'under a minute';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '${m}m';
  return '${h}h ${m.toString().padLeft(2, '0')}m';
}

String _crowd(int n) => switch (n) {
  0 => 'Nobody has drawn it yet — you could be first',
  1 => '1 person has drawn it so far',
  _ => '$n people have drawn it so far',
};

class _Holding extends StatelessWidget {
  const _Holding({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('THE DAILY')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: GameColors.primary),
            const SizedBox(height: 16),
            Text(label, style: const TextStyle(color: GameColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _PromptCard extends StatelessWidget {
  const _PromptCard({required this.info, this.big = true});

  final DailyInfoEvent info;
  final bool big;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 18, vertical: big ? 20 : 14),
      decoration: GameDecor.panel(accent: GameColors.cyan),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                "TODAY'S PROMPT",
                style: TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              const SketchIcon(
                SketchGlyph.clock,
                size: 13,
                color: GameColors.textMuted,
              ),
              const SizedBox(width: 5),
              Text(
                _timeLeft(info.endsAtMs),
                style: const TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          SizedBox(height: big ? 12 : 6),
          Text(
            info.prompt,
            style: TextStyle(
              fontSize: big ? 22 : 16,
              height: 1.25,
              fontWeight: FontWeight.w900,
              color: GameColors.textPrimary,
            ),
          ),
          SizedBox(height: big ? 12 : 6),
          Text(
            _crowd(info.submissions),
            style: const TextStyle(
              color: GameColors.cyan,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// The front page: the prompt, the terms, and one button.
class _Intro extends StatelessWidget {
  const _Intro({
    required this.info,
    required this.onDraw,
    required this.onHall,
  });

  final DailyInfoEvent info;
  final VoidCallback onDraw;
  final VoidCallback onHall;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('THE DAILY')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PopIn(child: _PromptCard(info: info)),
              const SizedBox(height: 18),
              PopIn(
                index: 1,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: const [
                    _Perk(label: 'NO TIMER'),
                    _Perk(label: 'EVERY COLOUR'),
                    _Perk(label: 'EVERY PAPER & PEN'),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              PopIn(
                index: 2,
                child: FilledButton(
                  onPressed: onDraw,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    textStyle: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                  child: const Text('DRAW IT'),
                ),
              ),
              const SizedBox(height: 14),
              PopIn(
                index: 3,
                child: Text(
                  'Take as long as you like. Once you send it in, you get to see '
                  "everyone else's — from all over the world, all drawing this — "
                  'and give a heart to the ones you love. No names and no counts '
                  'until midnight, so it is the drawing that gets judged. Then the '
                  'three most-hearted are revealed in the Hall of Fame and win '
                  '${dailyTrophies[0]} / ${dailyTrophies[1]} / ${dailyTrophies[2]} trophies.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              PopIn(
                index: 4,
                child: OutlinedButton.icon(
                  onPressed: onHall,
                  icon: const SketchIcon(
                    SketchGlyph.trophy,
                    size: 16,
                    color: GameColors.primary,
                  ),
                  label: const Text('HALL OF FAME'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Perk extends StatelessWidget {
  const _Perk({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: GameColors.lime.withValues(alpha: 0.7),
          width: 1.4,
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: GameColors.lime,
          fontSize: 10.5,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

/// The wall: your own drawing pinned at the top, then everyone else's,
/// newest first, as far down as you care to scroll.
class _Gallery extends StatefulWidget {
  const _Gallery({
    required this.info,
    required this.entries,
    required this.hasMore,
    required this.loadingMore,
    required this.myId,
    required this.onLoadMore,
    required this.onRefresh,
    required this.onDrawAgain,
    required this.reminderOn,
    required this.onToggleReminder,
    required this.yesterday,
    required this.onHeart,
    required this.onHall,
  });

  final DailyInfoEvent info;
  final List<DailyEntry> entries;
  final HallDay? yesterday;
  final bool hasMore;
  final bool loadingMore;
  final String myId;
  final VoidCallback onLoadMore;
  final Future<void> Function() onRefresh;
  final VoidCallback onDrawAgain;
  final bool reminderOn;
  final ValueChanged<bool> onToggleReminder;
  final ValueChanged<DailyEntry> onHeart;
  final VoidCallback onHall;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 400) widget.onLoadMore();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mine = widget.info.mine;
    final others = widget.entries
        .where((e) => e.artistId != widget.myId)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('THE DAILY'),
        actions: [
          IconButton(
            tooltip: 'Hall of Fame',
            onPressed: widget.onHall,
            icon: const SketchIcon(
              SketchGlyph.trophy,
              size: 20,
              color: GameColors.primary,
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: widget.onRefresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: GameColors.primary,
          onRefresh: widget.onRefresh,
          child: CustomScrollView(
            controller: _scroll,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _PromptCard(info: widget.info, big: false),
                    const SizedBox(height: 10),
                    _ReminderRow(
                      on: widget.reminderOn,
                      onChanged: widget.onToggleReminder,
                    ),
                    const SizedBox(height: 10),
                    if (mine != null)
                      _Mine(
                        entry: mine,
                        prompt: widget.info.prompt,
                        onDrawAgain: widget.onDrawAgain,
                      ),
                    if (widget.yesterday case final y?) ...[
                      const SizedBox(height: 18),
                      _Yesterday(day: y, myId: widget.myId),
                    ],
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        const Text(
                          'EVERYONE ELSE',
                          style: TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 10,
                            letterSpacing: 2,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${others.length}${widget.hasMore ? '+' : ''}',
                          style: const TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'No names, no counts until midnight. Just the drawings; '
                      'heart the ones you love.',
                      style: TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 11,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 10),
                  ]),
                ),
              ),
              if (others.isEmpty)
                const SliverToBoxAdapter(child: _EmptyWall())
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.72,
                        ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => PopIn(
                        index: i < 8 ? i : 8,
                        child: _Tile(
                          entry: others[i],
                          prompt: widget.info.prompt,
                          onHeart: () => widget.onHeart(others[i]),
                        ),
                      ),
                      childCount: others.length,
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
                  child: widget.loadingMore
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: GameColors.primary,
                          ),
                        )
                      : widget.hasMore
                      ? OutlinedButton(
                          onPressed: widget.onLoadMore,
                          child: const Text('SHOW MORE'),
                        )
                      : const SizedBox.shrink(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The one setting the Daily has: a morning nudge with the prompt in it.
class _ReminderRow extends StatelessWidget {
  const _ReminderRow({required this.on, required this.onChanged});

  final bool on;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
      decoration: GameDecor.panel(radius: 14),
      child: Row(
        children: [
          const SketchIcon(SketchGlyph.clock, size: 16, color: GameColors.lime),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              "Tomorrow's prompt at 9am",
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
          Switch(
            value: on,
            onChanged: onChanged,
            activeThumbColor: GameColors.lime,
          ),
        ],
      ),
    );
  }
}

class _Mine extends StatelessWidget {
  const _Mine({
    required this.entry,
    required this.prompt,
    required this.onDrawAgain,
  });

  final DailyEntry entry;
  final String prompt;
  final VoidCallback onDrawAgain;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => showHallDetail(context, entry, prompt, isMe: true),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 88,
                height: 88,
                child: StaticDrawing(
                  strokes: entry.strokes,
                  paper: entry.paper,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'YOURS',
                  style: TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 10,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  entry.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.favorite,
                      size: 13,
                      color: GameColors.pink,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      entry.hearts == 1 ? '1 heart' : '${entry.hearts} hearts',
                      style: const TextStyle(
                        color: GameColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // Drawing again replaces today's entry, so it is offered as a
                // second go rather than a second entry.
                TextButton(
                  onPressed: onDrawAgain,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Have another go →',
                    style: TextStyle(
                      color: GameColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.entry,
    required this.prompt,
    required this.onHeart,
  });

  final DailyEntry entry;
  final String prompt;
  final VoidCallback onHeart;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showHallDetail(context, entry, prompt, anonymous: true),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: GameDecor.panel(radius: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: double.infinity,
                  child: StaticDrawing(
                    strokes: entry.strokes,
                    paper: entry.paper,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              entry.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            // No artist line on purpose: while the day is open a drawing is
            // judged as a drawing. The name comes out with the results.
            Align(
              alignment: Alignment.centerRight,
              child: _HeartButton(given: entry.heartedByMe, onTap: onHeart),
            ),
          ],
        ),
      ),
    );
  }
}

/// The heart. Once given it stays lit and stops responding — there is no
/// taking it back, and the button should look like it. No count next to it:
/// nobody's tally shows until the day is over, so a heart is a judgement of
/// the drawing and not of the number beside it.
class _HeartButton extends StatelessWidget {
  const _HeartButton({required this.given, required this.onTap});

  final bool given;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: given ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 2, 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              scale: given ? 1.15 : 1,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              child: Icon(
                given ? Icons.favorite : Icons.favorite_border,
                size: 18,
                color: given ? GameColors.pink : GameColors.textMuted,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              given ? 'HEARTED' : 'HEART',
              style: TextStyle(
                color: given ? GameColors.pink : GameColors.textMuted,
                fontSize: 10,
                letterSpacing: 1,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Yesterday's result: the three most-hearted, revealed with names and
/// counts now that the day is over. This is what today's hearts are for.
class _Yesterday extends StatelessWidget {
  const _Yesterday({required this.day, required this.myId});

  final HallDay day;
  final String myId;

  @override
  Widget build(BuildContext context) {
    final top = day.top;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SketchIcon(
                SketchGlyph.medal,
                size: 14,
                color: GameColors.primary,
              ),
              const SizedBox(width: 6),
              const Text(
                "YESTERDAY'S WINNERS",
                style: TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                'Names revealed',
                style: TextStyle(
                  color: GameColors.primary.withValues(alpha: 0.85),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            day.prompt,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: GameColors.textMuted,
              fontSize: 12,
              height: 1.3,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(
                  child: i < top.length
                      ? HallTile(
                          entry: top[i],
                          prompt: day.prompt,
                          isMe: top[i].artistId == myId,
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

class _EmptyWall extends StatelessWidget {
  const _EmptyWall();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(36, 30, 36, 10),
      child: Column(
        children: [
          SketchIcon(SketchGlyph.sparkle, size: 40, color: GameColors.cyan),
          SizedBox(height: 14),
          Text(
            "You're the first one today",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 8),
          Text(
            'Everyone who draws this prompt shows up here. Pull down to check back.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: GameColors.textMuted,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
