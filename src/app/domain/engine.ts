import { BUST_AT, Decision, Game, Score } from './model';

export type PlayerStatus = 'active' | 'deciding' | 'out';

export interface PlayerView {
  name: string;
  /** para 'deciding' + 'reenter' = reentryTotal; para estourado = total com estouro (>= 100) */
  total: number;
  /** inclui uma decisão 'reenter' ainda aberta */
  reentries: number;
  /** 'deciding' = estourou na última rodada fechada e a partida não acabou */
  status: PlayerStatus;
  decision?: Decision;
  /** false se reentryLimit 'one' e já reentrou antes */
  canReenter: boolean;
  /** maior total entre os não estourados da rodada em que estourou */
  reentryTotal?: number;
  playsNextRound: boolean;
  /** 99 - total */
  pointsLeft: number;
}

export interface HistoryCell {
  /** null = não jogou */
  points: Score | null;
  total: number | null;
  busted: boolean;
  reenteredWith?: number;
  out: boolean;
}

export interface GameView {
  players: PlayerView[];
  nextRound: number;
  dealer: string | null;
  winner: string | null;
  history: HistoryCell[][];
  playingCount: number;
}

interface PlayerState {
  total: number;
  /** reentradas já fixas (decisões de rodadas já seguidas por outra) */
  reentries: number;
  out: boolean;
}

export function computeGame(game: Game): GameView {
  const names = game.config.players;
  const rounds = game.rounds;
  const state = new Map<string, PlayerState>(
    names.map((n) => [n, { total: 0, reentries: 0, out: false }]),
  );
  const history: HistoryCell[][] = [];
  /** reentryTotals[r] = maior total entre os não estourados da rodada r */
  const reentryTotals: number[] = [];

  // Estourados da última rodada fechada, com decisão ainda em aberto.
  let pending: string[] = [];
  let winner: string | null = null;
  let dealer: string | null = null;

  const firstPlaying = (from: number, playing: Set<string>): string | null => {
    for (let k = 0; k < names.length; k++) {
      const n = names[(from + k) % names.length];
      if (playing.has(n)) return n;
    }
    return null;
  };

  rounds.forEach((round, r) => {
    // Fechar a rodada r fixa as decisões da rodada anterior.
    if (r > 0) {
      for (const p of pending) {
        const s = state.get(p)!;
        if (rounds[r - 1].decisions[p] === 'reenter') {
          s.total = reentryTotals[r - 1];
          s.reentries++;
        } else {
          s.out = true;
        }
      }
    }

    const playing = new Set(names.filter((n) => !state.get(n)!.out));
    dealer = dealer === null ? firstPlaying(0, playing) : firstPlaying(names.indexOf(dealer) + 1, playing);

    const cells: HistoryCell[] = [];
    const busted: string[] = [];
    const survivors: number[] = [];
    let survivor = '';
    for (const n of names) {
      const s = state.get(n)!;
      if (!playing.has(n)) {
        cells.push({ points: null, total: null, busted: false, out: true });
        continue;
      }
      const score: Score = round.scores[n] ?? 0;
      s.total = score === 'bust' ? Math.max(s.total, BUST_AT) : s.total + score;
      const isBust = s.total >= BUST_AT;
      if (isBust) {
        busted.push(n);
      } else {
        survivors.push(s.total);
        survivor = n;
      }
      cells.push({ points: score, total: s.total, busted: isBust, out: false });
    }
    history.push(cells);
    reentryTotals.push(Math.max(0, ...survivors));
    winner = survivors.length === 1 ? survivor : null;
    pending = busted;
  });

  const lastIndex = rounds.length - 1;
  if (winner !== null) {
    for (const n of pending) state.get(n)!.out = true;
    pending = [];
  }

  // reenteredWith: na célula da rodada em que estourou, conforme a decisão atual.
  rounds.forEach((round, r) => {
    if (r === lastIndex && winner !== null) return;
    names.forEach((n, i) => {
      if (history[r][i].busted && round.decisions[n] === 'reenter') {
        history[r][i].reenteredWith = reentryTotals[r];
      }
    });
  });

  const lastDecisions = rounds[lastIndex]?.decisions ?? {};
  const players = names.map((name): PlayerView => {
    const s = state.get(name)!;
    const deciding = pending.includes(name);
    const decision = deciding ? lastDecisions[name] : undefined;
    const reentering = deciding && decision === 'reenter';
    const status: PlayerStatus = deciding ? 'deciding' : s.out ? 'out' : 'active';
    const reentryTotal = deciding ? reentryTotals[lastIndex] : undefined;
    const total = reentering ? reentryTotals[lastIndex] : s.total;
    return {
      name,
      total,
      reentries: s.reentries + (reentering ? 1 : 0),
      status,
      decision,
      canReenter: game.config.reentryLimit === 'unlimited' || s.reentries === 0,
      reentryTotal,
      playsNextRound: status === 'active' ? winner === null || name === winner : reentering,
      pointsLeft: BUST_AT - 1 - total,
    };
  });

  const playingNext = new Set(players.filter((p) => p.playsNextRound).map((p) => p.name));
  let nextDealer: string | null = null;
  if (winner === null) {
    nextDealer =
      dealer === null ? names[0] ?? null : firstPlaying(names.indexOf(dealer) + 1, playingNext);
  }

  return {
    players,
    nextRound: rounds.length + 1,
    dealer: nextDealer,
    winner,
    history,
    playingCount: playingNext.size,
  };
}
