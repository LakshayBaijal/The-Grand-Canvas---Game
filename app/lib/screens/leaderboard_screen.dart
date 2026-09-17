import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../models/round_models.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import '../widgets/ad_banner.dart';
import '../widgets/name_tag.dart';
import '../widgets/player_avatar.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/celebration.dart';
import '../services/audio_service.dart';

/// The global standings: everyone who has finished a ranked game, ordered by
/// the trophies they've collected.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({
    super.key,
    required this.connection,
    required this.myId,
  });

  final GameConnection connection;
  final String myId;

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  StreamSubscription<GameEvent>? _sub;
  List<LeaderboardEntry>? _entries;
  Profile? _me;

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen((event) {
      if (event is LeaderboardEvent && mounted) {
        setState(() {
          _entries = event.entries;
          _me = event.you;
        });
      }
    });
    widget.connection.getLeaderboard();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    AudioService.instance.play(Music.leaderboard);
    final entries = _entries;
    return Scaffold(
      bottomNavigationBar: const AdBanner(),
      appBar: AppBar(title: const Text('LEADERBOARD')),
      body: SafeArea(
        child: Column(
          children: [
            if (_me != null) _YourStanding(profile: _me!),
            Expanded(
              child: entries == null
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: GameColors.primary,
                      ),
                    )
                  : entries.isEmpty
                  ? const _EmptyBoard()
                  : RefreshIndicator(
                      color: GameColors.primary,
                      onRefresh: () async => widget.connection.getLeaderboard(),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        itemCount: entries.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) => PopIn(
                          // Only cascade the part you can actually see;
                          // a long board shouldn't stagger for 30 seconds.
                          index: i < 12 ? i : 12,
                          child: _Row(
                            entry: entries[i],
                            isMe: entries[i].id == widget.myId,
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _YourStanding extends StatelessWidget {
  const _YourStanding({required this.profile});

  final Profile profile;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: GameDecor.panel(accent: GameColors.primary),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'YOU',
                style: TextStyle(
                  color: GameColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                profile.rank == null ? '—' : '#${profile.rank}',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: GameColors.primary,
                ),
              ),
              Text(
                profile.isPlacing
                    ? '${profile.placementsLeft} to place'
                    : profile.league.name,
                style: const TextStyle(
                  color: GameColors.cyan,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Rating first: it's what the board is ordered by. Trophies stay as
          // the career number, which is a different (and safer) kind of pride.
          _Stat(label: 'RATING', value: profile.rating),
          const SizedBox(width: 20),
          _Stat(label: 'TROPHIES', value: profile.trophies),
          const SizedBox(width: 20),
          _Stat(label: 'WINS', value: profile.wins),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: GameColors.textMuted,
            fontSize: 9,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 3),
        CountUp(
          value: value,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.isMe});

  final LeaderboardEntry entry;
  final bool isMe;

  /// Medal colours for the podium, plain numbers below it.
  static const _medals = {
    1: GameColors.primary,
    2: Color(0xFFC7CDD9),
    3: Color(0xFFD98756),
  };

  @override
  Widget build(BuildContext context) {
    final medal = _medals[entry.rank];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: GameDecor.panel(
        accent: isMe ? GameColors.primary : null,
        radius: 14,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: medal != null
                ? SketchIcon(SketchGlyph.medal, size: 22, color: medal)
                : Text(
                    '${entry.rank}',
                    style: const TextStyle(
                      color: GameColors.textMuted,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: PlayerAvatar(
              name: entry.nickname,
              radius: 16,
              color: isMe ? GameColors.primary : GameColors.surfaceHigh,
              textColor: isMe ? const Color(0xFF16123A) : GameColors.textPrimary,
              avatarUrl: entry.avatarUrl,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NameTag(
                  name: entry.nickname,
                  tier: entry.tier,
                  crown: entry.crown,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: isMe ? GameColors.primary : GameColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${entry.league.name} · ${entry.wins} won',
                  style: const TextStyle(color: GameColors.cyan, fontSize: 12),
                ),
              ],
            ),
          ),
          CountUp(
            value: entry.rating,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class _EmptyBoard extends StatelessWidget {
  const _EmptyBoard();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(36),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SketchIcon(SketchGlyph.trophy, size: 48, color: GameColors.primary),
            SizedBox(height: 16),
            Text(
              'Nobody has finished a ranked game yet',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 8),
            Text(
              'Play Ranked to put your name up here. Friendly games are just '
              'for fun and never count.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: GameColors.textMuted,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
