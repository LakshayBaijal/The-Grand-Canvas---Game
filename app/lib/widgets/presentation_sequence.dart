import 'dart:async';

import 'package:flutter/material.dart';

import '../models/round_models.dart';
import '../theme.dart';
import 'drawing_canvas.dart';
import 'paper_frame.dart';

/// Shows each drawing one at a time — image first, then its title fades in up
/// top — before handing off to whatever comes next. Used by both voting modes,
/// so everyone sees the entries the same way regardless of how they'll be
/// scored.
class PresentationSequence extends StatefulWidget {
  const PresentationSequence({super.key, required this.entries, required this.onComplete});

  final List<DrawingEntry> entries;
  final VoidCallback onComplete;

  @override
  State<PresentationSequence> createState() => _PresentationSequenceState();
}

class _PresentationSequenceState extends State<PresentationSequence> {
  // Keep the sum in step with PRESENT_SECONDS_PER_ENTRY on the server.
  static const _imageOnlyDelay = Duration(milliseconds: 1500);
  static const _titleHoldDelay = Duration(milliseconds: 2000);

  int _index = 0;
  bool _showTitle = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _showImage();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _showImage() {
    _showTitle = false;
    _timer = Timer(_imageOnlyDelay, () {
      if (!mounted) return;
      setState(() => _showTitle = true);
      _timer = Timer(_titleHoldDelay, _advance);
    });
  }

  void _advance() {
    if (!mounted) return;
    if (_index >= widget.entries.length - 1) {
      widget.onComplete();
      return;
    }
    setState(() => _index += 1);
    _showImage();
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entries[_index];

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${_index + 1} / ${widget.entries.length}',
                style: const TextStyle(color: GameColors.textMuted, letterSpacing: 2, fontSize: 12),
              ),
              const SizedBox(height: 18),
              SizedBox(
                height: 78,
                child: AnimatedOpacity(
                  opacity: _showTitle ? 1 : 0,
                  duration: const Duration(milliseconds: 450),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        entry.title,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: GameColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'by ${entry.artistName}',
                        style: const TextStyle(color: GameColors.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                child: AspectRatio(
                  key: ValueKey(entry.artistId),
                  aspectRatio: 1,
                  child: PaperCanvas(
                    seed: entry.artistId.hashCode,
                    child: StaticDrawing(strokes: entry.strokes, paper: entry.paper),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
