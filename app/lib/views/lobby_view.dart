import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/doodle_stage.dart';

// Kept in sync with MIN_PLAYERS_TO_START on the server (temporarily 1 for
// solo testing — bump back to 3 for real games).
const _minPlayers = 1;

const _maxPlayers = 5;

class LobbyView extends StatelessWidget {
  const LobbyView({
    super.key,
    required this.lobby,
    required this.myId,
    required this.onStart,
    required this.onAddBot,
    required this.onRemoveBot,
    required this.doodle,
    required this.onNextDoodle,
  });

  final LobbyState lobby;
  final String myId;
  final VoidCallback onStart;
  final VoidCallback onAddBot;
  final VoidCallback onRemoveBot;

  /// The drawing currently being replayed on the lobby's idle canvas.
  final DoodleEvent? doodle;
  final VoidCallback onNextDoodle;

  bool get _isFriendly => lobby.mode == GameMode.friendly;
  // Ranked lobbies fill themselves and start themselves; there's no host to
  // press anything, so none of the host controls apply.
  bool get _isHost => _isFriendly && lobby.hostId == myId;
  bool get _canStart => lobby.players.length >= _minPlayers;
  bool get _hasBots => lobby.players.any((p) => p.isBot);
  bool get _hasRoom => lobby.players.length < _maxPlayers;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isFriendly ? 'FRIENDLY LOBBY' : 'RANKED MATCH')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 4),
              // Only friendly games are joinable by code; showing one for a
              // ranked match would just invite people to try it.
              if (_isFriendly) _RoomCodeBar(code: lobby.code),
              const SizedBox(height: 12),
              // The idle canvas takes whatever room the lobby isn't using —
              // waiting for people to join is the dullest part of a party
              // game, so there's always something being drawn here.
              Expanded(child: DoodleStage(doodle: doodle, onNext: onNextDoodle)),
              const SizedBox(height: 14),
              _PlayerRow(lobby: lobby, myId: myId),
              const SizedBox(height: 14),
              if (_isHost) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _hasRoom ? onAddBot : null,
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                        label: const Text('ADD PLAYER'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(44),
                          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    if (_hasBots) ...[
                      const SizedBox(width: 10),
                      OutlinedButton(
                        onPressed: onRemoveBot,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(56, 44),
                          padding: EdgeInsets.zero,
                        ),
                        child: const Icon(Icons.person_remove_alt_1_rounded, size: 18),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _canStart ? onStart : null,
                  child: Text(
                    _canStart
                        ? 'START GAME'
                        : 'NEED ${_minPlayers - lobby.players.length} MORE PLAYER'
                            '${_minPlayers - lobby.players.length == 1 ? '' : 'S'}',
                  ),
                ),
              ] else
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  child: Text(
                    _isFriendly
                        ? 'Waiting for the host to start…'
                        : 'Starting…',
                    style: const TextStyle(color: GameColors.textMuted, fontSize: 15),
                  ),
                ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

/// Everyone in the room as a single row of avatars, plus dimmed placeholders
/// for the seats still open — compact enough to leave the canvas the space.
class _PlayerRow extends StatelessWidget {
  const _PlayerRow({required this.lobby, required this.myId});

  final LobbyState lobby;
  final String myId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'PLAYERS',
              style: TextStyle(
                color: GameColors.textMuted,
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              '${lobby.players.length}/$_maxPlayers',
              style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            for (var i = 0; i < _maxPlayers; i++)
              Expanded(
                child: i < lobby.players.length
                    ? _PlayerChip(
                        player: lobby.players[i],
                        color: GameColors.forIndex(i),
                        isMe: lobby.players[i].id == myId,
                        isHost: lobby.players[i].id == lobby.hostId,
                      )
                    : const _EmptySeat(),
              ),
          ],
        ),
      ],
    );
  }
}

/// Everyone in the room looks the same. Seats filled by the server are
/// deliberately indistinguishable from people — the game is more fun when you
/// assume you're up against a person, and telling you otherwise only ever
/// makes a lobby feel emptier than it plays.
class _PlayerChip extends StatelessWidget {
  const _PlayerChip({
    required this.player,
    required this.color,
    required this.isMe,
    required this.isHost,
  });

  final Player player;
  final Color color;
  final bool isMe;
  final bool isHost;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              radius: 19,
              backgroundColor: color,
              child: Text(
                player.nickname.characters.first.toUpperCase(),
                style: const TextStyle(
                  color: Color(0xFF16123A),
                  fontWeight: FontWeight.w900,
                  fontSize: 17,
                ),
              ),
            ),
            if (isHost)
              const Positioned(
                top: -4,
                right: -4,
                child: Icon(Icons.star_rounded, size: 16, color: GameColors.primary),
              ),
          ],
        ),
        const SizedBox(height: 7),
        Text(
          isMe ? 'YOU' : player.nickname,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: isMe ? GameColors.primary : GameColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _EmptySeat extends StatelessWidget {
  const _EmptySeat();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: GameColors.surfaceHigh, width: 2),
          ),
          child: const Icon(Icons.person_outline, size: 18, color: GameColors.surfaceHigh),
        ),
        const SizedBox(height: 7),
        const Text(
          'OPEN',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: GameColors.surfaceHigh,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

/// The room code, kept to one line so the canvas gets the vertical space.
class _RoomCodeBar extends StatelessWidget {
  const _RoomCodeBar({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        color: GameColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: GameColors.surfaceHigh, width: 2),
      ),
      child: Row(
        children: [
          const Text(
            'ROOM\nCODE',
            style: TextStyle(
              color: GameColors.textMuted,
              letterSpacing: 2,
              fontSize: 9,
              height: 1.3,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              code,
              style: const TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                letterSpacing: 7,
                color: GameColors.primary,
              ),
            ),
          ),
          IconButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Room code copied')),
                );
              }
            },
            icon: const Icon(Icons.copy_rounded, size: 18),
            color: GameColors.textMuted,
            tooltip: 'Share with friends',
          ),
        ],
      ),
    );
  }
}
