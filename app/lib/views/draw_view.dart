import 'package:flutter/material.dart';

import '../models/stroke.dart';
import '../models/styles.dart';
import '../services/entitlements.dart';
import '../theme.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/color_studio.dart';
import '../widgets/countdown.dart';
import '../widgets/grand_pass_mark.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/lively_prompt.dart';
import '../widgets/paper_frame.dart';
import '../widgets/summon_keyboard.dart';
import '../widgets/customize_sheet.dart';
import '../widgets/unlock_sheet.dart';

/// Server allows 75s; keep in sync with DRAW_SECONDS on the server.
const _drawSeconds = 75;

/// The drawing screen, in two moods.
///
/// In a round it has a clock, a round counter, and the palette the player has
/// actually unlocked. In the daily ([unlocked]) there is no clock, no counter,
/// and every colour, paper and pen is open — the daily is the one part of the
/// game nobody is competing in, so there is nothing for a locked colour to
/// protect.
class DrawView extends StatefulWidget {
  const DrawView({
    super.key,
    required this.prompt,
    this.answer = '',
    required this.onSubmit,
    this.deadlineMs,
    this.roundIndex,
    this.totalRounds,
    this.submitted,
    this.total,
    this.unlocked = false,
    this.heading = 'RESEARCH',
    this.screenTitle,
  });

  final String prompt;

  /// The filled-in blank, lit up inside the prompt. Empty when unknown.
  final String answer;

  /// No deadline means no clock: the drawing is done when the player says so.
  final int? deadlineMs;
  final int? roundIndex;
  final int? totalRounds;
  final int? submitted;
  final int? total;

  /// Everything available, nothing saved: styles chosen here live for this
  /// drawing only and never touch the player's purchases.
  final bool unlocked;

  /// The small label over the prompt.
  final String heading;

  /// App bar text. Defaults to the round counter when there is one.
  final String? screenTitle;
  final void Function(List<Stroke> strokes, String title, PaperStyle paper)
  onSubmit;

  @override
  State<DrawView> createState() => _DrawViewState();
}

class _DrawViewState extends State<DrawView> {
  final _controller = DrawingController();
  late final VoidCallback _applyStyles;
  final _titleController = TextEditingController();
  final _canvasKey = GlobalKey();

  /// Where paper and pen come from in the unlocked mode. Null in a round,
  /// where the player's own saved styles apply.
  StyleSelection? _selection;

  List<Stroke>? _pendingStrokes;
  bool _naming = false;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    if (widget.unlocked) {
      final selection = StyleSelection();
      _selection = selection;
      _applyStyles = () {
        _controller.paper = selection.paper;
        _controller.pen = selection.pen;
      };
      _applyStyles();
      selection.addListener(_applyStyles);
      return;
    }
    // Follow the player's chosen styles, including changes made from the
    // customise sheet part-way through a drawing.
    _applyStyles = () {
      _controller.paper = Entitlements.instance.paper;
      _controller.pen = Entitlements.instance.pen;
    };
    _applyStyles();
    Entitlements.instance.addListener(_applyStyles);
  }

  @override
  void dispose() {
    final selection = _selection;
    if (selection != null) {
      selection.removeListener(_applyStyles);
      selection.dispose();
    } else {
      Entitlements.instance.removeListener(_applyStyles);
    }
    _controller.dispose();
    _titleController.dispose();
    super.dispose();
  }

  List<Stroke> _captureStrokes() {
    final box = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
    return _controller.toNormalizedStrokes(box?.size ?? const Size(1, 1));
  }

  void _finishDrawing() {
    if (_naming || _submitted) return;
    setState(() {
      _pendingStrokes = _captureStrokes();
      _naming = true;
    });
  }

  void _keepDrawing() {
    if (_submitted) return;
    setState(() => _naming = false);
  }

  void _confirmSubmit() {
    if (_submitted) return;
    final strokes = _pendingStrokes ?? _captureStrokes();
    widget.onSubmit(strokes, _titleController.text.trim(), _controller.paper);
    setState(() => _submitted = true);
  }

  /// Timeout fallback: submit no matter which step the player is on. Pure
  /// state flags (no dialogs/routes involved), so this can't get stuck
  /// behind an open popup.
  void _forceSubmit() {
    if (_submitted) return;
    final strokes = _pendingStrokes ?? _captureStrokes();
    widget.onSubmit(strokes, _titleController.text.trim(), _controller.paper);
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    final selection = _selection;
    final roundIndex = widget.roundIndex;
    final totalRounds = widget.totalRounds;
    final screenTitle = widget.screenTitle ??
        (roundIndex != null && totalRounds != null
            ? 'ROUND ${roundIndex + 1}/$totalRounds'
            : 'DRAW');

    return Scaffold(
      appBar: AppBar(
        title: Text(screenTitle),
        actions: [
          // One offer, not two. Colours and styles are sold together anyway, so
          // two separate chips asked the same question twice and neither read
          // as "this unlocks everything". While anything is still locked this
          // is a single labelled pill; once it's all owned it collapses back to
          // a plain icon for *choosing* paper and pens, because there's nothing
          // left to sell and it should stop asking.
          if (!_submitted && !_naming && selection != null)
            _CornerAction(
              icon: SketchGlyph.sparkle,
              tooltip: 'Paper & pens',
              color: GameColors.cyan,
              onTap: () => showCustomizeSheet(context, selection: selection),
            )
          else if (!_submitted && !_naming)
            ListenableBuilder(
              listenable: Entitlements.instance,
              builder: (context, _) {
                final owned = Entitlements.instance.hasFullPalette &&
                    Entitlements.instance.hasStyles;
                if (owned) {
                  return _CornerAction(
                    icon: SketchGlyph.sparkle,
                    tooltip: 'Paper & pens',
                    color: GameColors.cyan,
                    onTap: () => showCustomizeSheet(context),
                  );
                }
                return _UnlockAllButton(onTap: () => showUnlockSheet(context));
              },
            ),
          if (!_submitted && !_naming)
            Padding(
              padding: const EdgeInsets.only(left: 4, right: 12),
              child: FilledButton(
                onPressed: _finishDrawing,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  minimumSize: Size.zero,
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text(
                  'DONE',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: GameColors.surface,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        Text(
                          widget.heading,
                          style: const TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 10,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        LivelyPrompt(
                          text: widget.prompt,
                          answer: widget.answer,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (!_submitted && widget.deadlineMs != null)
                    CountdownBar(
                      deadlineMs: widget.deadlineMs!,
                      totalSeconds: _drawSeconds,
                      onExpired: _forceSubmit,
                    ),
                  const SizedBox(height: 6),
                  Expanded(
                    child: Center(
                      child: DeskBackdrop(
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: PaperCanvas(
                            seed: widget.prompt.hashCode,
                            child: AbsorbPointer(
                              key: _canvasKey,
                              absorbing: _naming || _submitted,
                              child: DrawingCanvas(controller: _controller),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (_submitted)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 22),
                      child: WaitingIndicator(
                        label: widget.total == null
                            ? 'Sent!'
                            : 'Homework done! Waiting for the others…',
                        submitted: widget.submitted,
                        total: widget.total,
                      ),
                    )
                  else if (!_naming) ...[
                    _DrawToolbar(controller: _controller, unlocked: widget.unlocked),
                    const SizedBox(height: 8),
                  ] else
                    const SizedBox(height: 8),
                ],
              ),
            ),
            if (_naming && !_submitted)
              _TitlePopup(
                strokes: _pendingStrokes!,
                paper: _controller.paper,
                controller: _titleController,
                heading: widget.unlocked ? 'NAME YOUR DRAWING' : 'NAME YOUR HOMEWORK',
                hint: widget.unlocked ? 'e.g. Tuesday, Mostly' : 'e.g. The Boredom Blaster 3000',
                onCancel: _keepDrawing,
                onSubmit: _confirmSubmit,
              ),
          ],
        ),
      ),
    );
  }
}

/// A compact "name your homework" card over a dimmed scrim, showing a small
/// preview of the finished drawing instead of the full-size canvas.
class _TitlePopup extends StatefulWidget {
  const _TitlePopup({
    required this.strokes,
    required this.paper,
    required this.controller,
    required this.heading,
    required this.hint,
    required this.onCancel,
    required this.onSubmit,
  });

  final List<Stroke> strokes;
  final PaperStyle paper;
  final TextEditingController controller;
  final String heading;
  final String hint;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  State<_TitlePopup> createState() => _TitlePopupState();
}

class _TitlePopupState extends State<_TitlePopup> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    summonKeyboard(_focus);
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = widget.controller.text.trim().isNotEmpty;

    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.65),
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: GameColors.surfaceHigh,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: GameColors.primary, width: 2),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.heading,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 11,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 14),
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: SizedBox(
                      width: 120,
                      height: 120,
                      child: StaticDrawing(
                        strokes: widget.strokes,
                        paper: widget.paper,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  maxLength: 40,
                  textCapitalization: TextCapitalization.words,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) {
                    if (canSubmit) widget.onSubmit();
                  },
                  decoration: InputDecoration(hintText: widget.hint),
                ),
                const SizedBox(height: 4),
                FilledButton(
                  onPressed: canSubmit ? widget.onSubmit : null,
                  child: const Text('SUBMIT'),
                ),
                const SizedBox(height: 6),
                TextButton(
                  onPressed: widget.onCancel,
                  child: const Text(
                    '← Keep drawing',
                    style: TextStyle(color: GameColors.textMuted),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawToolbar extends StatelessWidget {
  const _DrawToolbar({required this.controller, this.unlocked = false});

  final DrawingController controller;

  /// Every colour open, whatever the player owns. The daily only.
  final bool unlocked;

  /// Black and yellow are always free — between them and the eraser you can
  /// draw anything the game asks for, so the lock never costs anyone points.
  static const _freeColors = [Colors.black, Color(0xFFFDD835)];

  static const _palette = [
    Colors.black,
    Color(0xFFFDD835),
    Color(0xFFE53935),
    Color(0xFFFB8C00),
    Color(0xFF43A047),
    Color(0xFF1E88E5),
    Color(0xFF8E24AA),
    Color(0xFF6D4C41),
    Colors.white,
  ];

  static const _minWidth = 2.0;
  static const _maxWidth = 18.0;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([controller, Entitlements.instance]),
      builder: (context, _) => Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _palette.length + 1,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _EraserChip(controller: controller);
                }
                final slot = index - 1;
                final stock = _palette[slot];
                final e = Entitlements.instance;
                final color = e.paletteColour(slot, stock);
                final mine = e.paletteIsCustom(slot);
                final locked = !unlocked &&
                    !_freeColors.contains(stock) &&
                    !e.hasFullPalette;
                final canEdit = unlocked || e.hasStyles || paletteEditingOpenForTesting;
                final selected =
                    !controller.isErasing && controller.color == color;
                return GestureDetector(
                  // A locked swatch opens the offer rather than doing nothing,
                  // so the lock explains itself the moment you touch it.
                  onTap: locked
                      ? () => showUnlockSheet(context)
                      : () => controller.color = color,
                  // Hold a swatch and it becomes yours: the picker opens over
                  // the canvas, and whatever is saved is this slot's colour
                  // from now on. Without the pass, the hold shows the offer.
                  onLongPress: () async {
                    if (!canEdit) {
                      showUnlockSheet(context);
                      return;
                    }
                    final picked = await showColorStudio(context, initial: color, resetTo: stock);
                    if (picked == null) return;
                    await e.setPaletteColour(slot, picked, stock: stock);
                    if (selected || controller.color == color) controller.color = picked;
                  },
                  child: Opacity(
                    opacity: locked ? 0.4 : 1,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        // Gold ring: this one is yours, not the stock colour.
                        border: Border.all(
                          color: selected
                              ? GameColors.primary
                              : mine
                                  ? const Color(0xFFFFC53D)
                                  : GameColors.surfaceHigh,
                          width: selected ? 4 : mine ? 2.5 : 2,
                        ),
                      ),
                      child: locked
                          ? const SketchIcon(
                              SketchGlyph.lock,
                              size: 15,
                              color: Colors.white,
                            )
                          : null,
                    ),
                  ),
                );
              },
            ),
          ),
          Row(
            children: [
              _SteadyChip(
                controller: controller,
                owned: unlocked || Entitlements.instance.hasSteadyHand,
              ),
              const Icon(
                Icons.brush_rounded,
                size: 16,
                color: GameColors.textMuted,
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 3,
                    activeTrackColor: GameColors.primary,
                    inactiveTrackColor: GameColors.surfaceHigh,
                    thumbColor: GameColors.primary,
                    overlayShape: SliderComponentShape.noOverlay,
                    thumbShape: RoundSliderThumbShape(
                      enabledThumbRadius: (4 + controller.brushWidth / 2.6)
                          .clamp(6, 14),
                    ),
                  ),
                  // Dragging always switches to drawing mode with this width,
                  // same as tapping a size used to — matches how picking a
                  // color also exits eraser mode.
                  child: Slider(
                    value: controller.brushWidth.clamp(_minWidth, _maxWidth),
                    min: _minWidth,
                    max: _maxWidth,
                    onChanged: (v) => controller.brushWidth = v,
                  ),
                ),
              ),
              IconButton(
                onPressed: controller.canUndo ? controller.undo : null,
                icon: const SketchIcon(SketchGlyph.undo, size: 20, color: GameColors.textPrimary),
                color: GameColors.textPrimary,
                tooltip: 'Undo',
                visualDensity: VisualDensity.compact,
              ),
              IconButton(
                onPressed: controller.canRedo ? controller.redo : null,
                icon: Transform.flip(
                  flipX: true,
                  child: const SketchIcon(SketchGlyph.undo, size: 20, color: GameColors.textPrimary),
                ),
                color: GameColors.textPrimary,
                tooltip: 'Redo',
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// While making swatches your own is being tried out it is open to
/// everyone. Flip this to false to put it behind the Grand Pass.
const paletteEditingOpenForTesting = true;

/// The one drawing aid: Steady Hand.
///
/// On, a stroke that is held still for a beat snaps to the shape it was
/// trying to be. Unlocked the same way as the colours -- the pass, or a
/// watched video for the day -- and a locked chip opens that offer.
class _SteadyChip extends StatelessWidget {
  const _SteadyChip({required this.controller, required this.owned});

  final DrawingController controller;
  final bool owned;

  @override
  Widget build(BuildContext context) {
    final on = owned && controller.steadyHand;
    final fg = on ? const Color(0xFF241800) : GameColors.textPrimary;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: on ? GameColors.pink : GameColors.surfaceHigh,
        borderRadius: BorderRadius.circular(17),
        child: InkWell(
          borderRadius: BorderRadius.circular(17),
          onTap: owned
              ? () => controller.steadyHand = !controller.steadyHand
              : () => showUnlockSheet(context),
          child: Opacity(
            opacity: owned ? 1 : 0.6,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.auto_fix_high_rounded, size: 16, color: fg),
                  const SizedBox(width: 4),
                  Text(
                    'STEADY',
                    style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.8),
                  ),
                  if (!owned) ...[
                    const SizedBox(width: 3),
                    SketchIcon(SketchGlyph.lock, size: 11, color: fg),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Made deliberately bold and placed first in the color row — the whole
/// point is that players spot it immediately instead of hunting for it.
/// The single "buy everything" entry point, in the top-right of the drawing
/// screen. Labelled rather than a bare icon: a lone palette glyph reads as a
/// colour picker, which is exactly the wrong expectation for a paid offer.
class _UnlockAllButton extends StatelessWidget {
  const _UnlockAllButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [GameColors.primaryBright, GameColors.primaryDeep],
              ),
              border: Border.all(color: GameColors.primaryBright, width: 1.2),
              boxShadow: GameDecor.glow(GameColors.primary, strength: 0.7),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GrandPassMark(size: 17),
                SizedBox(width: 6),
                Text(
                  'UNLOCK ALL',
                  style: TextStyle(
                    color: Color(0xFF241800),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EraserChip extends StatelessWidget {
  const _EraserChip({required this.controller});

  final DrawingController controller;

  @override
  Widget build(BuildContext context) {
    final selected = controller.isErasing;
    return GestureDetector(
      onTap: controller.selectEraser,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(
            color: selected ? GameColors.primary : GameColors.pink,
            width: selected ? 4 : 2.5,
          ),
          boxShadow: [
            BoxShadow(
              color: (selected ? GameColors.primary : GameColors.pink)
                  .withValues(alpha: 0.4),
              blurRadius: selected ? 10 : 4,
            ),
          ],
        ),
        child: const SketchIcon(
          SketchGlyph.eraser,
          size: 20,
          color: Color(0xFF241800),
        ),
      ),
    );
  }
}

/// A quiet corner control: present enough to find, small enough to ignore.
class _CornerAction extends StatelessWidget {
  const _CornerAction({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });

  final SketchGlyph icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: GameColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: color.withValues(alpha: 0.55),
              width: 1.2,
            ),
          ),
          child: SketchIcon(icon, size: 17, color: color),
        ),
      ),
    );
  }
}
