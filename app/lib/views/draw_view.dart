import 'package:flutter/material.dart';

import '../models/stroke.dart';
import '../models/styles.dart';
import '../services/entitlements.dart';
import '../theme.dart';
import '../widgets/countdown.dart';
import '../widgets/drawing_canvas.dart';
import '../widgets/paper_frame.dart';
import '../widgets/customize_sheet.dart';
import '../widgets/unlock_sheet.dart';

/// Server allows 75s; keep in sync with DRAW_SECONDS on the server.
const _drawSeconds = 75;

class DrawView extends StatefulWidget {
  const DrawView({
    super.key,
    required this.prompt,
    required this.deadlineMs,
    required this.roundIndex,
    required this.totalRounds,
    required this.submitted,
    required this.total,
    required this.onSubmit,
  });

  final String prompt;
  final int deadlineMs;
  final int roundIndex;
  final int totalRounds;
  final int submitted;
  final int total;
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

  List<Stroke>? _pendingStrokes;
  bool _naming = false;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
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
    Entitlements.instance.removeListener(_applyStyles);
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
    return Scaffold(
      appBar: AppBar(
        title: Text('ROUND ${widget.roundIndex + 1}/${widget.totalRounds}'),
        actions: [
          // Both offers live in the corner, small and out of the way. Stacking
          // them vertically would need a taller bar (which costs canvas
          // height), and floating them over the paper would steal touches
          // from whoever draws there — so they sit side by side instead.
          if (!_submitted && !_naming)
            ListenableBuilder(
              listenable: Entitlements.instance,
              builder: (context, _) => Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!Entitlements.instance.hasFullPalette)
                    _CornerAction(
                      icon: Icons.palette_rounded,
                      tooltip: 'Unlock all colours',
                      color: GameColors.primary,
                      onTap: () => showUnlockSheet(context),
                    ),
                  _CornerAction(
                    icon: Icons.auto_awesome_rounded,
                    tooltip: 'Paper & pens',
                    color: Entitlements.instance.hasStyles
                        ? GameColors.cyan
                        : GameColors.textMuted,
                    onTap: () => showCustomizeSheet(context),
                  ),
                ],
              ),
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
                        const Text(
                          'RESEARCH',
                          style: TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 10,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.prompt,
                          textAlign: TextAlign.center,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: GameColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (!_submitted)
                    CountdownBar(
                      deadlineMs: widget.deadlineMs,
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
                        label: 'Nice invention! Waiting for the others…',
                        submitted: widget.submitted,
                        total: widget.total,
                      ),
                    )
                  else if (!_naming) ...[
                    _DrawToolbar(controller: _controller),
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
                onCancel: _keepDrawing,
                onSubmit: _confirmSubmit,
              ),
          ],
        ),
      ),
    );
  }
}

/// A compact "name your invention" card over a dimmed scrim, showing a small
/// preview of the finished drawing instead of the full-size canvas.
class _TitlePopup extends StatefulWidget {
  const _TitlePopup({
    required this.strokes,
    required this.paper,
    required this.controller,
    required this.onCancel,
    required this.onSubmit,
  });

  final List<Stroke> strokes;
  final PaperStyle paper;
  final TextEditingController controller;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  State<_TitlePopup> createState() => _TitlePopupState();
}

class _TitlePopupState extends State<_TitlePopup> {
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
                const Text(
                  'NAME YOUR INVENTION',
                  textAlign: TextAlign.center,
                  style: TextStyle(
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
                  autofocus: true,
                  maxLength: 40,
                  textCapitalization: TextCapitalization.words,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) {
                    if (canSubmit) widget.onSubmit();
                  },
                  decoration: const InputDecoration(
                    hintText: 'e.g. The Boredom Blaster 3000',
                  ),
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
  const _DrawToolbar({required this.controller});

  final DrawingController controller;

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
                final color = _palette[index - 1];
                final locked =
                    !_freeColors.contains(color) &&
                    !Entitlements.instance.hasFullPalette;
                final selected =
                    !controller.isErasing && controller.color == color;
                return GestureDetector(
                  // A locked swatch opens the offer rather than doing nothing,
                  // so the lock explains itself the moment you touch it.
                  onTap: locked
                      ? () => showUnlockSheet(context)
                      : () => controller.color = color,
                  child: Opacity(
                    opacity: locked ? 0.4 : 1,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: selected
                              ? GameColors.primary
                              : GameColors.surfaceHigh,
                          width: selected ? 4 : 2,
                        ),
                      ),
                      child: locked
                          ? const Icon(
                              Icons.lock_rounded,
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
                icon: const Icon(Icons.undo_rounded),
                color: GameColors.textPrimary,
                tooltip: 'Undo',
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Made deliberately bold and placed first in the color row — the whole
/// point is that players spot it immediately instead of hunting for it.
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
        child: const Icon(
          Icons.backspace_rounded,
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

  final IconData icon;
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
          child: Icon(icon, size: 17, color: color),
        ),
      ),
    );
  }
}
