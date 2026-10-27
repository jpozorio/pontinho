import { closeRound, decide, editRound, setDraftScore, truncateFrom, Result } from './actions';
import { computeGame } from './engine';
import { Decision, Game, ReentryLimit, Round, Score, newGame } from './model';

const round = (scores: Record<string, Score>, decisions: Record<string, Decision> = {}): Round => ({
  scores,
  decisions,
});

const four = ['Ana', 'Beto', 'Carla', 'Davi'];

function game(
  rounds: Round[],
  draft: Record<string, Score> = {},
  players = ['Ana', 'Beto', 'Carla'],
  reentryLimit: ReentryLimit = 'unlimited',
): Game {
  return { ...newGame({ entryValue: 5, reentryLimit, players }), rounds, draft };
}

const ok = (r: Result): Game => {
  if (!('game' in r)) throw new Error('unexpected error ' + r.error);
  return r.game;
};

describe('actions', () => {
  it('rejects negative and fractional scores', () => {
    const g = game([]);
    expect(setDraftScore(g, 'Ana', -1)).toEqual({ error: 'invalid-score' });
    expect(setDraftScore(g, 'Ana', 2.5)).toEqual({ error: 'invalid-score' });
    expect(setDraftScore(g, 'Ana', NaN)).toEqual({ error: 'invalid-score' });
    expect(ok(setDraftScore(g, 'Ana', 0)).draft).toEqual({ Ana: 0 });
  });

  it('setDraftScore null clears, does not mutate, and ignores non-playing players', () => {
    const g = game([], { Ana: 5 });
    const g2 = ok(setDraftScore(g, 'Ana', null));
    expect(g2.draft).toEqual({});
    expect(g.draft).toEqual({ Ana: 5 });
    expect(ok(setDraftScore(g, 'Zed', 3))).toBe(g);
  });

  it('closeRound requires all playing scores', () => {
    expect(closeRound(game([], { Ana: 10 }))).toEqual({ error: 'missing-scores' });
  });

  it('closeRound refuses all bust', () => {
    const g = game([], { Ana: 'bust', Beto: 120, Carla: 'bust' });
    expect(closeRound(g)).toEqual({ error: 'all-bust' });
  });

  it('closeRound appends round and clears draft', () => {
    const g = game([], { Ana: 10, Beto: 20, Carla: 30 });
    const g2 = ok(closeRound(g));
    expect(g2.rounds).toEqual([round({ Ana: 10, Beto: 20, Carla: 30 })]);
    expect(g2.draft).toEqual({});
    expect(g2.finishedAt).toBeUndefined();
    expect(g.rounds.length).toBe(0);
  });

  it('closeRound auto-outs busted player who cannot reenter', () => {
    const g = game([], { Ana: 10, Beto: 'bust', Carla: 30, Davi: 5 }, four, 'one');
    const g2 = ok(closeRound(g));
    expect(g2.rounds[0].decisions).toEqual({});
    // Beto reentra (primeira reentrada) e estoura de novo -> sai sozinho
    const g3 = ok(decide(g2, 'Beto', 'reenter'));
    const g4 = ok(closeRound({ ...g3, draft: { Ana: 10, Beto: 'bust', Carla: 10, Davi: 5 } }));
    expect(g4.rounds[1].decisions).toEqual({ Beto: 'out' });
    const beto = computeGame(g4).players.find((p) => p.name === 'Beto')!;
    expect([beto.decision, beto.canReenter, beto.playsNextRound]).toEqual(['out', false, false]);
  });

  it('closeRound with single survivor finishes the game', () => {
    const now = new Date('2026-01-02T03:04:05Z');
    const g = ok(closeRound(game([], { Ana: 10, Beto: 'bust', Carla: 100 }), now));
    expect(g.finishedAt).toBe(now.toISOString());
    expect(computeGame(g).winner).toBe('Ana');
    expect(closeRound(g)).toEqual({ error: 'game-over' });
    expect(setDraftScore(g, 'Ana', 1)).toEqual({ error: 'game-over' });
    expect(decide(g, 'Beto', 'reenter')).toEqual({ error: 'game-over' });
  });

  it('closeRound blocks while decision pending', () => {
    const g = game([round({ Ana: 40, Beto: 'bust', Carla: 60, Davi: 10 })], { Ana: 1, Carla: 1, Davi: 1 }, four);
    expect(closeRound(g)).toEqual({ error: 'pending-decision' });
  });

  it('decide reenter fails when the limit is reached', () => {
    const r1 = round({ Ana: 40, Beto: 'bust', Carla: 60, Davi: 10 }, { Beto: 'reenter' });
    const r2 = round({ Ana: 5, Beto: 'bust', Carla: 5, Davi: 5 });
    const g = game([r1, r2], {}, four, 'one');
    expect(decide(g, 'Beto', 'reenter')).toEqual({ error: 'cannot-reenter' });
    expect(ok(decide(g, 'Beto', 'out')).rounds[1].decisions).toEqual({ Beto: 'out' });
  });

  it('switching from out to reenter adds player to round', () => {
    const g = game([round({ Ana: 40, Beto: 'bust', Carla: 60, Davi: 10 }, { Beto: 'out' })], {}, four);
    const g2 = ok(decide(g, 'Beto', 'reenter'));
    expect(computeGame(g2).players.find((p) => p.name === 'Beto')!.playsNextRound).toBe(true);
    const g3 = { ...g2, draft: { Ana: 1, Carla: 1, Davi: 1 } };
    expect(closeRound(g3)).toEqual({ error: 'missing-scores' });
  });

  it('switching to out removes the draft and leaves input untouched', () => {
    const g = game(
      [round({ Ana: 40, Beto: 'bust', Carla: 60, Davi: 10 }, { Beto: 'reenter' })],
      { Beto: 7 },
      four,
    );
    const g2 = ok(decide(g, 'Beto', 'out'));
    expect(g2.draft).toEqual({});
    expect(g.draft).toEqual({ Beto: 7 });
    expect(g.rounds[0].decisions).toEqual({ Beto: 'reenter' });
  });

  it('editRound keeps outcome', () => {
    const g = game([round({ Ana: 10, Beto: 20, Carla: 5 }), round({ Ana: 5, Beto: 5, Carla: 5 })]);
    const g2 = ok(editRound(g, 0, { Ana: 12, Beto: 20, Carla: 5 }));
    expect(computeGame(g2).players[0].total).toBe(17);
    expect(g.rounds[0].scores['Ana']).toBe(10);
  });

  it('editRound rejects outcome change', () => {
    const g = game([round({ Ana: 10, Beto: 20, Carla: 5 })]);
    expect(editRound(g, 0, { Ana: 10, Beto: 'bust', Carla: 5 })).toEqual({ error: 'changes-outcome' });
  });

  it('editRound validates scores and keys', () => {
    const g = game([round({ Ana: 10, Beto: 20, Carla: 5 })]);
    expect(editRound(g, 0, { Ana: -1, Beto: 20, Carla: 5 })).toEqual({ error: 'invalid-score' });
    expect(editRound(g, 0, { Ana: 10, Beto: 20 })).toEqual({ error: 'missing-scores' });
  });

  it('truncateFrom reopens finished game and drops agreement', () => {
    const g0 = ok(closeRound(game([], { Ana: 10, Beto: 'bust', Carla: 100 })));
    const g: Game = { ...g0, agreement: { saves: { Ana: 1 } } };
    const t = truncateFrom(g, 0);
    expect(t.rounds).toEqual([]);
    expect(t.finishedAt).toBeUndefined();
    expect(t.draft).toEqual({});
    expect(t.agreement).toBeUndefined();
    expect(g.finishedAt).toBeDefined();
  });

  it('truncateFrom keeps agreement while only two are playing', () => {
    const rounds = [round({ Ana: 10, Beto: 20, Carla: 'bust' }, { Carla: 'out' }), round({ Ana: 1, Beto: 1 })];
    const g: Game = { ...game(rounds), agreement: { saves: { Ana: 1, Beto: 1 } } };
    expect(truncateFrom(g, 1).agreement).toBeDefined();
  });

  it('truncateFrom out of range returns the game unchanged', () => {
    const g0 = ok(closeRound(game([], { Ana: 10, Beto: 'bust', Carla: 100 })));
    expect(truncateFrom(g0, 1)).toBe(g0);
    expect(truncateFrom(g0, -1)).toBe(g0);
    expect(g0.finishedAt).toBeDefined();
  });

  it('decide reenter drops the agreement when a third player returns', () => {
    const rounds = [
      round({ Ana: 40, Beto: 30, Carla: 20, Davi: 'bust' }, { Davi: 'out' }),
      round({ Ana: 10, Beto: 10, Carla: 'bust' }, { Carla: 'out' }),
    ];
    const g: Game = { ...game(rounds, {}, four), agreement: { saves: { Ana: 10, Beto: 10 } } };
    expect(computeGame(g).playingCount).toBe(2);
    expect(ok(decide(g, 'Carla', 'reenter')).agreement).toBeUndefined();
    expect(ok(decide(g, 'Carla', 'out')).agreement).toBeDefined();
  });
});
