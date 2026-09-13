import 'package:flutter/material.dart';

import '../models/stroke.dart';
import '../models/styles.dart';
import '../services/drawing_export.dart';
import '../theme.dart';
import 'sketch_icons.dart';

/// What you can do with a drawing: keep it, send it, or — if it isn't yours
/// — say something's wrong with it, or stop seeing that artist.
///
/// Report and hide are player tools, not a filter. A report is a note a
/// human reads; a hide only changes what this one phone shows. Nothing is
/// judged or removed by the app, which is the rule the whole game is built
/// on: what people draw is theirs. Google Play requires both to exist for
/// anything that shows one person's drawing to another, and they belong
/// here anyway.
Future<void> showDrawingActions(
  BuildContext context, {
  required List<Stroke> strokes,
  required PaperStyle paper,
  required String title,
  required String prompt,
  String? artistLabel,
  bool isMine = false,
  Future<void> Function(String reason)? onReport,
  Future<void> Function()? onHide,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => _ActionsSheet(
      strokes: strokes,
      paper: paper,
      title: title,
      prompt: prompt,
      artistLabel: artistLabel,
      isMine: isMine,
      onReport: onReport,
      onHide: onHide,
    ),
  );
}

class _ActionsSheet extends StatefulWidget {
  const _ActionsSheet({
    required this.strokes,
    required this.paper,
    required this.title,
    required this.prompt,
    required this.artistLabel,
    required this.isMine,
    required this.onReport,
    required this.onHide,
  });

  final List<Stroke> strokes;
  final PaperStyle paper;
  final String title;
  final String prompt;
  final String? artistLabel;
  final bool isMine;
  final Future<void> Function(String reason)? onReport;
  final Future<void> Function()? onHide;

  @override
  State<_ActionsSheet> createState() => _ActionsSheetState();
}

class _ActionsSheetState extends State<_ActionsSheet> {
  bool _busy = false;

  Future<void> _do(Future<String?> Function() action) async {
    setState(() => _busy = true);
    final message = await action();
    if (!mounted) return;
    Navigator.of(context).pop();
    if (message != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<String?> _save() async {
    final png = await DrawingExport.render(
      strokes: widget.strokes,
      paper: widget.paper,
      title: widget.title,
      prompt: widget.prompt,
      artist: widget.isMine ? null : widget.artistLabel,
    );
    final ok = await DrawingExport.saveToGallery(png, name: widget.title);
    return ok
        ? 'Saved to your gallery, in a "Grand Canvas" album'
        : "Couldn't save — check the app's photo permission";
  }

  Future<String?> _share() async {
    final png = await DrawingExport.render(
      strokes: widget.strokes,
      paper: widget.paper,
      title: widget.title,
      prompt: widget.prompt,
      artist: widget.isMine ? null : widget.artistLabel,
    );
    await DrawingExport.share(
      png,
      name: widget.title,
      text: shareCaption(widget.title, widget.prompt),
    );
    return null;
  }

  Future<void> _report() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReasonDialog(),
    );
    if (reason == null || !mounted) return;
    await _do(() async {
      await widget.onReport!(reason);
      return 'Thanks. Someone will look at it.';
    });
  }

  Future<void> _hide() async {
    await _do(() async {
      await widget.onHide!();
      return "You won't see their Daily drawings any more";
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
        decoration: BoxDecoration(
          color: GameColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: GameColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            _Action(
              icon: const Icon(Icons.download_rounded, color: GameColors.cyan),
              label: 'Save to gallery',
              hint: 'As a picture, with the title and prompt',
              onTap: _busy ? null : () => _do(_save),
            ),
            _Action(
              icon: const Icon(Icons.ios_share_rounded, color: GameColors.lime),
              label: 'Share',
              hint: 'WhatsApp, Instagram, anywhere',
              onTap: _busy ? null : () => _do(_share),
            ),
            if (!widget.isMine && widget.onReport != null) ...[
              const Divider(color: GameColors.border, height: 12),
              _Action(
                icon: const Icon(
                  Icons.flag_outlined,
                  color: GameColors.textMuted,
                ),
                label: 'Report this drawing',
                hint:
                    'A person will look at it. Nothing happens automatically.',
                onTap: _busy ? null : _report,
              ),
            ],
            if (!widget.isMine && widget.onHide != null)
              _Action(
                icon: const Icon(
                  Icons.visibility_off_outlined,
                  color: GameColors.textMuted,
                ),
                label: 'Hide this artist',
                hint: 'Only on your phone. Their Daily drawings stop showing.',
                onTap: _busy ? null : _hide,
              ),
            if (_busy)
              const Padding(
                padding: EdgeInsets.all(10),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: GameColors.primary,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onTap,
  });

  final Widget icon;
  final String label;
  final String hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: icon,
      title: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
      ),
      subtitle: Text(
        hint,
        style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
      ),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      dense: true,
    );
  }
}

/// Why. Free text with a couple of one-tap options; kept short because it's
/// for a human to read, not a form to fill.
class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _controller = TextEditingController();
  static const _quick = [
    'Hateful or harassing',
    'Sexual content',
    'Spam',
    'Something else',
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: GameColors.surfaceHigh,
      title: const Text("What's wrong with it?"),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final q in _quick)
                ActionChip(
                  label: Text(q, style: const TextStyle(fontSize: 12)),
                  onPressed: () => Navigator.of(context).pop(q),
                ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            maxLength: 200,
            decoration: const InputDecoration(
              hintText: 'Or say it in your words',
              counterText: '',
            ),
            onSubmitted: (v) {
              if (v.trim().isNotEmpty) Navigator.of(context).pop(v.trim());
            },
          ),
          const SizedBox(height: 4),
          const Text(
            'Reports go to a person, not a filter. Drawings are never removed automatically.',
            style: TextStyle(
              color: GameColors.textMuted,
              fontSize: 11.5,
              height: 1.35,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('CANCEL'),
        ),
        FilledButton(
          onPressed: () {
            final v = _controller.text.trim();
            if (v.isNotEmpty) Navigator.of(context).pop(v);
          },
          child: const Text('SEND'),
        ),
      ],
    );
  }
}

/// Shown once, before the first Daily submission: the terms, in one
/// breath. Google Play asks that people accept something before they post
/// where others can see; this is that, and it's also just true.
Future<bool> confirmDailyTerms(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: GameColors.surfaceHigh,
      title: const Row(
        children: [
          SketchIcon(SketchGlyph.sparkle, size: 18, color: GameColors.primary),
          SizedBox(width: 8),
          Text('Before the world sees it'),
        ],
      ),
      content: const Text(
        'Your Daily drawing and its title are shown to everyone who draws '
        'today, and the top three are kept in the Hall of Fame with your name. '
        'Draw whatever you like — but keep it fun. Anything hateful, sexual or '
        'spam can be reported by other players and looked at by a person, and '
        'anyone can hide an artist they don\'t want to see.',
        style: TextStyle(height: 1.4, fontSize: 14),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('NOT NOW'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('GOT IT, SEND'),
        ),
      ],
    ),
  );
  return ok == true;
}
