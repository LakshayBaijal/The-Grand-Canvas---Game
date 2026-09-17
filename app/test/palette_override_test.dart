import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bad_mental_canvas/services/entitlements.dart';

/// A swatch made yours stays yours; set back to stock, it is stock again.
void main() {
  test('a slot keeps its colour, and clears when set back to stock', () async {
    SharedPreferences.setMockInitialValues({});
    final e = Entitlements.instance;
    await e.load();
    const stock = Color(0xFFE53935);
    expect(e.paletteColour(2, stock), stock);
    expect(e.paletteIsCustom(2), isFalse);

    await e.setPaletteColour(2, const Color(0xFF00BFA5), stock: stock);
    expect(e.paletteColour(2, stock), const Color(0xFF00BFA5));
    expect(e.paletteIsCustom(2), isTrue);

    // Survives a reload from disk.
    await e.load();
    expect(e.paletteColour(2, stock), const Color(0xFF00BFA5));

    // Saving the stock colour is the same as resetting.
    await e.setPaletteColour(2, stock, stock: stock);
    expect(e.paletteIsCustom(2), isFalse);
  });
}
