// Wire protocol between Flutter clients and the game server.

export type PlayerInfo = { id: string; nickname: string; isBot: boolean };

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
  title: string;
  strokes: Stroke[];
  /** The sheet the artist drew on. Cosmetic, passed through untouched. */
  paper?: string;
};

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
  score: number;
  delta: number;
  /** This round's breakdown of `delta`, for the reveal screen to explain it:
   *  delta = raised + bonus - penalty. Friendly games only use `raised`. */
  raised: number;
  bonus: number;
  penalty: number;
};

/** A player's persistent, cross-game record. */
export type Profile = {
  id: string;
  nickname: string;
  trophies: number;
  games: number;
  wins: number;
  bestScore: number;
  /** Global position, or null until they've finished a ranked game. */
  rank: number | null;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  nickname: string;
  trophies: number;
  games: number;
  wins: number;
};

export type ClientMessage =
  | { type: "ping" }
  /** Identity handshake. The id is generated once on the device and kept
   *  forever, which is what makes profiles and the leaderboard possible; the
   *  nickname travels with it so a rename follows the same account. Must be
   *  sent before anything else. */
  | { type: "hello"; playerId: string; nickname: string }
  | { type: "set_nickname"; nickname: string }
  | { type: "get_leaderboard" }
  // --- ranked ---
  | { type: "find_match" }
  | { type: "cancel_match" }
  // --- friendly ---
  | { type: "create_lobby" }
  | { type: "join_lobby"; code: string }
  | { type: "start_game" }
  | { type: "add_bot" }
  | { type: "remove_bot" }
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
  | { type: "request_doodle" };

export type ServerMessage =
  | { type: "pong"; serverTimeMs: number }
  | { type: "welcome"; connectionId: string }
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
    }
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
  | { type: "error"; message: string };
