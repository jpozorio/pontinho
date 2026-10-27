import { computeGame } from './engine';
import { BUST_AT, Decision, Game, Round, Score } from './model';

export type ActionError =
  | 'invalid-score'
  | 'missing-scores'
  | 'all-bust'
  | 'pending-decision'
  | 'cannot-reenter'
  | 'changes-outcome'
  | 'game-over';

export type Result = { game: Game } | { error: ActionError };

const validScore = (s: Score): boolean => s === 'bust' || (Number.isInteger(s) && s >= 0);

export function setDraftScore(game: Game, player: string, score: Score | null): Result {
  const view = computeGame(game);
  if (view.winner !== null) return { error: 'game-over' };
  if (score !== null && !validScore(score)) return { error: 'invalid-score' };
  if (!view.players.find((p) => p.name === player)?.playsNextRound) return { game };
  const draft = { ...game.draft };
  if (score === null) delete draft[player];
  else draft[player] = score;
  return { game: { ...game, draft } };
}

export function closeRound(game: Game, now: Date = new Date()): Result {
  const view = computeGame(game);
  if (view.winner !== null) return { error: 'game-over' };
  if (view.players.some((p) => p.status === 'deciding' && p.decision === undefined)) {
    return { error: 'pending-decision' };
  }
  const playing = view.players.filter((p) => p.playsNextRound);
  if (playing.some((p) => game.draft[p.name] === undefined)) return { error: 'missing-scores' };

  const scores: Record<string, Score> = {};
  const busted = new Set<string>();
  for (const p of playing) {
    const s = game.draft[p.name];
    scores[p.name] = s;
    if (s === 'bust' || p.total + s >= BUST_AT) busted.add(p.name);
  }
  if (busted.size === playing.length) return { error: 'all-bust' };

  const decisions: Record<string, Decision> = {};
  for (const p of playing) {
    // p.reentries já inclui uma reentrada aberta, que se fixa ao fechar esta rodada.
    const canReenter = game.config.reentryLimit === 'unlimited' || p.reentries === 0;
    if (busted.has(p.name) && !canReenter) decisions[p.name] = 'out';
  }

  const next: Game = { ...game, rounds: [...game.rounds, { scores, decisions }], draft: {} };
  if (computeGame(next).winner !== null) next.finishedAt = now.toISOString();
  return { game: next };
}

/** Só vale para jogadores 'deciding'; para os demais, 'out' devolve o jogo igual e 'reenter' dá 'cannot-reenter'. */
export function decide(game: Game, player: string, decision: Decision): Result {
  const view = computeGame(game);
  if (view.winner !== null) return { error: 'game-over' };
  const p = view.players.find((x) => x.name === player);
  if (!p || p.status !== 'deciding') {
    return decision === 'reenter' ? { error: 'cannot-reenter' } : { game };
  }
  if (decision === 'reenter' && !p.canReenter) return { error: 'cannot-reenter' };

  const last = game.rounds.length - 1;
  const rounds = game.rounds.map(
    (r, i): Round => (i === last ? { ...r, decisions: { ...r.decisions, [player]: decision } } : r),
  );
  const draft = { ...game.draft };
  if (decision === 'out') delete draft[player];
  return { game: { ...game, rounds, draft } };
}

export function editRound(game: Game, index: number, scores: Record<string, Score>): Result {
  const original = game.rounds[index];
  if (!original) return { game };
  if (Object.values(scores).some((s) => !validScore(s))) return { error: 'invalid-score' };
  const expected = Object.keys(original.scores);
  const given = Object.keys(scores);
  if (given.length !== expected.length || expected.some((n) => !(n in scores))) {
    return { error: 'missing-scores' };
  }

  const edited: Game = {
    ...game,
    rounds: game.rounds.map((r, i) => (i === index ? { ...r, scores: { ...scores } } : r)),
  };
  const before = computeGame(game);
  const after = computeGame(edited);
  const bustedOf = (v: typeof before) => JSON.stringify(v.history.map((row) => row.map((c) => c.busted)));
  if (before.winner !== after.winner || bustedOf(before) !== bustedOf(after)) {
    return { error: 'changes-outcome' };
  }
  return { game: edited };
}

export function truncateFrom(game: Game, index: number): Game {
  const next: Game = { ...game, rounds: game.rounds.slice(0, Math.max(0, index)), draft: {} };
  delete next.finishedAt;
  if (next.agreement && computeGame(next).playingCount > 2) delete next.agreement;
  return next;
}
