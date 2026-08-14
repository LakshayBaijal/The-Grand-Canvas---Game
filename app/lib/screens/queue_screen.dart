import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../widgets/celebration.dart';
import '../widgets/doodle_stage.dart';

/// Waiting for a ranked match.
///
/// The wait is the weakest moment in any matchmade game, so the idle canvas
/// runs the whole time — there's always a drawing appearing in front of you
/// rather than a bare spinner.
class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key, required this.connection, required this.onCancel});

  final GameConnection connection;
  final VoidCallback onCancel;

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  StreamSubscription<GameEvent>? _sub;
  Timer? _tick;

  int _waiting = 1;
  int _target = 5;
  int _botFillAtMs = 0;
  DoodleEvent? _doodle;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen(_handleEvent);
    // Local ticker so the countdown moves smoothly between server updates.
    _tick = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted) setState(() {});
    });
    widget.connection.requestDoodle();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  void _handleEvent(GameEvent event) {
    if (!mounted) return;
    switch (event) {
      case QueueStatusEvent(:final waiting, :final target, :final botFillAtMs):
        setState(() {
          _waiting = waiting;
          _target = target;
          _botFillAtMs = botFillAtMs;
        });
      case DoodleEvent():
        setState(() => _doodle = event);
      default:
        break;
    }
  }

  Duration get _untilBots {
    if (_botFillAtMs == 0) return Duration.zero;
    final ms = _botFillAtMs - DateTime.now().millisecondsSinceEpoch;
    return Duration(milliseconds: ms.clamp(0, 1 << 30));
  }

  @override
  Widget build(BuildContext context) {
    final seconds = _untilBots.inSeconds;
    return Scaffold(
      appBar: AppBar(
        title: const Text('FINDING A MATCH'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              _QueueCard(waiting: _waiting, target: _target, secondsUntilBots: seconds),
              const SizedBox(height: 14),
              Expanded(
                child: DoodleStage(
                  doodle: _doodle,
                  onNext: widget.connection.requestDoodle,
                ),
              ),
              const SizedBox(height: 14),
              OutlinedButton(
                onPressed: widget.onCancel,
                child: const Text('CANCEL'),
              ),
              const SizedBox(height: 14),
            ],
          ),
        ),
      ),
    );
  }
}

/// mm:ss — a two-minute wait reads badly as a bare "118s".
String _clock(int seconds) {
  final m = seconds ~/ 60;
  final s = (seconds % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({
    required this.waiting,
    required this.target,
    required this.secondsUntilBots,
  });

  final int waiting;
  final int target;
  final int secondsUntilBots;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Pulse(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: GameColors.primary),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '$waiting OF $target PLAYERS',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.5,
                  color: GameColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // A seat per slot, filling up as people arrive.
          Row(
            children: [
              for (var i = 0; i < target; i++)
                Expanded(
                  child: AnimatedContainer(
                    // Seats light up as people arrive rather than snapping.
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOut,
                    height: 8,
                    margin: EdgeInsets.only(right: i == target - 1 ? 0 : 6),
                    decoration: BoxDecoration(
                      color: i < waiting
                          ? GameColors.primary
                          : i == waiting
                              // The seat we're waiting on, hinted.
                              ? GameColors.primary.withValues(alpha: 0.3)
                              : GameColors.surfaceHigh,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            secondsUntilBots > 0
                ? 'Starting in ${_clock(secondsUntilBots)}'
                : 'Starting…',
            style: const TextStyle(color: GameColors.textMuted, fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}
