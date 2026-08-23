import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../theme.dart';
import '../widgets/countdown.dart';

/// Keep in sync with PROMPT_SECONDS on the server.
const _promptSeconds = 40;

/// One random player each round fills in the blank of a Mad-Libs-style
/// "homework problem"; everyone else just watches and waits, same as
/// Jackbox's Patently Stupid.
class PromptWritingView extends StatefulWidget {
  const PromptWritingView({super.key, required this.event, required this.onSubmit});

  final PromptWritingEvent event;
  final void Function(String) onSubmit;

  @override
  State<PromptWritingView> createState() => _PromptWritingViewState();
}

class _PromptWritingViewState extends State<PromptWritingView> {
  final _controller = TextEditingController();
  bool _submitted = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_submitted) return;
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSubmit(text);
    setState(() => _submitted = true);
  }

  String get _blankText {
    if (!widget.event.isWriter) return '___';
    final text = _controller.text.trim();
    return text.isEmpty ? '___' : text;
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final parts = event.template.split('___');
    final before = parts.isNotEmpty ? parts[0] : '';
    final after = parts.length > 1 ? parts[1] : '';
    final filledIn = _blankText != '___';

    return Scaffold(
      appBar: AppBar(title: Text('ROUND ${event.roundIndex + 1} OF ${event.totalRounds}')),
      // Scrollable: with the keyboard up and a long template, a fixed Column
      // overflows on shorter phones.
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              if (!_submitted) CountdownBar(deadlineMs: event.deadlineMs, totalSeconds: _promptSeconds),
              const SizedBox(height: 28),
              Text(
                event.isWriter ? "IT'S YOUR TURN TO INVENT A PROBLEM" : "SOMEONE'S INVENTING A PROBLEM",
                textAlign: TextAlign.center,
                style: const TextStyle(color: GameColors.textMuted, fontSize: 12, letterSpacing: 2),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(22),
                decoration: GameDecor.panel(accent: GameColors.cyan),
                child: RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      color: GameColors.textPrimary,
                      height: 1.45,
                    ),
                    children: [
                      TextSpan(text: before),
                      TextSpan(
                        text: _blankText,
                        style: TextStyle(
                          color: filledIn ? GameColors.primary : GameColors.textMuted,
                          decoration: TextDecoration.underline,
                          decorationColor: GameColors.primary,
                          decorationThickness: 2,
                        ),
                      ),
                      TextSpan(text: after),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),
              if (event.isWriter && !_submitted) ...[
                TextField(
                  controller: _controller,
                  autofocus: true,
                  maxLength: 60,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _submit(),
                  decoration: const InputDecoration(hintText: 'e.g. flying pigeons'),
                ),
                const SizedBox(height: 4),
                FilledButton(onPressed: _submit, child: const Text('SUBMIT')),
              ] else if (event.isWriter)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: WaitingIndicator(label: 'Nice! Everyone is about to start drawing…'),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: WaitingIndicator(label: '${event.writerName} is filling in the blank…'),
                ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
