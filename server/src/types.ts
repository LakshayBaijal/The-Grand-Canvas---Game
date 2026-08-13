// Wire protocol between Flutter clients and the game server.

export type PlayerInfo = { id: string; nickname: string; isBot: boolean };

/** Coordinates are normalized to the 0..1 range so drawings render
 *  correctly regardless of each device's actual screen size. */
export type Point = { x: number; y: number };

export type Stroke = {
  color: string; // hex, e.g. "#FF0000"
  width: number;
  points: Point[];
};

export type DrawingEntry = {
  artistId: string;
  artistName: string;
  title: string;
  strokes: Stroke[];
};

export type InvestorShare = { name: string; amount: number };

export type InvestmentResult = DrawingEntry & {
  totalInvested: number;
  investors: InvestorShare[];
};

export type ScoreRow = {
  playerId: string;
  nickname: string;
  score: number;
  delta: number;
  /** This round's breakdown of `delta`, for the reveal screen to explain it:
   *  delta = raised + bonus - penalty. */
  raised: number;
  bonus: number;
  penalty: number;
};

export type ClientMessage =
  | { type: "ping" }
  | { type: "create_lobby"; nickname: string }
  | { type: "quick_play"; nickname: string }
  | { type: "join_lobby"; code: string; nickname: string }
  | { type: "start_game" }
  | { type: "add_bot" }
  | { type: "remove_bot" }
  | { type: "submit_prompt"; text: string }
  | { type: "submit_drawing"; strokes: Stroke[]; title: string }
  /** artistId -> amount. Omitting an artist means 0; allocating to yourself
   *  or to a nonexistent artist is silently ignored server-side. */
  | { type: "submit_investment"; allocations: Record<string, number> }
  | { type: "play_again" };

export type ServerMessage =
  | { type: "pong"; serverTimeMs: number }
  | { type: "welcome"; connectionId: string }
  | { type: "lobby_state"; code: string; hostId: string; players: PlayerInfo[] }
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
      type: "investing_phase";
      prompt: string;
      entries: DrawingEntry[];
      budget: number;
      /** Increment the +/- controls should move by; divides `budget` exactly. */
      step: number;
      deadlineMs: number;
      roundIndex: number;
      totalRounds: number;
    }
  | {
      type: "round_reveal";
      prompt: string;
      entries: InvestmentResult[];
      scores: ScoreRow[];
      roundIndex: number;
      totalRounds: number;
    }
  | { type: "final_results"; scores: ScoreRow[] }
  | { type: "error"; message: string };
