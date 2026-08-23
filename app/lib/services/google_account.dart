import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Signing in with Google, so an account outlives the phone it was made on.
///
/// This deliberately does very little: it gets an **id token** from Google and
/// hands it to the server, which is the only party that verifies anything.
/// Nothing here decides who the player is — a client that could do that would
/// be no better than the device id it replaces.
///
/// It is also entirely optional. The game is built to run on a laptop on a
/// home Wi-Fi with no internet, where Google sign-in cannot work at all, so
/// every failure path here ends in "carry on as a device account" rather than
/// an error the player has to clear.
class GoogleAccount {
  GoogleAccount._();
  static final GoogleAccount instance = GoogleAccount._();

  /// The **Web** OAuth client id from the Google Cloud console, passed at
  /// build time:
  ///
  /// ```
  /// flutter build apk --release --dart-define=GOOGLE_SERVER_CLIENT_ID=...
  /// ```
  ///
  /// It is the Web credential even though this is an Android app: the phone
  /// signs in with the Android client, but the id token's audience is this
  /// "server client id", which is what the server checks against. Empty means
  /// the feature is simply off in this build.
  static const serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  /// Whether this build could sign in at all. The UI hides the button when
  /// false rather than offering something that always fails.
  static bool get configured => serverClientId.isNotEmpty;

  bool _initialised = false;
  bool _unavailable = false;

  /// True once we know the platform cannot do this (no Play Services, a
  /// desktop build, an emulator image without Google APIs).
  bool get unavailable => _unavailable;

  Future<bool> _ensureInitialised() async {
    if (_unavailable || !configured) return false;
    if (_initialised) return true;
    try {
      await GoogleSignIn.instance.initialize(serverClientId: serverClientId);
      _initialised = true;
      return true;
    } catch (e) {
      // An emulator without Google APIs lands here, which is a normal thing
      // to be running the game on.
      debugPrint('GoogleAccount: sign-in unavailable ($e)');
      _unavailable = true;
      return false;
    }
  }

  /// Prompts for an account and returns a fresh id token for the server.
  ///
  /// Returns null when the player backs out, or when signing in is not
  /// possible here — both are ordinary outcomes, not errors.
  Future<String?> signIn() async {
    if (!await _ensureInitialised()) return null;
    try {
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        _unavailable = true;
        return null;
      }
      final account = await GoogleSignIn.instance.authenticate();
      // Tokens expire, so this is used immediately and never stored.
      return account.authentication.idToken;
    } catch (e) {
      debugPrint('GoogleAccount: sign-in failed or was cancelled ($e)');
      return null;
    }
  }

  Future<void> signOut() async {
    if (!_initialised) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (e) {
      debugPrint('GoogleAccount: sign-out failed ($e)');
    }
  }
}
