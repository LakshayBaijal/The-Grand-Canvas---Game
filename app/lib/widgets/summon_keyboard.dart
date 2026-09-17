import 'dart:async';

import 'package:flutter/material.dart';

/// Puts the cursor in a field and brings the keyboard up, reliably.
///
/// `autofocus: true` is not reliable for a field that appears mid-game. It
/// asks the focus scope politely, once, during build -- and if anything else
/// holds focus at that instant (the previous phase's field on its way out,
/// a button, the route transition) the request is dropped without a word and
/// the keyboard never shows. Players hit this naming a drawing with the clock
/// running. So: ask after layout, when the field really exists, tell the
/// platform to show the keyboard outright rather than waiting for the focus
/// change to imply it, and ask once more a beat later in case a transition
/// animation ate the first go. Both are no-ops if it already worked.
void summonKeyboard(FocusNode node) {
  void nudge() {
    if (node.context?.mounted != true) return;
    // Focus alone. Asking the platform for the keyboard directly, without a
    // text field attached yet, can raise a keyboard that types into nothing
    // and won't go away -- a "stuck" keyboard mid-round. Focusing the field
    // attaches it first, and the keyboard follows.
    node.requestFocus();
  }

  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (node.context == null) return;
    nudge();
    Timer(const Duration(milliseconds: 350), () {
      if (node.context != null && !node.hasFocus) nudge();
    });
  });
}
