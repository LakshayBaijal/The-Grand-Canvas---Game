
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

/// The colour picker behind a Grand Pass swatch.
///
/// Laid out like the one every graphics program has, because that is the
/// one people already know how to use: a square of the current hue --
/// white to full colour across, down to black -- with a hue strip beside
/// it, and underneath, the numbers: R, G, B and a hex code, all editable
/// and all kept in step with the square. A "new / current" pair shows what
/// you are about to choose against what you have.
///
/// A small dialog in the middle of the screen, over the canvas, rather than
/// a sheet that shoves the toolbar off: the drawing stays where it was, and
/// the X in the corner (or a tap outside) always gets you back to it.
/// Returns the colour to save, [resetTo] if the player asked for the stock
/// colour back, or null if they closed it.
Future<Color?> showColorStudio(BuildContext context, {required Color initial, Color? resetTo}) {
  return showDialog<Color>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) => _ColorStudio(initial: initial, resetTo: resetTo),
  );
}

/// #RRGGBB, upper-case, for a colour with no alpha.
String hexOf(Color c) {
  String two(double v) => (v * 255).round().toRadixString(16).padLeft(2, '0');
  return '#${two(c.r)}${two(c.g)}${two(c.b)}'.toUpperCase();
}

/// A colour from "#RRGGBB", "RRGGBB", or "#RGB"; null if it isn't one.
Color? colorFromHex(String text) {
  var t = text.trim().replaceFirst('#', '');
  if (RegExp(r'^[0-9a-fA-F]{3}$').hasMatch(t)) {
    t = t.split('').map((ch) => '$ch$ch').join();
  }
  if (!RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(t)) return null;
  return Color(int.parse('ff$t', radix: 16));
}

class _ColorStudio extends StatefulWidget {
  const _ColorStudio({required this.initial, this.resetTo});
  final Color initial;
  final Color? resetTo;

  @override
  State<_ColorStudio> createState() => _ColorStudioState();
}

class _ColorStudioState extends State<_ColorStudio> {
  late HSVColor _hsv = HSVColor.fromColor(widget.initial);
  final _r = TextEditingController();
  final _g = TextEditingController();
  final _b = TextEditingController();
  final _hex = TextEditingController();
  final _focus = [FocusNode(), FocusNode(), FocusNode(), FocusNode()];

  Color get _color => _hsv.toColor();

  @override
  void initState() {
    super.initState();
    _syncFields();
  }

  @override
  void dispose() {
    for (final c in [_r, _g, _b, _hex]) {
      c.dispose();
    }
    for (final f in _focus) {
      f.dispose();
    }
    super.dispose();
  }

  /// Writes the colour into the number fields -- except the one being
  /// typed in, or every keystroke would be rewritten under the finger.
  void _syncFields() {
    final c = _color;
    void put(TextEditingController ctl, FocusNode f, String v) {
      if (!f.hasFocus && ctl.text != v) ctl.text = v;
    }
    put(_r, _focus[0], (c.r * 255).round().toString());
    put(_g, _focus[1], (c.g * 255).round().toString());
    put(_b, _focus[2], (c.b * 255).round().toString());
    put(_hex, _focus[3], hexOf(c));
  }

  void _set(HSVColor v) {
    setState(() => _hsv = v);
    _syncFields();
  }

  void _fromRgb() {
    final r = int.tryParse(_r.text);
    final g = int.tryParse(_g.text);
    final b = int.tryParse(_b.text);
    if (r == null || g == null || b == null) return;
    _set(HSVColor.fromColor(Color.fromARGB(255, r.clamp(0, 255), g.clamp(0, 255), b.clamp(0, 255))));
  }

  void _fromHex() {
    final c = colorFromHex(_hex.text);
    if (c != null) _set(HSVColor.fromColor(c));
  }

  @override
  Widget build(BuildContext context) {
    const square = 168.0;
    final dark = _hsv.value < 0.6 || _hsv.saturation > 0.75;
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
        decoration: GameDecor.panel(accent: GameColors.primary, radius: 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'YOUR COLOUR',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, letterSpacing: 2, color: GameColors.textMuted),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                    tooltip: 'Close',
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SquareField(
                    size: square,
                    hsv: _hsv,
                    onChanged: (sat, v) => _set(_hsv.withSaturation(sat).withValue(v)),
                  ),
                  const SizedBox(width: 10),
                  _HueStrip(
                    height: square,
                    hue: _hsv.hue,
                    onChanged: (h) => _set(_hsv.withHue(h)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: _NewCurrent(next: _color, current: widget.initial)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _NumberField(label: 'R', controller: _r, focus: _focus[0], onDone: _fromRgb),
                  const SizedBox(width: 6),
                  _NumberField(label: 'G', controller: _g, focus: _focus[1], onDone: _fromRgb),
                  const SizedBox(width: 6),
                  _NumberField(label: 'B', controller: _b, focus: _focus[2], onDone: _fromRgb),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _hex,
                      focusNode: _focus[3],
                      onSubmitted: (_) => _fromHex(),
                      onEditingComplete: _fromHex,
                      onTapOutside: (_) {
                        _fromHex();
                        _focus[3].unfocus();
                      },
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[#0-9a-fA-F]')),
                        LengthLimitingTextInputFormatter(7),
                      ],
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, fontFamily: 'monospace'),
                      decoration: const InputDecoration(labelText: 'HEX', isDense: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (widget.resetTo != null)
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(widget.resetTo),
                      child: const Text('RESET', style: TextStyle(color: GameColors.textMuted)),
                    ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: () => Navigator.of(context).pop(_color),
                    style: FilledButton.styleFrom(
                      backgroundColor: _color,
                      foregroundColor: dark ? Colors.white : Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    ),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('SAVE'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Saturation across, value down, in the current hue.
class _SquareField extends StatelessWidget {
  const _SquareField({required this.size, required this.hsv, required this.onChanged});
  final double size;
  final HSVColor hsv;
  final void Function(double saturation, double value) onChanged;

  void _at(Offset p) {
    onChanged((p.dx / size).clamp(0.0, 1.0), 1 - (p.dy / size).clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanDown: (d) => _at(d.localPosition),
      onPanUpdate: (d) => _at(d.localPosition),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: CustomPaint(size: Size(size, size), painter: _SquarePainter(hsv)),
      ),
    );
  }
}

class _SquarePainter extends CustomPainter {
  const _SquarePainter(this.hsv);
  final HSVColor hsv;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Offset.zero & size;
    final pure = HSVColor.fromAHSV(1, hsv.hue, 1, 1).toColor();
    canvas.drawRect(r, Paint()..shader = LinearGradient(colors: [Colors.white, pure]).createShader(r));
    canvas.drawRect(
      r,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black],
        ).createShader(r),
    );
    final p = Offset(hsv.saturation * size.width, (1 - hsv.value) * size.height);
    canvas.drawCircle(p, 8, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2.5);
    canvas.drawCircle(p, 8, Paint()..color = Colors.black.withValues(alpha: 0.5)..style = PaintingStyle.stroke..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(_SquarePainter old) => old.hsv != hsv;
}

class _HueStrip extends StatelessWidget {
  const _HueStrip({required this.height, required this.hue, required this.onChanged});
  final double height;
  final double hue;
  final ValueChanged<double> onChanged;

  void _at(Offset p) => onChanged(((p.dy / height).clamp(0.0, 1.0) * 359.99));

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanDown: (d) => _at(d.localPosition),
      onPanUpdate: (d) => _at(d.localPosition),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: CustomPaint(size: Size(24, height), painter: _HuePainter(hue)),
      ),
    );
  }
}

class _HuePainter extends CustomPainter {
  const _HuePainter(this.hue);
  final double hue;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Offset.zero & size;
    canvas.drawRect(
      r,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [for (var h = 0; h <= 360; h += 30) HSVColor.fromAHSV(1, h % 360.0, 1, 1).toColor()],
        ).createShader(r),
    );
    final y = hue / 360 * size.height;
    canvas.drawRect(
      Rect.fromLTWH(-1, y - 3, size.width + 2, 6),
      Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2.5,
    );
  }

  @override
  bool shouldRepaint(_HuePainter old) => old.hue != hue;
}

class _NewCurrent extends StatelessWidget {
  const _NewCurrent({required this.next, required this.current});
  final Color next;
  final Color current;

  @override
  Widget build(BuildContext context) {
    Widget block(Color c) => Container(width: double.infinity, height: 40, color: c);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Text('new', style: TextStyle(fontSize: 11, color: GameColors.textMuted)),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Column(children: [block(next), block(current)]),
        ),
        const SizedBox(height: 4),
        const Text('current', style: TextStyle(fontSize: 11, color: GameColors.textMuted)),
      ],
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({required this.label, required this.controller, required this.focus, required this.onDone});
  final String label;
  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 50,
      child: TextField(
        controller: controller,
        focusNode: focus,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
        onChanged: (_) => onDone(),
        onTapOutside: (_) => focus.unfocus(),
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
        decoration: InputDecoration(labelText: label, isDense: true),
      ),
    );
  }
}
