import 'round_models.dart';

class Player {
  const Player({
    required this.id,
    required this.nickname,
    required this.isBot,
    this.tier = 'bronze',
    this.crown = false,
    this.avatarUrl,
  });

  final String id;
  final String nickname;
  final bool isBot;

  /// Google profile picture, for players who signed in. Null otherwise.
  final String? avatarUrl;

  /// Trophy tier badge ('bronze' / 'silver' / 'gold') and Grand Pass crown:
  /// what the rest of the table gets to see next to the name.
  final String tier;
  final bool crown;

  factory Player.fromJson(Map<String, dynamic> json) => Player(
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        isBot: json['isBot'] as bool? ?? false,
        tier: json['tier'] as String? ?? 'bronze',
        crown: json['crown'] as bool? ?? false,
        avatarUrl: json['avatar'] as String?,
      );
}

class LobbyState {
  const LobbyState({
    required this.code,
    required this.hostId,
    required this.mode,
    required this.players,
    this.isPublic = false,
  });

  final String code;
  final String hostId;
  final GameMode mode;
  final List<Player> players;

  /// Whether this game is listed in the lobby browser. Hiding it never stops
  /// anyone who already has the code from joining.
  final bool isPublic;

  factory LobbyState.fromJson(Map<String, dynamic> json) => LobbyState(
        code: json['code'] as String,
        hostId: json['hostId'] as String,
        mode: GameMode.fromJson(json['mode'] as String),
        players: (json['players'] as List)
            .map((p) => Player.fromJson(p as Map<String, dynamic>))
            .toList(),
        // Older servers don't send this; an unlisted game is the safe default.
        isPublic: json['visibility'] == 'public',
      );
}

/// One row in the lobby browser — a friendly game currently open to join.
class OpenLobby {
  const OpenLobby({
    required this.code,
    required this.hostName,
    required this.players,
    required this.maxPlayers,
    required this.bots,
  });

  final String code;
  final String hostName;
  final int players;
  final int maxPlayers;

  /// Bots already seated, shown so nobody joins expecting all humans.
  final int bots;

  int get humans => players - bots;
  int get freeSeats => maxPlayers - players;

  factory OpenLobby.fromJson(Map<String, dynamic> json) => OpenLobby(
        code: json['code'] as String,
        hostName: json['hostName'] as String,
        players: json['players'] as int,
        maxPlayers: json['maxPlayers'] as int,
        bots: json['bots'] as int? ?? 0,
      );
}
