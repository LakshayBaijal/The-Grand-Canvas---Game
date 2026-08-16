import 'package:flutter/material.dart';

/// Party-game palette: near-black stage, neon edges, loud accents. Kept in one
/// place so the look can be retuned without touching screens.
abstract final class GameColors {
  static const background = Color(0xFF0B0920);
  static const backgroundHigh = Color(0xFF15113A);
  static const surface = Color(0xFF181341);
  static const surfaceHigh = Color(0xFF262058);

  /// Hairline that separates a panel from the page. Everything gets one —
  /// it's what stops dark-on-dark turning into a single flat rectangle.
  static const border = Color(0xFF322B66);

  static const primary = Color(0xFFFFC53D); // buttons, highlights
  static const primaryBright = Color(0xFFFFE08A);
  static const primaryDeep = Color(0xFFE9A213);
  static const onPrimary = Color(0xFF231700);

  static const pink = Color(0xFFFF5C8A);
  static const cyan = Color(0xFF3DDCFF);
  static const lime = Color(0xFF9BE564);

  static const textPrimary = Color(0xFFF6F4FF);
  static const textMuted = Color(0xFF9E97CE);

  /// Cycled through to give each player a consistent colour in lists.
  static const playerColors = [pink, cyan, lime, primary, Color(0xFFB388FF)];

  static Color forIndex(int index) => playerColors[index % playerColors.length];
}

/// Shared surface treatments, so a panel in one screen looks like a panel in
/// every other one.
abstract final class GameDecor {
  static const radius = 20.0;

  /// A soft coloured halo. Used sparingly — on the thing the eye should land
  /// on first, not on everything.
  static List<BoxShadow> glow(Color color, {double strength = 1}) => [
        BoxShadow(
          color: color.withValues(alpha: 0.30 * strength),
          blurRadius: 22 * strength,
          spreadRadius: -4,
        ),
      ];

  /// A panel: faint top-lit gradient, hairline edge, and an accent border plus
  /// halo when it's the focus of the screen.
  static BoxDecoration panel({
    Color? accent,
    double radius = GameDecor.radius,
    bool raised = false,
  }) =>
      BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1E1849), GameColors.surface],
        ),
        border: Border.all(
          color: accent?.withValues(alpha: 0.55) ?? GameColors.border,
          width: accent != null ? 1.6 : 1.2,
        ),
        boxShadow: [
          if (accent != null) ...glow(accent, strength: 0.75),
          if (raised)
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.45),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
        ],
      );
}

/// The lit backdrop every screen sits on: two coloured pools bleeding in from
/// the corners over a near-black page, so the background has some depth
/// instead of being one flat fill.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: GameColors.background),
      child: Stack(
        children: [
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-0.7, -0.9),
                  radius: 1.1,
                  colors: [Color(0x33FFC53D), Color(0x00FFC53D)],
                ),
              ),
            ),
          ),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0.9, 0.8),
                  radius: 1.0,
                  colors: [Color(0x333DDCFF), Color(0x003DDCFF)],
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Fills a button with a vertical gradient, a gloss band across the top half,
/// a crisp lip and an outer halo.
///
/// Lives in the theme rather than in a custom button widget so every
/// `FilledButton` and `OutlinedButton` already in the app inherits it.
Widget _buttonSurface({
  required Set<WidgetState> states,
  required Widget? child,
  required Color top,
  required Color bottom,
  required Color edge,
  Color? halo,
  bool filled = true,
}) {
  final disabled = states.contains(WidgetState.disabled);
  final pressed = states.contains(WidgetState.pressed);
  final radius = BorderRadius.circular(16);

  // A key cap sits on a darker lip. Drawing that lip as a second layer behind
  // the face — rather than as a border — is what makes the button read as a
  // physical object with height instead of a flat coloured bar.
  const lipHeight = 4.0;
  final lip = disabled
      ? const Color(0xFF15113A)
      : Color.lerp(bottom, Colors.black, filled ? 0.42 : 0.55)!;

  final face = DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: radius,
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: disabled
            ? const [Color(0xFF221C4C), Color(0xFF1B1640)]
            : [top, bottom],
      ),
      border: Border.all(
        color: disabled ? GameColors.border : edge,
        width: filled ? 1.2 : 1.8,
      ),
    ),
    child: ClipRRect(
      borderRadius: radius,
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          // The shine: a highlight fading out by the middle of the button.
          if (!disabled)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.white.withValues(alpha: filled ? 0.30 : 0.08),
                      Colors.white.withValues(alpha: 0),
                    ],
                    stops: const [0, 0.52],
                  ),
                ),
              ),
            ),
          ?child,
        ],
      ),
    ),
  );

  return DecoratedBox(
    // The lip, plus the halo and the cast shadow that lift it off the page.
    decoration: BoxDecoration(
      borderRadius: radius,
      color: lip,
      boxShadow: [
        if (!disabled && halo != null)
          ...GameDecor.glow(halo, strength: pressed ? 0.45 : 1),
        if (!disabled)
          BoxShadow(
            color: Colors.black.withValues(alpha: pressed ? 0.22 : 0.42),
            blurRadius: pressed ? 6 : 14,
            offset: Offset(0, pressed ? 2 : 6),
          ),
      ],
    ),
    // Pressing drops the face onto the lip, so the travel is visible rather
    // than just a colour change.
    child: Padding(
      padding: EdgeInsets.only(
        top: pressed ? lipHeight : 0,
        bottom: pressed ? 0 : lipHeight,
      ),
      child: face,
    ),
  );
}

ThemeData buildGameTheme() {
  const scheme = ColorScheme.dark(
    primary: GameColors.primary,
    onPrimary: GameColors.onPrimary,
    secondary: GameColors.pink,
    onSecondary: Colors.white,
    surface: GameColors.surface,
    onSurface: GameColors.textPrimary,
    error: Color(0xFFFF6B6B),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Colors.transparent,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: GameColors.textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w900,
        letterSpacing: 2.2,
      ),
      iconTheme: IconThemeData(color: GameColors.textPrimary),
    ),
    textTheme: const TextTheme(
      displayLarge: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 4),
      headlineSmall: TextStyle(fontWeight: FontWeight.w800),
      titleLarge: TextStyle(fontWeight: FontWeight.w800),
      titleMedium: TextStyle(fontWeight: FontWeight.w700),
      bodyLarge: TextStyle(fontSize: 16),
    ).apply(bodyColor: GameColors.textPrimary, displayColor: GameColors.textPrimary),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: GameColors.surface,
      hintStyle: const TextStyle(color: GameColors.textMuted),
      labelStyle: const TextStyle(color: GameColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: GameColors.border, width: 1.2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: GameColors.border, width: 1.2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: GameColors.primary, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        // +4 for the lip drawn behind the face, so the tappable face keeps its
        // original height rather than losing 4px to it.
        minimumSize: const Size.fromHeight(60),
        foregroundColor: GameColors.onPrimary,
        disabledForegroundColor: GameColors.textMuted,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ).copyWith(
        // The gradient/gloss can't be expressed as a plain background colour.
        backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
        shadowColor: const WidgetStatePropertyAll(Colors.transparent),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        backgroundBuilder: (context, states, child) => _buttonSurface(
          states: states,
          child: child,
          top: GameColors.primaryBright,
          bottom: GameColors.primaryDeep,
          edge: GameColors.primaryBright,
          halo: GameColors.primary,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(58),
        foregroundColor: GameColors.textPrimary,
        disabledForegroundColor: GameColors.textMuted,
        side: BorderSide.none,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 1.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ).copyWith(
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        backgroundBuilder: (context, states, child) => _buttonSurface(
          states: states,
          child: child,
          top: const Color(0xFF241E55),
          bottom: const Color(0xFF191343),
          edge: GameColors.cyan.withValues(alpha: 0.55),
          halo: GameColors.cyan.withValues(alpha: 0.5),
          filled: false,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: GameColors.textMuted),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: GameColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GameDecor.radius),
        side: const BorderSide(color: GameColors.border, width: 1.2),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: GameColors.surfaceHigh,
      contentTextStyle: const TextStyle(color: GameColors.textPrimary),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: GameColors.border, width: 1.2),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: GameColors.primary,
      linearTrackColor: GameColors.surfaceHigh,
    ),
  );
}
