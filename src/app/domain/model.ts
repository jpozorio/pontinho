export const BUST_AT = 100;

export type ReentryLimit = 'one' | 'unlimited';
export type Score = number | 'bust';
export type Decision = 'reenter' | 'out';

export interface GameConfig {
  entryValue: number;
  reentryLimit: ReentryLimit;
  /** players[0] dá as cartas na rodada 1 */
  players: string[];
}

export interface Round {
  scores: Record<string, Score>;
  /** só de quem estourou NESTA rodada */
  decisions: Record<string, Decision>;
}

/** Pagamento por partida do formato v1 (só para migração). */
export interface Payment {
  id: string;
  player: string;
  amount: number;
  at: string;
}

export interface Agreement {
  saves: Record<string, number>;
}

export interface Game {
  id: string;
  startedAt: string;
  finishedAt?: string;
  config: GameConfig;
  rounds: Round[];
  draft: Record<string, Score>;
  agreement?: Agreement;
}

export type Movement =
  | { id: string; at: string; kind: 'in'; player: string; amount: number }
  | { id: string; at: string; kind: 'out'; player: string; amount: number }
  | { id: string; at: string; kind: 'transfer'; from: string; to: string; amount: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewMovement = DistributiveOmit<Movement, 'id' | 'at'>;

export interface Night {
  id: string;
  startedAt: string;
  games: Game[];
  movements: Movement[];
}

export interface Pending {
  id: string;
  debtor: string;
  creditor: string;
  amount: number;
  date: string;
}

export interface AppData {
  version: 2;
  current: Game | null;
  night: Night | null;
  pendings: Pending[];
  lastFinished?: Game;
  lastConfig?: { entryValue: number; reentryLimit: ReentryLimit };
}

/** Partida do formato v1: tinha pagamentos próprios. */
export type GameV1 = Game & { payments?: Payment[] };

export interface AppDataV1 {
  version: 1;
  current: GameV1 | null;
  finished: GameV1[];
  lastConfig?: AppData['lastConfig'];
}

export function newNight(now: Date = new Date()): Night {
  return { id: crypto.randomUUID(), startedAt: now.toISOString(), games: [], movements: [] };
}

export function newGame(config: GameConfig, now: Date = new Date()): Game {
  return {
    id: crypto.randomUUID(),
    startedAt: now.toISOString(),
    config,
    rounds: [],
    draft: {},
  };
}
