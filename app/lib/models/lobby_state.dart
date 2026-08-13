class Player {
  const Player({required this.id, required this.nickname, required this.isBot});

  final String id;
  final String nickname;
  final bool isBot;

  factory Player.fromJson(Map<String, dynamic> json) => Player(
        id: json['id'] as String,
        nickname: json['nickname'] as String,
        isBot: json['isBot'] as bool? ?? false,
      );
}

class LobbyState {
  const LobbyState({required this.code, required this.hostId, required this.players});

  final String code;
  final String hostId;
  final List<Player> players;

  factory LobbyState.fromJson(Map<String, dynamic> json) => LobbyState(
        code: json['code'] as String,
        hostId: json['hostId'] as String,
        players: (json['players'] as List)
            .map((p) => Player.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}
