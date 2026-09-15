import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
    node.requestFocus();
    SystemChannels.textInput.invokeMethod<void>('TextInput.show');
  }

  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (node.context == null) return;
    nudge();
    Timer(const Duration(milliseconds: 350), () {
      if (node.context != null && !node.hasFocus) nudge();
    });
  });
}
