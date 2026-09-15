import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// The prompt, alive.
///
/// A sentence in a muted box above a canvas gets skipped: people start
/// drawing and only later wonder what the prompt was. So this one moves. A
/// slow wave runs along the letters -- each one breathes between medium and
/// black weight and lifts a little as the wave passes -- and the words the
/// writer typed into the blank, which are the thing to actually draw, are
/// picked out in a second colour and ride a stronger wave.
///
/// Each letter sits in a box as wide as its heaviest weight, so the line
/// never reflows as weights change; wrapping happens at word boundaries.
class LivelyPrompt extends StatefulWidget {
  const LivelyPrompt({
    super.key,
    required this.text,
    this.answer = '',
    this.fontSize = 16,
    this.color = GameColors.primary,
    this.accent = GameColors.pink,
    this.textAlign = WrapAlignment.center,
  });

  final String text;

  /// The filled-in blank, as typed. Its words are highlighted wherever
  /// they appear in [text]; empty means no highlight.
  final String answer;
  final double fontSize;
  final Color color;
  final Color accent;
  final WrapAlignment textAlign;

  @override
  State<LivelyPrompt> createState() => _LivelyPromptState();
}

class _LivelyPromptState extends State<LivelyPrompt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _wave = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..repeat();

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

  /// Roboto ships medium, bold and black faces; stepping through them is
  /// what makes the letters visibly thicken rather than just scale.
  static FontWeight _weightAt(double t) {
    if (t > 0.72) return FontWeight.w900;
    if (t > 0.4) return FontWeight.w800;
    if (t > 0.15) return FontWeight.w700;
    return FontWeight.w600;
  }

  @override
  Widget build(BuildContext context) {
    final words = widget.text.split(' ').where((w) => w.isNotEmpty).toList();
    // Which words are the answer: the run of words in the sentence matching
    // the answer's words in order, so an answer of "the cat" lights that
    // "the", not every "the" in the sentence.
    final lit = _litWords(words, widget.answer);

    var letterIndex = 0;
    final total = widget.text.length.clamp(1, 1 << 20);
    return Wrap(
      alignment: widget.textAlign,
      runSpacing: 2,
      children: [
        for (var w = 0; w < words.length; w++)
          Padding(
            padding: EdgeInsets.only(right: w == words.length - 1 ? 0 : widget.fontSize * 0.3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final ch in words[w].characters)
                  _Letter(
                    ch,
                    wave: _wave,
                    // Phase by position in the whole sentence so the wave
                    // travels along the line, not restarting per word.
                    phase: (letterIndex++ / total),
                    lit: lit.contains(w),
                    fontSize: widget.fontSize,
                    color: widget.color,
                    accent: widget.accent,
                    weightAt: _weightAt,
                  ),
              ],
            ),
          ),
      ],
    );
  }

  static String _bare(String w) => w.replaceAll(RegExp(r'[^a-z0-9]'), '');

  /// Indices of the words that are the answer: the first place the answer's
  /// words occur consecutively in the sentence. Empty if the answer is empty
  /// or doesn't appear (a timed-out blank, or an older server).
  static Set<int> _litWords(List<String> words, String answer) {
    final target = answer.toLowerCase().split(RegExp(r'\s+')).map(_bare).where((w) => w.isNotEmpty).toList();
    if (target.isEmpty) return const {};
    final bare = words.map((w) => _bare(w.toLowerCase())).toList();
    for (var i = 0; i + target.length <= bare.length; i++) {
      var ok = true;
      for (var j = 0; j < target.length; j++) {
        if (bare[i + j] != target[j]) { ok = false; break; }
      }
      if (ok) return {for (var j = 0; j < target.length; j++) i + j};
    }
    return const {};
  }
}

class _Letter extends StatelessWidget {
  const _Letter(
    this.ch, {
    required this.wave,
    required this.phase,
    required this.lit,
    required this.fontSize,
    required this.color,
    required this.accent,
    required this.weightAt,
  });

  final String ch;
  final Animation<double> wave;
  final double phase;
  final bool lit;
  final double fontSize;
  final Color color;
  final Color accent;
  final FontWeight Function(double) weightAt;

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(fontSize: fontSize, fontWeight: FontWeight.w900, height: 1.2);
    // Widest this glyph will ever be, so the line holds still.
    final painter = TextPainter(
      text: TextSpan(text: ch, style: base),
      textDirection: TextDirection.ltr,
    )..layout();
    final width = painter.width;
    final height = painter.height;

    return AnimatedBuilder(
      animation: wave,
      builder: (context, _) {
        // One crest travelling left to right, with a long calm tail.
        final t = (wave.value - phase) % 1.0;
        final crest = math.max(0.0, math.sin(t * math.pi * 2)); // 0..1
        final strength = lit ? 1.0 : 0.7;
        final lift = -crest * fontSize * (lit ? 0.18 : 0.1);
        final c = lit
            ? Color.lerp(accent, Colors.white, crest * 0.35)!
            : Color.lerp(color, Colors.white, crest * 0.25)!;
        return SizedBox(
          width: width,
          height: height,
          child: Transform.translate(
            offset: Offset(0, lift),
            child: Center(
              child: Text(
                ch,
                style: base.copyWith(
                  fontWeight: weightAt(lit ? math.max(0.45, crest) : crest * strength),
                  color: c,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
