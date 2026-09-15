// Wire protocol between Flutter clients and the game server.

/** What everyone at the table can see about a player. `tier` is the trophy
 *  badge (bronze/silver/gold) and `crown` marks a Grand Pass owner -- both
 *  travel with the name everywhere it is shown, because the point of a badge
 *  is that other people see it. */
export type PlayerInfo = { id: string; nickname: string; isBot: boolean; tier: string; crown: boolean };

/** Ranked games are matchmade with strangers and move the global leaderboard.
 *  Friendly games are private, code-joined, bot-fillable, and score nothing —
 *  deliberately kept separate so nobody can farm trophies against their own
 *  bots. */
export type GameMode = "ranked" | "friendly";

/** How a round is voted on. Ranked games hand out a budget to invest; friendly
 *  games just pick a 1st, 2nd and 3rd. */
export type Scoring = "money" | "points";

/** Coordinates are normalized to the 0..1 range so drawings render
 *  correctly regardless of each device's actual screen size. */
export type Point = { x: number; y: number };

export type Stroke = {
  color: string; // hex, e.g. "#FF0000"
  width: number;
  points: Point[];
  /** How the line is drawn ("pen", "marker", "crayon", ...). Cosmetic only,
   *  and passed straight through — the server never interprets it. Absent
   *  means the default pen. */
  style?: string;
};

export type DrawingEntry = {
  artistId: string;
  artistName: string;
  artistTier?: string;
  artistCrown?: boolean;
  title: string;
  strokes: Stroke[];
  /** The sheet the artist drew on. Cosmetic, passed through untouched. */
  paper?: string;
};

/** One drawing in a day's gallery. */
export type DailyEntry = DrawingEntry & {
  id: number;
  day: number;
  createdMs: number;
  /** Hearts given by other players. One each, never taken back. */
  hearts: number;
  heartedByMe: boolean;
  /** 1..3 when this is one of the day's top three. */
  rank?: number;
};

/** One finished day in the hall of fame: its prompt and its top three. */
export type HallDay = { day: number; prompt: string; top: DailyEntry[] };

/** Who backed a drawing and by how much — money in ranked games, vote points
 *  in friendly ones. */
export type Backer = { name: string; amount: number };

export type RoundResult = DrawingEntry & {
  total: number;
  backers: Backer[];
};

export type ScoreRow = {
  playerId: string;
  nickname: string;
  tier: string;
  crown: boolean;
  score: number;
  delta: number;
  /** This round's breakdown of `delta`, for the reveal screen to explain it:
   *  delta = raised + bonus - penalty. Friendly games only use `raised`. */
  raised: number;
  bonus: number;
  penalty: number;
};

/** Where a rating sits on the ladder. Derived from the rating, sent ready-made
 *  so the app never has to know the band thresholds. */
export type LeagueInfo = {
  id: string;
  name: string;
  /** Rating at which this league starts — also the level it protects down to. */
  floor: number;
  /** Rating at which the next league starts, or null at the top. */
  next: number | null;
  /** 0..1 through the current band, for a progress bar. */
  progress: number;
};

/** A player's persistent, cross-game record.
 *
 * Two different measures, deliberately: [trophies] is a career total that only
 * ever grows, [rating] is current skill and moves both ways. The leaderboard
 * ranks by rating. */
export type Profile = {
  id: string;
  nickname: string;
  trophies: number;
  tier: string;
  crown: boolean;
  games: number;
  wins: number;
  bestScore: number;
  /** Global position, or null while still playing placement games. */
  rank: number | null;
  rating: number;
  league: LeagueInfo;
  /** Ranked games finished this season. */
  seasonGames: number;
  /** Games still to play before appearing on the board. 0 once placed. */
  placementsLeft: number;
  season: number;
  seasonEndsMs: number;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  nickname: string;
  trophies: number;
  tier: string;
  crown: boolean;
  games: number;
  wins: number;
  rating: number;
  league: LeagueInfo;
};

/** Whether a friendly lobby shows up in the browser, or needs its code.
 *
 *  "public" is the default because a lobby nobody can find is the problem the
 *  browser exists to solve; a host who actually wants a closed game can switch
 *  it, and the code keeps working either way. */
export type LobbyVisibility = "public" | "private";

/** One row in the lobby browser. Deliberately not the full lobby state —
 *  nothing here is worth hiding, but there is no reason to ship a player list
 *  and scores to everyone idling on the menu. */
export type OpenLobby = {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  /** Bots already seated. Shown so nobody joins expecting five humans. */
  bots: number;
  /** When it was opened, so the list can put the freshest games first. */
  createdAtMs: number;
};

export type ClientMessage =
  | { type: "ping" }
  /** Identity handshake. The id is generated once on the device and kept
   *  forever, which is what makes profiles and the leaderboard possible; the
   *  nickname travels with it so a rename follows the same account. Must be
   *  sent before anything else. */
  | { type: "hello"; playerId: string; nickname: string }
  | { type: "set_nickname"; nickname: string }
  /** The app owns the Grand Pass (or stopped owning it). Cosmetic only --
   *  it puts a crown by the name -- so the client's word is taken for it. */
  | { type: "set_crown"; owned: boolean }
  /** Attaches a Google account to this profile, so trophies survive losing
   *  the phone and follow the player onto other devices. The token is a
   *  Google id token; the server verifies its signature rather than trusting
   *  the claim. Sent after `hello`, never instead of it. */
  | { type: "link_google"; idToken: string }
  | { type: "unlink_google" }
  /** The player has been shown the thank-you, so never offer it again.
   *  Sent whether or not they did anything with it — the offer is what's
   *  spent, not the reward. */
  | { type: "thanks_seen" }
  | { type: "get_leaderboard" }
  // --- ranked ---
  | { type: "find_match" }
  | { type: "cancel_match" }
  // --- friendly ---
  | { type: "create_lobby"; visibility?: LobbyVisibility }
  | { type: "join_lobby"; code: string }
  /** Opens the lobby browser. The server replies with `lobby_list` and keeps
   *  sending it whenever the list changes, until `stop_browsing` or the socket
   *  closes — polling a LAN server every couple of seconds would work, but
   *  pushing means a lobby appears the instant it is opened. */
  | { type: "list_lobbies" }
  | { type: "stop_browsing" }
  /** Host-only, from inside the lobby. */
  | { type: "set_visibility"; visibility: LobbyVisibility }
  | { type: "start_game" }
  | { type: "add_bot" }
  | { type: "remove_bot" }
  /** Host-only, friendly rooms only, before the game starts. Works on bots
   *  as well as people, so one control empties any seat. */
  | { type: "kick_player"; playerId: string }
  // --- in game ---
  | { type: "submit_prompt"; text: string }
  | { type: "submit_drawing"; strokes: Stroke[]; title: string; paper?: string }
  /** artistId -> amount. Omitting an artist means 0; allocating to yourself
   *  or to a nonexistent artist is silently ignored server-side. */
  | { type: "submit_investment"; allocations: Record<string, number> }
  /** Ordered artistIds, best first, at most 3. Friendly games only. */
  | { type: "submit_ranking"; order: string[] }
  | { type: "play_again" }
  | { type: "leave_lobby" }
  /** Asks for one ambient doodle to replay on an idle screen. Doesn't
   *  require being in a lobby — it's decoration, not game state. */
  | { type: "request_doodle" }
  // --- the daily ---
  /** Today's prompt, and whether this player has already drawn it. */
  | { type: "daily_info" }
  /** No clock and nothing locked: everything is allowed in the daily.
   *  Submitting twice in one day replaces the first drawing. */
  | { type: "daily_submit"; strokes: Stroke[]; title: string; paper?: string }
  /** A page of the gallery for [day] (today when omitted), newest first.
   *  Only answered for a day this player has submitted a drawing for —
   *  the gallery is the reward for taking part. */
  | { type: "daily_gallery"; day?: number; beforeId?: number }
  /** The next fortnight of prompts, so the phone can schedule a local
   *  "today's prompt" reminder without the server having to push anything
   *  (no Firebase, no tokens, works offline once fetched). */
  | { type: "daily_upcoming" }
  /** A heart on one of today's drawings. Only for someone who drew today,
   *  never on your own, once per drawing, and it cannot be taken back. */
  | { type: "daily_heart"; entryId: number }
  /** The hall of fame: finished days, newest first, each with its top three. */
  | { type: "daily_history"; beforeDay?: number }
  /** A note about a drawing, for a human to read. Either a Daily/hall entry
   *  by id, or a round drawing by its artist (rounds have no entry ids). */
  | { type: "report_drawing"; entryId?: number; artistId?: string; title?: string; reason: string }
  /** Stop seeing an artist's Daily drawings and hall entries. By entry id
   *  (the Daily is blind, so the client often doesn't know the artist) or by
   *  artist id. */
  | { type: "hide_artist"; entryId?: number; artistId?: string }
  | { type: "unhide_artist"; artistId: string }
  /** Friends. A request to someone you've played with or seen in the hall;
   *  if they'd already asked you, it's an acceptance. */
  | { type: "friend_request"; playerId: string }
  | { type: "friend_accept"; playerId: string }
  /** Unfriend, decline, or withdraw. */
  | { type: "friend_remove"; playerId: string }
  /** Everyone: friends (with whether they're online and which room they're
   *  in, if joinable), requests waiting on you, requests you sent. */
  | { type: "friends_list" }
  /** Pull a friend into the friendly room you're in. They get a
   *  `friend_invited` if online. */
  | { type: "friend_invite"; playerId: string };

export type FriendRequestResult = "sent" | "accepted" | "already" | "pending" | "self" | "unknown";
export type FriendRow = { id: string; nickname: string };
/** A friend as the list shows them: whether they're connected right now,
 *  and the code of the friendly room they're in if it can still be joined. */
export type FriendEntry = FriendRow & { online: boolean; roomCode: string | null };

export type ServerMessage =
  | { type: "pong"; serverTimeMs: number }
  | { type: "welcome"; connectionId: string }
  /**
   * Who the server now considers you, sent after `hello` and after any
   * link/unlink.
   *
   * `playerId` matters: linking a Google account that already owns a profile
   * moves the player onto **that** profile, so the id the app has stored can
   * change. The app is expected to save whatever comes back here.
   */
  | {
      type: "account";
      playerId: string;
      linked: boolean;
      /** False when this server has no GOOGLE_CLIENT_ID configured, so the
       *  app can hide a button that could never work. */
      googleAvailable: boolean;
    }
  /** Sent after `hello`, and again whenever trophies change. */
  | { type: "profile"; profile: Profile }
  | { type: "leaderboard"; entries: LeaderboardEntry[]; you: Profile | null }
  /** Progress while waiting for a ranked match. */
  | {
      type: "queue_status";
      waiting: number;
      target: number;
      /** When bots will be added to start the game anyway. */
      botFillAtMs: number;
    }
  | {
      type: "lobby_state";
      code: string;
      hostId: string;
      mode: GameMode;
      players: PlayerInfo[];
      /** Ranked lobbies are never listed, so this is always "private" there. */
      visibility: LobbyVisibility;
    }
  | { type: "lobby_list"; lobbies: OpenLobby[] }
  /** You were removed from a room by its host. Sent only to the person
   *  removed; everyone else just sees the seat empty in `lobby_state`. */
  | { type: "kicked"; code: string }
  | {
      type: "prompt_writing";
      template: string;
      writerId: string;
      writerName: string;
      isWriter: boolean;
      deadlineMs: number;
      roundIndex: number;
      totalRounds: number;
    }
  | {
      type: "round_start";
      prompt: string;
      /** Just the words the writer typed into the blank, so the app can
       *  light them up inside the sentence: they are the thing to draw. */
      answer: string;
      deadlineMs: number;
      roundIndex: number;
      totalRounds: number;
    }
  | { type: "waiting_update"; submitted: number; total: number }
  | {
      type: "voting_phase";
      scoring: Scoring;
      prompt: string;
      entries: DrawingEntry[];
      /** Money games only: what there is to spend, and the increment the
       *  +/- controls move by (divides `budget` exactly). */
      budget: number;
      step: number;
      /** Points games only: how many places a voter picks, best first. */
      places: number;
      deadlineMs: number;
      roundIndex: number;
      totalRounds: number;
    }
  | {
      type: "round_reveal";
      /** What each drawing needed to raise to be funded. Null in friendly
       *  games, which are scored by votes and have no threshold. */
      fundingGoal: number | null;
      scoring: Scoring;
      prompt: string;
      entries: RoundResult[];
      scores: ScoreRow[];
      roundIndex: number;
      totalRounds: number;
    }
  | {
      type: "final_results";
      mode: GameMode;
      scores: ScoreRow[];
      /** Ranked games only: playerId -> trophies won just now. */
      trophies: Record<string, number>;
      /** Ranked games only: playerId -> rating change, which may be negative.
       *  Absent for friendly games, which move nothing. */
      ratingDeltas?: Record<string, number>;
      /** Ranked games only: the league each player is in after this game, so
       *  the results screen can call out a promotion. */
      leagues?: Record<string, LeagueInfo>;
    }
  /** A complete bot drawing for the client to replay stroke-by-stroke while
   *  players wait. `strokes` are ordered exactly as they were drawn, which is
   *  what makes the replay look like a hand at work. */
  | {
      type: "doodle";
      prompt: string;
      artistName: string;
      title: string;
      strokes: Stroke[];
    }
  | {
      type: "daily_info";
      /** Whole days since the epoch, UTC. Names the gallery. */
      day: number;
      prompt: string;
      /** When the prompt changes, so the app can say how long is left. */
      endsAtMs: number;
      submitted: boolean;
      /** How many people have drawn it so far. */
      submissions: number;
      /** This player's own entry for today, if they have made one. */
      mine: DailyEntry | null;
    }
  | {
      type: "daily_gallery";
      day: number;
      prompt: string;
      /**
       * While the day is open, the wall is blind: every entry that isn't the
       * viewer's own comes with no artist and a heart count of 0 (only
       * `heartedByMe` survives), so a drawing is judged as a drawing. Once
       * the day is over the same request returns everything.
       */
      blind: boolean;
      /** Yesterday, frozen: prompt and top three with names and counts. The
       *  results moment, delivered with the first page. Null on the first
       *  day, or if nobody was hearted yesterday. */
      yesterday: HallDay | null;
      entries: DailyEntry[];
      hasMore: boolean;
    }
  /** Answer to `daily_heart`. The count is always 0 while the day is open
   *  (the wall is blind, see `daily_gallery`); the entry id is what the app
   *  needs to keep the heart lit. Also broadcast to the
   *  gallery? No -- a refresh is enough; hearts are not a live feed. */
  | { type: "daily_hearted"; entryId: number; hearts: number }
  | { type: "daily_history"; days: HallDay[]; hasMore: boolean }
  /** Acknowledges a report. */
  | { type: "reported" }
  /** Answer to `friend_request`. */
  | { type: "friend_result"; playerId: string; nickname: string; result: FriendRequestResult }
  | {
      type: "friends";
      friends: FriendEntry[];
      incoming: FriendRow[];
      outgoing: FriendRow[];
    }
  /** Someone wants to be your friend. Pushed when it happens, if you're online. */
  | { type: "friend_request_received"; from: FriendRow }
  /** They said yes. */
  | { type: "friend_accepted"; by: FriendRow }
  /** A friend wants you in their room. */
  | { type: "friend_invited"; from: FriendRow; code: string }
  /** Acknowledges a hide, naming the artist so the app can drop everything
   *  of theirs it's already showing. */
  | { type: "artist_hidden"; artistId: string; entryId: number | null }
  /** Today and the days after it, in order. `startsAtMs` is midnight UTC at
   *  the start of that day, which is when its prompt goes live. */
  | {
      type: "daily_upcoming";
      days: { day: number; prompt: string; startsAtMs: number }[];
    }
  | { type: "error"; message: string };
