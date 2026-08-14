import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';

/// Ticks down to a server-supplied deadline and fires [onExpired] once.
/// Driving this off an absolute timestamp (rather than a local duration) keeps
/// every player's clock roughly in sync with the server's.
class CountdownBar extends StatefulWidget {
  const CountdownBar({
    super.key,
    required this.deadlineMs,
    required this.totalSeconds,
    this.onExpired,
  });

  final int deadlineMs;
  final int totalSeconds;
  final VoidCallback? onExpired;

  @override
  State<CountdownBar> createState() => _CountdownBarState();
}

class _CountdownBarState extends State<CountdownBar> {
  Timer? _timer;
  int _secondsLeft = 0;
  bool _fired = false;

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) => _tick());
  }

  @override
  void didUpdateWidget(covariant CountdownBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deadlineMs != widget.deadlineMs) _fired = false;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    final remainingMs =
        widget.deadlineMs - DateTime.now().millisecondsSinceEpoch;
    final seconds = (remainingMs / 1000).ceil().clamp(0, 999);
    if (mounted && seconds != _secondsLeft) {
      setState(() => _secondsLeft = seconds);
    }
    if (remainingMs <= 0 && !_fired) {
      _fired = true;
      widget.onExpired?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final fraction = widget.totalSeconds == 0
        ? 0.0
        : (_secondsLeft / widget.totalSeconds).clamp(0.0, 1.0);
    final urgent = _secondsLeft <= 10;

    return Row(
      children: [
        Icon(
          urgent ? Icons.timer : Icons.timer_outlined,
          size: 20,
          color: urgent ? GameColors.pink : GameColors.textMuted,
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 34,
          child: Text(
            '$_secondsLeft',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: urgent ? GameColors.pink : GameColors.textPrimary,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 8,
              backgroundColor: GameColors.surface,
              valueColor: AlwaysStoppedAnimation(
                urgent ? GameColors.pink : GameColors.cyan,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// "3 / 5 done" style progress shown while waiting on other players.
class WaitingIndicator extends StatelessWidget {
  const WaitingIndicator({
    super.key,
    required this.label,
    this.submitted,
    this.total,
  });

  final String label;
  final int? submitted;
  final int? total;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 34,
          height: 34,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: GameColors.primary,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16),
        ),
        if (submitted != null && total != null) ...[
          const SizedBox(height: 10),
          Text(
            '$submitted / $total done',
            style: const TextStyle(color: GameColors.textMuted),
          ),
          const SizedBox(height: 8),
          // Watching the bar creep up makes the wait feel like progress
          // instead of a stall.
          SizedBox(
            width: 160,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: TweenAnimationBuilder<double>(
                tween: Tween(end: total! > 0 ? submitted! / total! : 0),
                duration: const Duration(milliseconds: 500),
                curve: Curves.easeOut,
                builder: (context, value, _) => LinearProgressIndicator(
                  value: value,
                  minHeight: 6,
                  backgroundColor: GameColors.surfaceHigh,
                  color: GameColors.lime,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
