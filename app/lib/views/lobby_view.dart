import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../models/game_event.dart';
import '../models/lobby_state.dart';
import '../models/round_models.dart';
import '../theme.dart';
import '../widgets/ad_banner.dart';
import '../widgets/sketch_icons.dart';
import '../widgets/doodle_stage.dart';

// Kept in sync with MIN_PLAYERS_TO_START on the server (temporarily 1 for
// solo testing — bump back to 3 for real games).
const _minPlayers = 1;

/// Ranked tables seat five; a friendly room seats ten, because a party is
/// as big as the group chat. Mirrors MAX_PLAYERS / FRIENDLY_MAX_PLAYERS on
/// the server, which is what actually enforces it.
const _rankedMaxPlayers = 5;
const _friendlyMaxPlayers = 10;

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
    required this.onSetVisibility,
    required this.onAddFriend,
    required this.onInviteFriends,
  });

  final LobbyState lobby;
  final String myId;
  final VoidCallback onStart;
  final VoidCallback onAddBot;
  final VoidCallback onRemoveBot;

  /// The drawing currently being replayed on the lobby's idle canvas.
  final DoodleEvent? doodle;
  final VoidCallback onNextDoodle;

  /// Host-only: list this room in the browser, or hide it.
  final void Function({required bool isPublic}) onSetVisibility;

  /// Tap a seat to ask its player to be your friend.
  final void Function(String playerId) onAddFriend;

  /// Friendly rooms only: pull online friends in by name.
  final VoidCallback onInviteFriends;

  bool get _isFriendly => lobby.mode == GameMode.friendly;
  // Ranked lobbies fill themselves and start themselves; there's no host to
  // press anything, so none of the host controls apply.
  bool get _isHost => _isFriendly && lobby.hostId == myId;
  bool get _canStart => lobby.players.length >= _minPlayers;
  bool get _hasBots => lobby.players.any((p) => p.isBot);
  int get _maxPlayers => _isFriendly ? _friendlyMaxPlayers : _rankedMaxPlayers;
  bool get _hasRoom => lobby.players.length < _maxPlayers;

  /// Tap someone at the table: add them as a friend. Bots don't have
  /// friends, and the server would say so; better not to offer.
  void _playerMenu(BuildContext context, Player player) {
    if (player.id == myId || player.isBot) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheet) => SafeArea(
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
          decoration: BoxDecoration(
            color: GameColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: GameColors.border),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  player.nickname,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.person_add_alt_1_rounded,
                  color: GameColors.primary,
                ),
                title: const Text(
                  'Add as a friend',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
                subtitle: const Text(
                  'Play together any time. They have to say yes.',
                  style: TextStyle(color: GameColors.textMuted, fontSize: 12),
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                onTap: () {
                  Navigator.of(sheet).pop();
                  onAddFriend(player.id);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: const AdBanner(),
      appBar: AppBar(
        title: Text(_isFriendly ? 'FRIENDLY LOBBY' : 'RANKED MATCH'),
      ),
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
              // Only the host can change who can find the room, and only
              // while it is still a lobby.
              if (_isHost) ...[
                const SizedBox(height: 8),
                _VisibilityBar(
                  isPublic: lobby.isPublic,
                  onChanged: (v) => onSetVisibility(isPublic: v),
                ),
              ],
              const SizedBox(height: 12),
              // The idle canvas takes whatever room the lobby isn't using —
              // waiting for people to join is the dullest part of a party
              // game, so there's always something being drawn here.
              Expanded(
                child: DoodleStage(doodle: doodle, onNext: onNextDoodle),
              ),
              const SizedBox(height: 14),
              _PlayerRow(
                lobby: lobby,
                myId: myId,
                maxPlayers: _maxPlayers,
                onTapPlayer: (p) => _playerMenu(context, p),
              ),
              if (_isFriendly) ...[
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: onInviteFriends,
                  icon: const Icon(Icons.group_add_rounded, size: 18),
                  label: const Text('INVITE FRIENDS'),
                ),
              ],
              const SizedBox(height: 14),
              if (_isHost) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _hasRoom ? onAddBot : null,
                        icon: const Icon(
                          Icons.person_add_alt_1_rounded,
                          size: 18,
                        ),
                        label: const Text('ADD PLAYER'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(44),
                          textStyle: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
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
                        child: const Icon(
                          Icons.person_remove_alt_1_rounded,
                          size: 18,
                        ),
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
                    style: const TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 15,
                    ),
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
/// for the seats still open. One row always: a ten-seat friendly room
/// scrolls sideways rather than wrapping, so the table reads the same at
/// any size and the canvas keeps its space.
class _PlayerRow extends StatelessWidget {
  const _PlayerRow({
    required this.lobby,
    required this.myId,
    required this.maxPlayers,
    required this.onTapPlayer,
  });

  final LobbyState lobby;
  final String myId;
  final int maxPlayers;
  final void Function(Player) onTapPlayer;

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
              '${lobby.players.length}/$maxPlayers',
              style: const TextStyle(color: GameColors.textMuted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 72,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: maxPlayers,
            separatorBuilder: (_, _) => const SizedBox(width: 6),
            itemBuilder: (context, i) => SizedBox(
              width: 64,
              child: i < lobby.players.length
                  ? GestureDetector(
                      onTap: () => onTapPlayer(lobby.players[i]),
                      behavior: HitTestBehavior.opaque,
                      child: _PlayerChip(
                        player: lobby.players[i],
                        color: GameColors.forIndex(i),
                        isMe: lobby.players[i].id == myId,
                        isHost: lobby.players[i].id == lobby.hostId,
                      ),
                    )
                  : const _EmptySeat(),
            ),
          ),
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
            SketchFrame(
              radius: 19,
              child: CircleAvatar(
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
            ),
            if (isHost)
              const Positioned(
                top: -4,
                right: -4,
                child: SketchIcon(
                  SketchGlyph.star,
                  size: 16,
                  color: GameColors.primary,
                ),
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
          child: const Icon(
            Icons.person_outline,
            size: 18,
            color: GameColors.surfaceHigh,
          ),
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

/// Host-only control over whether the room is listed in the browser.
///
/// Worded as what it does to other people rather than as "public/private",
/// and it always says the code still works — hiding a room reads like it
/// might lock out the friend you already sent the code to, and it doesn't.
class _VisibilityBar extends StatelessWidget {
  const _VisibilityBar({required this.isPublic, required this.onChanged});

  final bool isPublic;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: GameColors.surfaceHigh.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: GameColors.border),
      ),
      child: Row(
        children: [
          SketchIcon(
            isPublic ? SketchGlyph.lockOpen : SketchGlyph.lock,
            size: 16,
            color: isPublic ? GameColors.lime : GameColors.textMuted,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isPublic ? 'Anyone can find this room' : 'Code only',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  isPublic
                      ? 'It is listed for other players on this server.'
                      : 'Hidden from the list. The code still works.',
                  style: const TextStyle(
                    color: GameColors.textMuted,
                    fontSize: 10.5,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: isPublic,
            onChanged: onChanged,
            activeThumbColor: GameColors.lime,
          ),
        ],
      ),
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
      decoration: GameDecor.panel(accent: GameColors.primary, radius: 18),
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
            tooltip: 'Copy the code',
          ),
          // Hands the code to WhatsApp/Messages/anything else, which is how
          // people actually invite each other — copying still leaves them to
          // find the app and type a message themselves.
          IconButton(
            onPressed: () => SharePlus.instance.share(
              ShareParams(
                text: 'Join my Grand Canvas game! Room code: $code',
                subject: 'Grand Canvas',
              ),
            ),
            icon: const SketchIcon(SketchGlyph.sparkle, size: 18),
            color: GameColors.primary,
            tooltip: 'Invite friends',
          ),
        ],
      ),
    );
  }
}
