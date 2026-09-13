import 'dart:async';

import 'package:flutter/material.dart';

import '../models/game_event.dart';
import '../services/game_connection.dart';
import '../theme.dart';
import 'sketch_icons.dart';

/// The friends list, as a widget any sheet can embed: who's online, who's
/// in a room you can join, who's asked to be your friend.
///
/// Friends are made from a table (tap a seat), a reveal (tap a drawing) or
/// the Hall of Fame, never by searching a name: you become friends with
/// people you've played with, which is the only kind worth having in a
/// party game. Everything here is live; the server pushes a fresh list
/// whenever anything changes.
class FriendsList extends StatefulWidget {
  const FriendsList({
    super.key,
    required this.connection,
    this.onJoin,
    this.inviteFromRoom = false,
    this.compact = false,
  });

  final GameConnection connection;

  /// A friend is sitting in an open room: join it by code.
  final void Function(String code)? onJoin;

  /// True inside a friendly lobby: online friends get an INVITE button
  /// instead of JOIN.
  final bool inviteFromRoom;

  /// A shorter list with no headings, for the sheet on the home screen.
  final bool compact;

  @override
  State<FriendsList> createState() => _FriendsListState();
}

class _FriendsListState extends State<FriendsList> {
  StreamSubscription<GameEvent>? _sub;
  FriendsEvent? _friends;
  final _invited = <String>{};

  @override
  void initState() {
    super.initState();
    _sub = widget.connection.events.listen((event) {
      if (!mounted) return;
      if (event is FriendsEvent) setState(() => _friends = event);
      if (event is FriendResultEvent) {
        final text = switch (event.result) {
          'sent' => 'Asked ${event.nickname} to be friends',
          'accepted' => "You and ${event.nickname} are friends now",
          'already' => "You're already friends with ${event.nickname}",
          'pending' => 'Already asked ${event.nickname}; waiting on them',
          'self' => "That's you",
          _ => "Couldn't find that player",
        };
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(text)));
      }
    });
    widget.connection.listFriends();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final f = _friends;
    if (f == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 14),
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: GameColors.primary,
            ),
          ),
        ),
      );
    }
    if (f.friends.isEmpty && f.incoming.isEmpty && f.outgoing.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 10),
        child: Text(
          'No friends yet. Tap someone at a table, or a drawing in the reveal '
          'or the Hall of Fame, to add them.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: GameColors.textMuted,
            fontSize: 12.5,
            height: 1.4,
          ),
        ),
      );
    }
    final online = f.friends.where((x) => x.online).toList();
    final offline = f.friends.where((x) => !x.online).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final r in f.incoming)
          _Request(row: r, connection: widget.connection),
        for (final x in online) _friendRow(x),
        for (final x in offline) _friendRow(x),
        if (!widget.compact)
          for (final r in f.outgoing)
            _Line(
              dot: GameColors.textMuted,
              name: r.nickname,
              note: 'asked · waiting',
              trailing: TextButton(
                onPressed: () => widget.connection.removeFriend(r.id),
                child: const Text('CANCEL', style: TextStyle(fontSize: 11)),
              ),
            ),
      ],
    );
  }

  Widget _friendRow(FriendEntry x) {
    Widget? trailing;
    String note;
    if (!x.online) {
      note = 'offline';
    } else if (widget.inviteFromRoom) {
      final done = _invited.contains(x.id);
      note = done ? 'invited' : 'online';
      trailing = FilledButton.tonal(
        onPressed: done
            ? null
            : () {
                widget.connection.inviteFriend(x.id);
                setState(() => _invited.add(x.id));
              },
        child: Text(
          done ? 'SENT' : 'INVITE',
          style: const TextStyle(fontSize: 11),
        ),
      );
    } else if (x.roomCode != null && widget.onJoin != null) {
      note = 'in a room · ${x.roomCode}';
      trailing = FilledButton(
        onPressed: () => widget.onJoin!(x.roomCode!),
        child: const Text('JOIN', style: TextStyle(fontSize: 11)),
      );
    } else {
      note = 'online';
    }
    return _Line(
      dot: x.online
          ? GameColors.lime
          : GameColors.textMuted.withValues(alpha: 0.4),
      name: x.nickname,
      note: note,
      trailing: trailing,
      onLongPress: () => _confirmRemove(x),
    );
  }

  Future<void> _confirmRemove(FriendEntry x) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: GameColors.surfaceHigh,
        title: Text('Unfriend ${x.nickname}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('KEEP'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('UNFRIEND'),
          ),
        ],
      ),
    );
    if (ok == true) widget.connection.removeFriend(x.id);
  }
}

class _Request extends StatelessWidget {
  const _Request({required this.row, required this.connection});
  final FriendRow row;
  final GameConnection connection;

  @override
  Widget build(BuildContext context) {
    return _Line(
      dot: GameColors.primary,
      name: row.nickname,
      note: 'wants to be friends',
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextButton(
            onPressed: () => connection.removeFriend(row.id),
            child: const Text('NO', style: TextStyle(fontSize: 11)),
          ),
          FilledButton(
            onPressed: () => connection.acceptFriend(row.id),
            child: const Text('YES', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({
    required this.dot,
    required this.name,
    required this.note,
    this.trailing,
    this.onLongPress,
  });
  final Color dot;
  final String name;
  final String note;
  final Widget? trailing;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onLongPress,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    note,
                    style: const TextStyle(
                      color: GameColors.textMuted,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

/// From inside a friendly room: online friends with an INVITE next to each.
Future<void> showInviteFriendsSheet(
  BuildContext context,
  GameConnection connection,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 14, 22, 26),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF221B52), GameColors.surface],
        ),
        border: Border.all(
          color: GameColors.lime.withValues(alpha: 0.5),
          width: 1.6,
        ),
        boxShadow: GameDecor.glow(GameColors.lime, strength: 0.6),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              SketchIcon(SketchGlyph.sparkle, size: 16, color: GameColors.lime),
              SizedBox(width: 8),
              Text(
                'INVITE FRIENDS',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.6,
                  color: GameColors.lime,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Anyone online gets a pop-up with a JOIN button.',
            style: TextStyle(color: GameColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.5,
            ),
            child: SingleChildScrollView(
              child: FriendsList(connection: connection, inviteFromRoom: true),
            ),
          ),
        ],
      ),
    ),
  );
}
