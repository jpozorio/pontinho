import { Decision, Game, Round, Score, newGame } from './model';
import { clearAgreement, computeMoney, setAgreement } from './money';

const round = (scores: Record<string, Score>, decisions: Record<string, Decision> = {}): Round => ({
  scores,
  decisions,
});

const four = ['Ana', 'Beto', 'Carla', 'Davi'];

function game(rounds: Round[], players = four, entryValue = 5): Game {
  return { ...newGame({ entryValue, reentryLimit: 'unlimited', players }, new Date('2026-01-01T10:00:00Z')), rounds };
}

/** Carla reentra 1x; Davi vence na rodada 2. Pote 25 com entrada 5. */
const davisWin = (): Game =>
  game([
    round({ Ana: 10, Beto: 10, Carla: 'bust', Davi: 10 }, { Carla: 'reenter' }),
    round({ Ana: 'bust', Beto: 'bust', Carla: 'bust', Davi: 5 }),
  ]);

const twoLeft = (entryValue: number): Game =>
  game(
    [round({ Ana: 10, Beto: 'bust', Carla: 'bust', Davi: 10 }, { Beto: 'out', Carla: 'out' })],
    four,
    entryValue,
  );

describe('money', () => {
  it('puts one entry per entry and reentry', () => {
    const m = computeMoney(davisWin());
    expect(m.put).toEqual({ Ana: 5, Beto: 5, Carla: 10, Davi: 5 });
    expect(m.pot).toBe(25);
  });

  it('winner takes whole pot without agreement', () => {
    const s = computeMoney(davisWin()).settlement!;
    const davi = s.rows.find((r) => r.player === 'Davi')!;
    expect(s.winner).toBe('Davi');
    expect(davi.receives).toBe(25);
    expect(davi.balance).toBe(20);
    expect(s.rows.find((r) => r.player === 'Carla')!.balance).toBe(-10);
  });

  it('has no settlement while the game is running', () => {
    expect(computeMoney(twoLeft(10)).settlement).toBeNull();
  });

  it('agreement splits pot', () => {
    const set = setAgreement(twoLeft(10), { Ana: 10, Davi: 10 });
    if (!('game' in set)) throw new Error('unexpected ' + set.error);
    const done = game([
      ...set.game.rounds,
      round({ Ana: 'bust', Davi: 5 }),
    ], four, 10);
    const s = computeMoney({ ...done, agreement: set.game.agreement }).settlement!;
    expect(s.pot).toBe(40);
    expect(s.winnerTakes).toBe(30);
    expect(s.rows.find((r) => r.player === 'Davi')!.receives).toBe(30);
    expect(s.rows.find((r) => r.player === 'Ana')!.receives).toBe(10);
    expect(s.rows.find((r) => r.player === 'Ana')!.balance).toBe(0);
  });

  it('agreement only with two players', () => {
    const three = game([round({ Ana: 10, Beto: 10, Carla: 10, Davi: 'bust' }, { Davi: 'out' })]);
    expect(setAgreement(three, { Ana: 1, Beto: 1 })).toEqual({ error: 'not-two-players' });
    expect(setAgreement(davisWin(), { Davi: 1, Ana: 1 })).toEqual({ error: 'not-two-players' });
  });

  it('agreement validates keys, amounts and pot', () => {
    const g = twoLeft(10);
    expect(setAgreement(g, { Ana: 25, Davi: 25 })).toEqual({ error: 'exceeds-pot' });
    expect(setAgreement(g, { Ana: -1, Davi: 1 })).toEqual({ error: 'invalid-amount' });
    expect(setAgreement(g, { Ana: NaN, Davi: 1 })).toEqual({ error: 'invalid-amount' });
    expect(setAgreement(g, { Ana: 1, Beto: 1 })).toEqual({ error: 'not-two-players' });
    expect(setAgreement(g, { Ana: 1, Davi: 1, Beto: 1 })).toEqual({ error: 'not-two-players' });
    expect('game' in setAgreement(g, { Ana: 20, Davi: 20 })).toBe(true);
  });

  it('clearAgreement removes the agreement', () => {
    const r = setAgreement(twoLeft(10), { Ana: 2, Davi: 3 });
    if (!('game' in r)) throw new Error('unexpected');
    expect(r.game.agreement).toEqual({ saves: { Ana: 2, Davi: 3 } });
    expect(clearAgreement(r.game).agreement).toBeUndefined();
  });

  it('rounds entries to cents without phantom leftovers', () => {
    const g = game(
      [
        round({ Ana: 10, Beto: 10, Carla: 10, Davi: 'bust' }, { Davi: 'out' }),
        round({ Ana: 'bust', Beto: 'bust', Carla: 5 }),
      ],
      four,
      0.1,
    );
    const m = computeMoney(g);
    expect(m.pot).toBe(0.4);
    expect(m.settlement!.rows.find((r) => r.player === 'Carla')!.balance).toBe(0.3);
  });
});
