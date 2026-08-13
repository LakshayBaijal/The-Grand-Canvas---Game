import 'package:flutter/material.dart';

/// Party-game palette: dark stage, loud accents. Kept in one place so the
/// look can be retuned (or swapped for custom art) without touching screens.
abstract final class GameColors {
  static const background = Color(0xFF16123A);
  static const surface = Color(0xFF241E55);
  static const surfaceHigh = Color(0xFF322A6E);

  static const primary = Color(0xFFFFC53D); // buttons, highlights
  static const pink = Color(0xFFFF5C8A);
  static const cyan = Color(0xFF3DDCFF);
  static const lime = Color(0xFF9BE564);

  static const textPrimary = Color(0xFFF6F4FF);
  static const textMuted = Color(0xFFA9A2D8);

  /// Cycled through to give each player a consistent colour in lists.
  static const playerColors = [pink, cyan, lime, primary, Color(0xFFB388FF)];

  static Color forIndex(int index) => playerColors[index % playerColors.length];
}

ThemeData buildGameTheme() {
  const scheme = ColorScheme.dark(
    primary: GameColors.primary,
    onPrimary: Color(0xFF241800),
    secondary: GameColors.pink,
    onSecondary: Colors.white,
    surface: GameColors.surface,
    onSurface: GameColors.textPrimary,
    error: Color(0xFFFF6B6B),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: GameColors.background,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: GameColors.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
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
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: GameColors.primary, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(58),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(58),
        foregroundColor: GameColors.textPrimary,
        side: const BorderSide(color: GameColors.surfaceHigh, width: 2),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: GameColors.surfaceHigh,
      contentTextStyle: TextStyle(color: GameColors.textPrimary),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
