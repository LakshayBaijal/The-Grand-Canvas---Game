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

/// The Daily: one prompt for the whole world, a drawing with no clock and
/// nothing locked, and then everyone else's take on the same idea.
///
/// Nobody votes and nothing is scored. The gallery is the reward, and it is
/// only open to people who drew — the server refuses it otherwise, and this
/// screen never even asks until it knows the player has submitted.
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
      if (info != null && DateTime.now().millisecondsSinceEpoch >= info.endsAtMs) {
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
          _hasMore = event.hasMore;
          _loadingMore = false;
        });
      case ErrorEvent():
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(event.message)));
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
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('NO THANKS')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('REMIND ME')),
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
            child: const Text('LEAVE', style: TextStyle(color: GameColors.pink)),
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
    AudioService.instance.play(_stage == _Stage.drawing ? Music.drawing : Music.presentation);
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
        return _Intro(info: info!, onDraw: _startDrawing);
      case _Stage.gallery:
        return _Gallery(
          info: info!,
          entries: _entries,
          hasMore: _hasMore,
          loadingMore: _loadingMore,
          myId: widget.myId,
          onLoadMore: _loadMore,
          onRefresh: _refresh,
          onDrawAgain: _startDrawing,
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
              const SketchIcon(SketchGlyph.clock, size: 13, color: GameColors.textMuted),
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
            style: const TextStyle(color: GameColors.cyan, fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

/// The front page: the prompt, the terms, and one button.
class _Intro extends StatelessWidget {
  const _Intro({required this.info, required this.onDraw});

  final DailyInfoEvent info;
  final VoidCallback onDraw;

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
                    textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: 1),
                  ),
                  child: const Text('DRAW IT'),
                ),
              ),
              const SizedBox(height: 14),
              const PopIn(
                index: 3,
                child: Text(
                  'Take as long as you like. Once you send it in, you get to see '
                  "everyone else's — from all over the world, all drawing this.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GameColors.textMuted, fontSize: 13, height: 1.45),
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
        border: Border.all(color: GameColors.lime.withValues(alpha: 0.7), width: 1.4),
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
  });

  final DailyInfoEvent info;
  final List<DailyEntry> entries;
  final bool hasMore;
  final bool loadingMore;
  final String myId;
  final VoidCallback onLoadMore;
  final Future<void> Function() onRefresh;
  final VoidCallback onDrawAgain;
  final bool reminderOn;
  final ValueChanged<bool> onToggleReminder;

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
    final others = widget.entries.where((e) => e.artistId != widget.myId).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('THE DAILY'),
        actions: [
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
                    _ReminderRow(on: widget.reminderOn, onChanged: widget.onToggleReminder),
                    const SizedBox(height: 10),
                    if (mine != null) _Mine(entry: mine, onDrawAgain: widget.onDrawAgain),
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
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.8,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => PopIn(
                        index: i < 8 ? i : 8,
                        child: _Tile(entry: others[i]),
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
                          child: CircularProgressIndicator(color: GameColors.primary),
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
          Switch(value: on, onChanged: onChanged, activeThumbColor: GameColors.lime),
        ],
      ),
    );
  }
}

class _Mine extends StatelessWidget {
  const _Mine({required this.entry, required this.onDrawAgain});

  final DailyEntry entry;
  final VoidCallback onDrawAgain;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => _showFull(context, entry, isMe: true),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 88,
                height: 88,
                child: StaticDrawing(strokes: entry.strokes, paper: entry.paper),
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
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
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
                    style: TextStyle(color: GameColors.primary, fontWeight: FontWeight.w700),
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
  const _Tile({required this.entry});

  final DailyEntry entry;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showFull(context, entry),
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
                  child: StaticDrawing(strokes: entry.strokes, paper: entry.paper),
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
            Text(
              entry.artistName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: GameColors.cyan, fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ],
        ),
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
            style: TextStyle(color: GameColors.textMuted, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }
}

/// The drawing at full size, with its title and who drew it.
void _showFull(BuildContext context, DailyEntry entry, {bool isMe = false}) {
  showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.8),
    builder: (context) => Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(18),
      child: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: AspectRatio(
                aspectRatio: 1,
                child: StaticDrawing(strokes: entry.strokes, paper: entry.paper),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              entry.title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(
              isMe ? 'by you' : 'by ${entry.artistName}',
              style: const TextStyle(color: GameColors.cyan, fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    ),
  );
}
