import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/lobby_state.dart';
import '../theme.dart';

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
  });

  final LobbyState lobby;
  final String myId;
  final VoidCallback onStart;
  final VoidCallback onAddBot;
  final VoidCallback onRemoveBot;

  bool get _isHost => lobby.hostId == myId;
  bool get _canStart => lobby.players.length >= _minPlayers;
  bool get _hasBots => lobby.players.any((p) => p.isBot);
  bool get _hasRoom => lobby.players.length < _maxPlayers;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LOBBY')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              _RoomCodeCard(code: lobby.code),
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('PLAYERS', style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    '${lobby.players.length}/5',
                    style: const TextStyle(color: GameColors.textMuted),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: lobby.players.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final player = lobby.players[index];
                    final color = GameColors.forIndex(index);
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: GameColors.surface,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: color,
                            child: Text(
                              player.nickname.characters.first.toUpperCase(),
                              style: const TextStyle(
                                color: Color(0xFF16123A),
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              player.nickname,
                              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                            ),
                          ),
                          if (player.isBot)
                            Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: GameColors.surfaceHigh,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'CPU',
                                style: TextStyle(
                                  color: GameColors.textMuted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          if (player.id == myId)
                            const Padding(
                              padding: EdgeInsets.only(right: 8),
                              child: Text('YOU', style: TextStyle(color: GameColors.textMuted)),
                            ),
                          if (player.id == lobby.hostId)
                            const Icon(Icons.star_rounded, color: GameColors.primary),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              if (_isHost) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _hasRoom ? onAddBot : null,
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                        label: const Text('ADD PLAYER'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(46),
                          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    if (_hasBots) ...[
                      const SizedBox(width: 10),
                      OutlinedButton(
                        onPressed: onRemoveBot,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(56, 46),
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
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  alignment: Alignment.center,
                  child: const Text(
                    'Waiting for the host to start…',
                    style: TextStyle(color: GameColors.textMuted, fontSize: 16),
                  ),
                ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomCodeCard extends StatelessWidget {
  const _RoomCodeCard({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 22),
      decoration: BoxDecoration(
        color: GameColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: GameColors.surfaceHigh, width: 2),
      ),
      child: Column(
        children: [
          const Text(
            'ROOM CODE',
            style: TextStyle(color: GameColors.textMuted, letterSpacing: 3, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Text(
            code,
            style: const TextStyle(
              fontSize: 52,
              fontWeight: FontWeight.w900,
              letterSpacing: 10,
              color: GameColors.primary,
            ),
          ),
          const SizedBox(height: 4),
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Room code copied')),
                );
              }
            },
            icon: const Icon(Icons.copy, size: 16, color: GameColors.textMuted),
            label: const Text(
              'Share with friends',
              style: TextStyle(color: GameColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
