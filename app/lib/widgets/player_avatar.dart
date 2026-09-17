import 'package:flutter/material.dart';

/// A player's face: their Google profile picture if they've signed in, else
/// the first letter of their name on a coloured disc.
///
/// The letter is the fallback in every failure, not just "no picture": a
/// dead URL, no network, a picture that hasn't arrived yet. A lobby of
/// people must never show a broken-image icon, and on a slow connection the
/// letter is there first and the face fades in over it.
class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar({
    super.key,
    required this.name,
    required this.radius,
    this.avatarUrl,
    this.color = const Color(0xFFFFC53D),
    this.textColor = const Color(0xFF16123A),
  });

  final String name;
  final double radius;
  final String? avatarUrl;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    final letter = CircleAvatar(
      radius: radius,
      backgroundColor: color,
      child: Text(
        name.isEmpty ? '?' : name.characters.first.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontWeight: FontWeight.w900,
          fontSize: radius * 0.9,
        ),
      ),
    );
    final url = avatarUrl;
    if (url == null || url.isEmpty) return letter;
    // Google serves the picture at whatever size the URL's `=sNN` suffix
    // asks for; asking for what we draw keeps the download tiny.
    final base = url.replaceFirst(RegExp(r'=s\d+(-c)?$'), '');
    final sized = '$base=s${(radius * 2 * 3).round()}-c';
    return SizedBox(
      width: radius * 2,
      height: radius * 2,
      child: Stack(
        fit: StackFit.expand,
        children: [
          letter,
          ClipOval(
            child: Image.network(
              sized,
              fit: BoxFit.cover,
              gaplessPlayback: true,
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
              frameBuilder: (_, child, frame, wasSync) => wasSync
                  ? child
                  : AnimatedOpacity(
                      opacity: frame == null ? 0 : 1,
                      duration: const Duration(milliseconds: 250),
                      child: child,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
