import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models/stroke.dart';
import '../models/styles.dart';
import '../widgets/drawing_canvas.dart';

/// Turns a drawing into a picture that can leave the app: saved to the
/// phone's gallery, or shared to WhatsApp, Instagram, wherever.
///
/// The card is the drawing on its paper, drawn by the same painters the
/// game uses, with the title and the prompt underneath and a small mark
/// saying where it came from. That mark is the whole marketing budget: a
/// funny drawing posted to a group chat is how a game with no followers
/// gets found, and the mark is how the person who laughs at it finds the
/// game.
///
/// Everything happens on the phone. No server, no key, no account.
class DrawingExport {
  DrawingExport._();

  static const _width = 1080.0;
  static const _pad = 60.0;
  static const _background = Color(0xFF0B0920);
  static const _gold = Color(0xFFFFC53D);

  /// Renders the card as PNG bytes.
  static Future<Uint8List> render({
    required List<Stroke> strokes,
    required PaperStyle paper,
    required String title,
    required String prompt,
    String? artist,
  }) async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);

    // Text first, so the card's height is known before the background.
    final titleP = _text(
      title,
      const TextStyle(
        color: Colors.white,
        fontSize: 56,
        fontWeight: FontWeight.w900,
        height: 1.15,
      ),
      _width - _pad * 2,
    );
    final byP = artist == null
        ? null
        : _text(
            'by $artist',
            const TextStyle(
              color: _gold,
              fontSize: 30,
              fontWeight: FontWeight.w700,
            ),
            _width - _pad * 2,
          );
    final promptP = _text(
      prompt,
      const TextStyle(
        color: Color(0xFFB8B3D9),
        fontSize: 30,
        fontStyle: FontStyle.italic,
        height: 1.3,
      ),
      _width - _pad * 2,
    );
    final markP = _text(
      'GRAND CANVAS · a Whose?Games party game',
      const TextStyle(
        color: Color(0xFF7C76A8),
        fontSize: 24,
        fontWeight: FontWeight.w800,
        letterSpacing: 2,
      ),
      _width - _pad * 2,
    );

    const paperSize = _width - _pad * 2;
    var y = _pad;
    final paperTop = y;
    y += paperSize + 44;
    final titleTop = y;
    y += titleP.height + 8;
    if (byP != null) {
      y += byP.height + 14;
    } else {
      y += 6;
    }
    final promptTop = y;
    y += promptP.height + 36;
    final markTop = y;
    y += markP.height + _pad;
    final height = y;

    canvas.drawRect(
      Rect.fromLTWH(0, 0, _width, height),
      Paint()..color = _background,
    );

    // The paper, with a soft shadow so it sits on the dark card.
    final paperRect = Rect.fromLTWH(_pad, paperTop, paperSize, paperSize);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        paperRect.shift(const Offset(0, 10)),
        const Radius.circular(24),
      ),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.5)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 24),
    );
    canvas.save();
    canvas.clipRRect(
      RRect.fromRectAndRadius(paperRect, const Radius.circular(24)),
    );
    canvas.translate(paperRect.left, paperRect.top);
    paintPaperBackground(canvas, const Size(paperSize, paperSize), paper);
    for (final stroke in strokes) {
      final points = stroke.points
          .map((p) => Offset(p.x * paperSize, p.y * paperSize))
          .toList();
      paintStrokePath(
        canvas,
        points,
        stroke.color,
        stroke.width * (paperSize / 360),
        stroke.style,
      );
    }
    canvas.restore();

    titleP.paint(canvas, Offset(_pad, titleTop));
    if (byP != null) {
      byP.paint(canvas, Offset(_pad, titleTop + titleP.height + 8));
    }
    promptP.paint(canvas, Offset(_pad, promptTop));
    markP.paint(canvas, Offset(_pad, markTop));
    // A small gold underline under the mark, the one bit of brand colour.
    canvas.drawRect(
      Rect.fromLTWH(_pad, markTop + markP.height + 10, 120, 6),
      Paint()..color = _gold,
    );

    final picture = recorder.endRecording();
    final image = await picture.toImage(_width.toInt(), height.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return bytes!.buffer.asUint8List();
  }

  static TextPainter _text(String s, TextStyle style, double maxWidth) {
    final p = TextPainter(
      text: TextSpan(text: s, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 4,
      ellipsis: '…',
    )..layout(maxWidth: maxWidth);
    return p;
  }

  /// Saves to the phone's gallery, in a "Grand Canvas" album. Returns false
  /// if the phone refused (permission denied, no gallery app).
  static Future<bool> saveToGallery(
    Uint8List png, {
    required String name,
  }) async {
    try {
      if (!await Gal.hasAccess(toAlbum: true)) {
        if (!await Gal.requestAccess(toAlbum: true)) return false;
      }
      await Gal.putImageBytes(
        png,
        album: 'Grand Canvas',
        name: _fileName(name),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Opens the system share sheet with the picture and a line of text.
  static Future<void> share(
    Uint8List png, {
    required String name,
    required String text,
  }) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/${_fileName(name)}.png');
    await file.writeAsBytes(png, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'image/png')],
        text: text,
        subject: 'Grand Canvas',
      ),
    );
  }

  static String _fileName(String title) {
    final safe = title.replaceAll(RegExp(r'[^A-Za-z0-9 _-]'), '').trim();
    final stamp = DateTime.now().millisecondsSinceEpoch % 100000;
    return 'grandcanvas-${safe.isEmpty ? 'drawing' : safe}-$stamp';
  }
}

/// The one line that goes with a shared picture. Ends with where to get the
/// game, because that's the point of sharing it.
String shareCaption(String title, String prompt) =>
    '"$title" — my drawing for "$prompt" in Grand Canvas, the party drawing game. '
    'Play it: https://play.google.com/store/apps/details?id=com.whosegames.grandcanvas';
