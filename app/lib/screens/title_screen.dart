import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/logo.dart';

/// The first thing you see.
///
/// It fills time the app already spends — loading the saved account, hunting
/// for a server on the Wi-Fi, opening the connection — rather than adding a
/// fake delay on top. [HomeScreen] holds it until that work is done and a
/// short minimum has passed, so it never flashes past unread.
class TitleScreen extends StatefulWidget {
  const TitleScreen({super.key, this.status});

  /// What the app is doing behind it, if anything worth saying.
  final String? status;

  @override
  State<TitleScreen> createState() => _TitleScreenState();
}

class _TitleScreenState extends State<TitleScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Fades and lifts a piece of the screen in, [start] through [end] of the
  /// controller's run.
  Widget _stagger(double start, double end, Widget child) {
    final curve = CurvedAnimation(
      parent: _controller,
      curve: Interval(start, end, curve: Curves.easeOutCubic),
    );
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.25), end: Offset.zero).animate(curve),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                _stagger(0, 0.5, const GrandCanvasLogo(size: 168, animate: true)),
                const SizedBox(height: 34),
                _stagger(0.35, 0.8, const GrandCanvasWordmark()),
                const SizedBox(height: 18),
                _stagger(
                  0.55, 1,
                  const Text(
                    'Draw badly. Win anyway.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 15,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const Spacer(flex: 3),
                _stagger(
                  0.7, 1,
                  SizedBox(
                    height: 34,
                    child: Column(
                      children: [
                        SizedBox(
                          width: 120,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: const LinearProgressIndicator(minHeight: 3),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          widget.status ?? '',
                          style: const TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 11,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
