import 'dart:math';

import 'package:flutter/material.dart';

import '../theme.dart';
import '../services/audio_service.dart';
import 'sketch_icons.dart';

/// Motion used to make results feel like a payoff rather than a table of
/// numbers.
///
/// All of it is drawn procedurally rather than shipped as image or GIF assets:
/// a few KB of code instead of megabytes of frames, sharp on any screen
/// density, and it picks up the game's own palette instead of fighting it.

// --- confetti ---------------------------------------------------------------

class _Particle {
  _Particle(Random rnd, this.color)
      : x = rnd.nextDouble(),
        y = -rnd.nextDouble() * 0.4,
        vx = (rnd.nextDouble() - 0.5) * 0.28,
        vy = 0.25 + rnd.nextDouble() * 0.35,
        size = 0.012 + rnd.nextDouble() * 0.016,
        spin = (rnd.nextDouble() - 0.5) * 9,
        phase = rnd.nextDouble() * pi * 2,
        square = rnd.nextBool();

  final double x, y, vx, vy, size, spin, phase;
  final bool square;
  final Color color;
}

/// A one-shot burst of falling confetti. Sits on top of its [child] and never
/// intercepts touches, so the screen underneath stays usable throughout.
class Confetti extends StatefulWidget {
  const Confetti({
    super.key,
    required this.child,
    this.play = true,
    this.pieces = 70,
  });

  final Widget child;

  /// Set false to render the child with no burst — used so a losing result
  /// doesn't get a celebration.
  final bool play;
  final int pieces;

  @override
  State<Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<Confetti> with SingleTickerProviderStateMixin {
  static const _palette = [
    GameColors.primary,
    GameColors.lime,
    GameColors.pink,
    Color(0xFF4FC3F7),
    Color(0xFFBA68C8),
  ];

  // Built eagerly in initState rather than lazily: a `late final` controller
  // that nothing touches gets created by dispose() instead, and building a
  // ticker while unmounting throws.
  AnimationController? _controller;
  late final List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    if (!widget.play) return;
    final rnd = Random(7);
    _particles = [
      for (var i = 0; i < widget.pieces; i++) _Particle(rnd, _palette[i % _palette.length]),
    ];
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return widget.child;
    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(painter: _ConfettiPainter(_particles, controller)),
          ),
        ),
      ],
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.particles, this.progress) : super(repaint: progress);

  final List<_Particle> particles;
  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    final t = progress.value;
    if (t == 0 || t == 1) return;
    // Fade the last third so the burst clears instead of vanishing mid-air.
    final fade = t < 0.7 ? 1.0 : 1 - (t - 0.7) / 0.3;

    for (final p in particles) {
      final y = p.y + p.vy * t * 2.2;
      if (y > 1.1) continue;
      // Drift sideways in a slow sway, the way paper actually falls.
      final x = p.x + p.vx * t + sin(t * 4 + p.phase) * 0.03;
      final center = Offset(x * size.width, y * size.height);
      final side = p.size * size.width;

      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(p.spin * t + p.phase);
      final paint = Paint()..color = p.color.withValues(alpha: fade);
      if (p.square) {
        canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: side, height: side * 0.6), paint);
      } else {
        canvas.drawCircle(Offset.zero, side * 0.45, paint);
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => false;
}

// --- numbers ----------------------------------------------------------------

/// A number that counts up to [value] instead of just appearing. Scores and
/// trophies land much better when you watch them climb.
class CountUp extends StatelessWidget {
  const CountUp({
    super.key,
    required this.value,
    this.style,
    this.prefix = '',
    this.suffix = '',
    this.duration = const Duration(milliseconds: 900),
  });

  final int value;
  final TextStyle? style;
  final String prefix;
  final String suffix;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text('$prefix${v.round()}$suffix', style: style),
    );
  }
}

// --- entrances --------------------------------------------------------------

/// Fades and slides [child] in, offset by [index] so a list arrives as a
/// cascade rather than all at once.
class PopIn extends StatefulWidget {
  const PopIn({
    super.key,
    required this.child,
    this.index = 0,
    this.stagger = const Duration(milliseconds: 90),
  });

  final Widget child;
  final int index;
  final Duration stagger;

  @override
  State<PopIn> createState() => _PopInState();
}

class _PopInState extends State<PopIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    Future.delayed(widget.stagger * widget.index, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curve = CurvedAnimation(parent: _controller, curve: Curves.easeOutBack);
    return FadeTransition(
      opacity: _controller,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.18), end: Offset.zero).animate(curve),
        child: widget.child,
      ),
    );
  }
}

/// A slow breathing pulse — used on "we're waiting on something" indicators so
/// a stalled-looking screen still reads as alive.
class Pulse extends StatefulWidget {
  const Pulse({super.key, required this.child, this.active = true});

  final Widget child;
  final bool active;

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return widget.child;
    return ScaleTransition(
      scale: Tween(begin: 0.94, end: 1.06).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      ),
      child: widget.child,
    );
  }
}

/// The winner's trophy, landing with a bounce.
class TrophyDrop extends StatefulWidget {
  const TrophyDrop({super.key, this.size = 56});

  final double size;

  @override
  State<TrophyDrop> createState() => _TrophyDropState();
}

class _TrophyDropState extends State<TrophyDrop> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    AudioService.instance.sfx(Sfx.trophy);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
      child: SketchIcon(SketchGlyph.trophy, size: widget.size, color: GameColors.primary),
    );
  }
}
