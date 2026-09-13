import 'package:flutter/material.dart';

import '../services/entitlements.dart';
import '../services/store.dart';
import '../theme.dart';
import 'customize_sheet.dart';
import 'sketch_icons.dart';
import 'unlock_sheet.dart';

/// The pass, top-right of the home screen, before anything else.
///
/// Gold, with a slow breathing glow so it's the first thing the eye lands
/// on without being a strobe. Once the pass is owned it settles into a quiet
/// "PASS ✓" chip that opens the paper & pen picker instead — there's nothing
/// left to sell, so it stops selling.
class PassButton extends StatefulWidget {
  const PassButton({super.key});

  @override
  State<PassButton> createState() => _PassButtonState();
}

class _PassButtonState extends State<PassButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Entitlements.instance,
      builder: (context, _) {
        if (Entitlements.instance.hasLifetime) {
          return _Chip(
            onTap: () => showCustomizeSheet(context),
            background: GameColors.surfaceHigh,
            border: GameColors.lime.withValues(alpha: 0.6),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SketchIcon(
                  SketchGlyph.sparkle,
                  size: 14,
                  color: GameColors.lime,
                ),
                SizedBox(width: 6),
                Text(
                  'PASS ✓',
                  style: TextStyle(
                    color: GameColors.lime,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          );
        }
        return AnimatedBuilder(
          animation: _breath,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_breath.value);
            return Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                boxShadow: GameDecor.glow(
                  GameColors.primary,
                  strength: 0.55 + 0.55 * t,
                ),
              ),
              child: child,
            );
          },
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(22),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => showUnlockSheet(context),
              child: Ink(
                padding: const EdgeInsets.fromLTRB(12, 8, 14, 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [GameColors.primaryBright, GameColors.primaryDeep],
                  ),
                  border: Border.all(
                    color: GameColors.primaryBright,
                    width: 1.4,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SketchIcon(
                      SketchGlyph.sparkle,
                      size: 16,
                      color: Color(0xFF241800),
                    ),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'GET THE PASS',
                          style: TextStyle(
                            color: Color(0xFF241800),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                            height: 1.1,
                          ),
                        ),
                        Text(
                          '${store.passPrice} · once, forever',
                          style: const TextStyle(
                            color: Color(0xFF4A3300),
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.onTap,
    required this.background,
    required this.border,
    required this.child,
  });

  final VoidCallback onTap;
  final Color background;
  final Color border;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: border, width: 1.2),
          ),
          child: child,
        ),
      ),
    );
  }
}
