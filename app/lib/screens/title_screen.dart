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

/// One half of the rule either side of the tagline, fading out from the text.
class _Rule extends StatelessWidget {
  const _Rule();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 1,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            GameColors.textMuted.withValues(alpha: 0),
            GameColors.textMuted.withValues(alpha: 0.5),
          ],
        ),
      ),
    );
  }
}

class _TitleScreenState extends State<TitleScreen>
    with SingleTickerProviderStateMixin {
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
        position: Tween(
          begin: const Offset(0, 0.25),
          end: Offset.zero,
        ).animate(curve),
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
            // The logo block sits on the optical centre (slightly above true
            // centre, which is where the eye expects a title card to land),
            // and the loading strip pins to the bottom. Previously both were
            // in the same flex run, which stranded everything in the top half
            // with a dead third of the screen underneath.
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 5),
                _stagger(
                  0,
                  0.5,
                  const GrandCanvasLogo(size: 168, animate: true),
                ),
                const SizedBox(height: 34),
                _stagger(0.35, 0.8, const GrandCanvasWordmark()),
                const SizedBox(height: 20),
                _stagger(
                  0.55,
                  1,
                  // A rule either side of the tagline, so the line reads as a
                  // finished lockup rather than loose text under a logo.
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _Rule(),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 14),
                        child: Text(
                          'Draw badly. Win anyway.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: GameColors.textMuted,
                            fontSize: 15,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ),
                      _Rule(),
                    ],
                  ),
                ),
                const Spacer(flex: 4),
                // The studio credit. Small and last, the way a card at the end
                // of a film is: it belongs to the game without competing with
                // the game's own name. The mark is the animated studio logo —
                // Flutter plays the GIF's frames itself, so it moves.
                _stagger(0.75, 1, const _StudioCredit()),
                _stagger(
                  0.7,
                  1,
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
                const SizedBox(height: 28),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Created by Whose?Games · Developer Lakshay Baijal", with the studio's
/// animated mark beside it. The "?" is the brand's own colour: the question
/// mark is the logo, and it is also the word's punctuation.
class _StudioCredit extends StatelessWidget {
  const _StudioCredit();

  static const _electric = Color(0xFF2F7BFF);
  static const _signal = Color(0xFF7FD4FF);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            // The 240px GIF: at 48 logical pixels that is retina-sharp, and
            // it is a third the size of the big one.
            child: Image.asset(
              'assets/brand/whosegames.gif',
              width: 48,
              height: 48,
              filterQuality: FilterQuality.medium,
              gaplessPlayback: true,
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'CREATED BY',
                  style: TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 9,
                    letterSpacing: 2.4,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text.rich(
                  const TextSpan(
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.4,
                      color: GameColors.textPrimary,
                      height: 1.1,
                    ),
                    children: [
                      TextSpan(text: 'Whose'),
                      TextSpan(
                        text: '?',
                        style: TextStyle(color: _electric),
                      ),
                      TextSpan(
                        text: 'Games',
                        style: TextStyle(
                          color: _signal,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'DEVELOPER · LAKSHAY BAIJAL',
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 9,
                    letterSpacing: 1.8,
                    fontWeight: FontWeight.w700,
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
