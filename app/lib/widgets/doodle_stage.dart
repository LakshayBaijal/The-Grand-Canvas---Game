import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../theme.dart';
import 'drawing_canvas.dart';
import 'live_doodle.dart';
import 'paper_frame.dart';

/// The "somebody is always drawing" panel shown on idle screens — the home
/// menu and the lobby.
///
/// It exists to make waiting feel like part of the game: a bot picks a random
/// problem and you watch it solve it, line by line, on a real-looking sheet of
/// paper. When a drawing finishes, its title appears and [onNext] asks the
/// caller for another one.
class DoodleStage extends StatefulWidget {
  const DoodleStage({
    super.key,
    required this.doodle,
    required this.onNext,
    this.maxCanvasSize = 320,
    this.compact = false,
  });

  /// The drawing currently being replayed; null until the first one arrives.
  final DoodleEvent? doodle;

  /// Called when the current drawing has finished and been read.
  final VoidCallback onNext;

  final double maxCanvasSize;

  /// Trims the padding and type sizes for the home screen, where this shares
  /// the page with the whole join flow.
  final bool compact;

  @override
  State<DoodleStage> createState() => _DoodleStageState();
}

class _DoodleStageState extends State<DoodleStage> {
  bool _showTitle = false;

  @override
  void didUpdateWidget(DoodleStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.doodle, widget.doodle)) _showTitle = false;
  }

  @override
  Widget build(BuildContext context) {
    final doodle = widget.doodle;
    final pad = widget.compact ? 12.0 : 16.0;

    final canvas = LayoutBuilder(
      builder: (context, constraints) {
        // Bot drawings are composed in a square, so keep it square — and never
        // bigger than the room actually left on screen. In the lobby that's a
        // real height; inside the home screen's scroll view it's unbounded,
        // which `maxCanvasSize` then caps.
        final side = [
          constraints.maxWidth,
          constraints.hasBoundedHeight ? constraints.maxHeight : double.infinity,
          widget.maxCanvasSize,
        ].reduce((a, b) => a < b ? a : b);
        return Align(
          // heightFactor pins this to the child's height, so it behaves the
          // same whether or not the parent bounded it.
          heightFactor: 1,
          child: SizedBox.square(
            dimension: side,
            child: DeskBackdrop(
              padding: widget.compact ? 13 : 16,
              child: PaperCanvas(
                seed: doodle?.title.hashCode ?? 0,
                child: doodle == null
                    ? const _WarmingUp()
                    : LiveDoodle(
                        // A new sheet of paper per drawing, so the replay
                        // always restarts from blank.
                        key: ValueKey(doodle),
                        strokes: doodle.strokes,
                        onCompleted: () => setState(() => _showTitle = true),
                        onFinished: widget.onNext,
                      ),
              ),
            ),
          ),
        );
      },
    );

    return Container(
      padding: EdgeInsets.all(pad),
      decoration: GameDecor.panel(radius: 22),
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(doodle: doodle, showTitle: _showTitle, compact: widget.compact),
            SizedBox(height: widget.compact ? 8 : 12),
            // Flex is only legal when the parent gave us a height to divide up.
            if (constraints.hasBoundedHeight) Flexible(child: canvas) else canvas,
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.doodle, required this.showTitle, required this.compact});

  final DoodleEvent? doodle;
  final bool showTitle;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final doodle = this.doodle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              showTitle ? Icons.check_circle_rounded : Icons.edit_rounded,
              size: 14,
              color: showTitle ? GameColors.lime : GameColors.primary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                doodle == null
                    ? 'WARMING UP THE PENS…'
                    : showTitle
                        ? '“${doodle.title}” BY ${doodle.artistName.toUpperCase()}'
                        : '${doodle.artistName.toUpperCase()} IS DRAWING…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: showTitle ? GameColors.lime : GameColors.primary,
                  fontSize: compact ? 10 : 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
            ),
          ],
        ),
        if (doodle != null) ...[
          const SizedBox(height: 6),
          Text(
            doodle.prompt,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: GameColors.textMuted,
              fontSize: compact ? 12 : 13,
              height: 1.3,
            ),
          ),
        ],
      ],
    );
  }
}

class _WarmingUp extends StatelessWidget {
  const _WarmingUp();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: paperColor,
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFBFAE86)),
        ),
      ),
    );
  }
}
