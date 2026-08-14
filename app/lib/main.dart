import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/home_screen.dart';
import 'services/game_connection.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // The game is designed for a phone held upright; rotating mid-drawing would
  // rescale the canvas under the player's finger.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const BadMentalCanvasApp());
}

class BadMentalCanvasApp extends StatefulWidget {
  const BadMentalCanvasApp({super.key});

  @override
  State<BadMentalCanvasApp> createState() => _BadMentalCanvasAppState();
}

class _BadMentalCanvasAppState extends State<BadMentalCanvasApp> {
  final _connection = GameConnection();

  @override
  void dispose() {
    _connection.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'The Grand Canvas',
      debugShowCheckedModeBanner: false,
      theme: buildGameTheme(),
      // Scaffolds are transparent so every screen sits on the one lit
      // backdrop rather than each painting its own flat fill.
      builder: (context, child) => AppBackground(child: child ?? const SizedBox()),
      home: HomeScreen(connection: _connection),
    );
  }
}
