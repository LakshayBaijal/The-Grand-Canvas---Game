import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bad_mental_canvas/widgets/grand_pass_mark.dart';
import 'package:bad_mental_canvas/widgets/name_tag.dart';

/// Renders the Grand Pass emblem to a PNG for a human to look at. Only
/// writes when asked (`EMBLEM_PREVIEW=path`), like the icon test.
void main() {
  testWidgets('emblem preview', (tester) async {
    final out = Platform.environment['EMBLEM_PREVIEW'];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        backgroundColor: const Color(0xFF1B1830),
        body: RepaintBoundary(
          key: const Key('preview'),
          child: Container(
            color: const Color(0xFF1B1830),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const GrandPassMark(size: 160),
                const SizedBox(height: 24),
                const DefaultTextStyle(
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                  child: NameTag(name: 'Lakshay', tier: 'gold', crown: true),
                ),
                const SizedBox(height: 12),
                Container(
                  color: const Color(0xFFFAF3E3),
                  padding: const EdgeInsets.all(8),
                  child: const DefaultTextStyle(
                    style: TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.w800),
                    child: NameTag(name: 'Riya', tier: 'silver', crown: true),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ));
    await tester.pump();
    if (out == null) return;
    // Rasterising is real async work; a widget test only lets that run
    // inside runAsync, and without it the future never completes.
    await tester.runAsync(() async {
      final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(const Key('preview')));
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File(out).writeAsBytesSync(bytes!.buffer.asUint8List());
    });
  });
}
