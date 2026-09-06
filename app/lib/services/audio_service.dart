import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Which piece of music belongs to which screen.
///
/// Every one of these is a variation on the same four-note motif, so moving
/// between them reads as one score following the player rather than a set of
/// unrelated loops.
enum Music {
  /// Boot and menu are deliberately the same file. The theme is a 65-second
  /// piece with a shape — hook, answer, turn, climb, payoff — and boot is over
  /// in a couple of seconds, so pointing them at separate tracks meant nobody
  /// ever heard past its first phrase. Sharing the file lets [play] carry one
  /// continuous performance from launch into the menu without a restart.
  title('theme.mp3'),
  menu('theme.mp3'),
  lobby('lobby.mp3'),
  matchmaking('matchmaking.mp3'),
  prompt('prompt.mp3', gain: 0.8),
  drawing('drawing.mp3', gain: 0.5),
  waiting('waiting.mp3', gain: 0.7),
  presentation('presentation.mp3'),
  voting('voting.mp3'),
  reveal('reveal.mp3'),
  results('results.mp3'),
  leaderboard('leaderboard.mp3', gain: 0.85);

  const Music(this.file, {this.gain = 1.0});
  final String file;

  /// How loud this track sits relative to the others.
  ///
  /// It has to live here rather than in the composition: the renderer
  /// peak-normalises every track to the same ceiling, so a piece written to be
  /// sparse still arrives at full volume. The screens where the player is
  /// concentrating — drawing especially — need the score to drop back and stay
  /// out of the way, and this is the only place that can happen.
  final double gain;
}

/// Short one-shots fired on top of whatever music is playing.
enum Sfx {
  /// The signature that plays once at launch. Louder than the rest on purpose:
  /// it is the only sound with nothing underneath it.
  launch('sting_launch.mp3', gain: 1.0),
  win('sting_win.mp3'),
  lose('sting_lose.mp3'),
  correct('sting_correct.mp3'),
  roundStart('sting_round.mp3'),
  trophy('sting_trophy.mp3');

  const Sfx(this.file, {this.gain = 1.4});
  final String file;

  /// Relative to the music volume. Most stings sit above the loop so they
  /// read over it.
  final double gain;
}

/// Music and sound for the whole game.
///
/// Two things make this more than a wrapper around a player:
///
///  * **Crossfading.** Cutting from one loop to another at a phase change is
///    jarring, and phases change often. Switching ramps the outgoing track
///    down while the incoming one comes up, over [_fadeMs].
///  * **Idempotent [play].** Screens call `play(Music.x)` freely from `build`
///    and from event handlers; asking for the track that's already playing is
///    a no-op rather than a restart. Without that, any rebuild would stutter
///    the music.
///
/// Muting is remembered on the device — someone who turns the music off should
/// not have to do it again every launch.
class AudioService extends ChangeNotifier {
  AudioService._();
  static final AudioService instance = AudioService._();

  static const _fadeMs = 550;
  static const _musicPrefsKey = 'audio_music_on';
  static const _sfxPrefsKey = 'audio_sfx_on';
  static const _volumePrefsKey = 'audio_music_volume';

  /// Two players so one can fade out while the other fades in.
  AudioPlayer? _a;
  AudioPlayer? _b;
  bool _usingA = true;
  AudioPlayer? get _current => _usingA ? _a : _b;
  AudioPlayer? get _other => _usingA ? _b : _a;

  final _sfxPlayer = AudioPlayer();

  Music? _playing;
  Music? get playing => _playing;

  /// The gain of the track currently fading out, so a crossfade ramps each
  /// side down and up at its own level rather than snapping the old track to
  /// the new one's.
  double _outgoingGain = 1.0;

  bool _musicOn = true;
  bool _sfxOn = true;
  double _volume = 0.55;
  bool _loaded = false;
  bool _failed = false;

  bool get musicOn => _musicOn;
  bool get sfxOn => _sfxOn;
  double get volume => _volume;

  /// True when audio could not be initialised at all (an emulator with no
  /// audio device, a locked-down platform). The UI hides its controls rather
  /// than offering switches that do nothing.
  bool get unavailable => _failed;

  Timer? _fadeTimer;

  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      _musicOn = prefs.getBool(_musicPrefsKey) ?? true;
      _sfxOn = prefs.getBool(_sfxPrefsKey) ?? true;
      _volume = prefs.getDouble(_volumePrefsKey) ?? 0.55;

      _a = AudioPlayer();
      _b = AudioPlayer();
      for (final p in [_a!, _b!]) {
        await p.setReleaseMode(ReleaseMode.loop);
        await p.setVolume(0);
      }
      // Stingers must not interrupt the music, and must be able to overlap
      // each other (a trophy landing while a win fanfare rings).
      await _sfxPlayer.setReleaseMode(ReleaseMode.release);
      await _sfxPlayer.setPlayerMode(PlayerMode.lowLatency);
    } catch (e) {
      _failed = true;
      debugPrint('AudioService: audio unavailable ($e)');
    }
    notifyListeners();
  }

  /// Starts [music], crossfading from whatever is playing.
  ///
  /// Safe to call repeatedly with the same value — that's the normal case,
  /// since screens call this on every build.
  Future<void> play(Music music, {bool loop = true}) async {
    if (_failed) return;
    if (!_loaded) await load();
    if (_playing == music) return;
    // Two screens can share a track — boot and the menu both play the theme.
    // Crossfading a file to itself would restart it half a second in, so when
    // only the label changed, record the change and leave the audio running.
    if (_playing != null && _playing!.file == music.file && _playing!.gain == music.gain) {
      _playing = music;
      notifyListeners();
      return;
    }
    _playing = music;
    notifyListeners();
    if (!_musicOn) return;

    final incoming = _other;
    final outgoing = _current;
    if (incoming == null) return;
    final outGain = _outgoingGain;
    _outgoingGain = music.gain;

    try {
      await incoming.setReleaseMode(loop ? ReleaseMode.loop : ReleaseMode.release);
      await incoming.setVolume(0);
      await incoming.play(AssetSource('audio/${music.file}'));
      _usingA = !_usingA;
      _crossfade(from: outgoing, to: incoming, toGain: music.gain, fromGain: outGain);
    } catch (e) {
      debugPrint('AudioService: could not play ${music.file} ($e)');
    }
  }

  /// Ramps [from] down and [to] up together. Stepped rather than continuous —
  /// audioplayers has no built-in fade, and 25ms steps are well below what
  /// anyone hears as stepping.
  void _crossfade({
    AudioPlayer? from,
    required AudioPlayer to,
    double toGain = 1.0,
    double fromGain = 1.0,
  }) {
    _fadeTimer?.cancel();
    const stepMs = 25;
    final steps = (_fadeMs / stepMs).round();
    var i = 0;
    _fadeTimer = Timer.periodic(const Duration(milliseconds: stepMs), (t) async {
      i++;
      final k = (i / steps).clamp(0.0, 1.0);
      try {
        await to.setVolume(_volume * toGain * k);
        await from?.setVolume(_volume * fromGain * (1 - k));
        if (k >= 1) {
          t.cancel();
          await from?.stop();
        }
      } catch (_) {
        t.cancel();
      }
    });
  }

  Future<void> stopMusic() async {
    if (_failed) return;
    _fadeTimer?.cancel();
    _playing = null;
    try {
      await _a?.stop();
      await _b?.stop();
    } catch (_) {}
    notifyListeners();
  }

  Future<void> sfx(Sfx sound) async {
    if (_failed || !_sfxOn) return;
    if (!_loaded) await load();
    try {
      // Slightly above the music so a stinger reads over a loop.
      await _sfxPlayer.setVolume((_volume * sound.gain).clamp(0.0, 1.0));
      await _sfxPlayer.play(AssetSource('audio/${sound.file}'));
    } catch (e) {
      debugPrint('AudioService: could not play ${sound.file} ($e)');
    }
  }

  Future<void> setMusicOn(bool on) async {
    _musicOn = on;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_musicPrefsKey, on);
    if (_failed) return;
    if (!on) {
      _fadeTimer?.cancel();
      try {
        await _a?.stop();
        await _b?.stop();
      } catch (_) {}
    } else if (_playing != null) {
      // Turning it back on resumes whatever screen we're on.
      final want = _playing!;
      _playing = null;
      await play(want);
    }
  }

  Future<void> setSfxOn(bool on) async {
    _sfxOn = on;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_sfxPrefsKey, on);
  }

  Future<void> setVolume(double v) async {
    _volume = v.clamp(0.0, 1.0);
    notifyListeners();
    if (!_failed) {
      try {
        await _current?.setVolume(_musicOn ? _volume : 0);
      } catch (_) {}
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_volumePrefsKey, _volume);
  }

  @override
  void dispose() {
    _fadeTimer?.cancel();
    _a?.dispose();
    _b?.dispose();
    _sfxPlayer.dispose();
    super.dispose();
  }
}
