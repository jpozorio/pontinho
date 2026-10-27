import { Decision, Game, Round, Score, newGame } from './model';
import { addPayment, clearAgreement, computeDebts, computeMoney, removePayment, setAgreement } from './money';

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

const finished = (g: Game, at: string): Game => ({ ...g, finishedAt: at });

const pay = (g: Game, player: string, amount: number): Game => addPayment(g, player, amount);

const twoLeft = (entryValue: number): Game =>
  game(
    [round({ Ana: 10, Beto: 'bust', Carla: 'bust', Davi: 10 }, { Beto: 'out', Carla: 'out' })],
    four,
    entryValue,
  );

describe('money', () => {
  it('owes one entry per entry and reentry', () => {
    const m = computeMoney(davisWin(), []);
    const carla = m.rows.find((r) => r.player === 'Carla')!;
    expect(carla.entries).toBe(2);
    expect(carla.owes).toBe(10);
    expect(m.pot).toBe(25);
  });

  it('missingToPot sums outstanding', () => {
    let g = davisWin();
    g = pay(pay(g, 'Ana', 5), 'Davi', 5);
    const m = computeMoney(g, []);
    expect(m.missingToPot).toBe(15);
    expect(m.rows.find((r) => r.player === 'Ana')!.outstanding).toBe(0);
  });

  it('winner takes whole pot without agreement', () => {
    const s = computeMoney(davisWin(), []).settlement!;
    const davi = s.rows.find((r) => r.player === 'Davi')!;
    expect(s.winner).toBe('Davi');
    expect(davi.receives).toBe(25);
    expect(davi.balance).toBe(20);
    expect(s.rows.find((r) => r.player === 'Carla')!.balance).toBe(-10);
  });

  it('has no settlement while the game is running', () => {
    expect(computeMoney(twoLeft(10), []).settlement).toBeNull();
  });

  it('agreement splits pot', () => {
    const set = setAgreement(twoLeft(10), { Ana: 10, Davi: 10 });
    if (!('game' in set)) throw new Error('unexpected ' + set.error);
    const done = game([
      ...set.game.rounds,
      round({ Ana: 'bust', Davi: 5 }),
    ], four, 10);
    const s = computeMoney({ ...done, agreement: set.game.agreement }, []).settlement!;
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

  it('addPayment validates amount, removePayment removes by id', () => {
    const g = game([]);
    expect(addPayment(g, 'Ana', 0)).toBe(g);
    expect(addPayment(g, 'Ana', -3)).toBe(g);
    expect(addPayment(g, 'Ana', NaN)).toBe(g);
    const g2 = addPayment(g, 'Ana', 2.5, new Date('2026-02-02T00:00:00Z'));
    expect(g.payments).toEqual([]);
    expect(g2.payments[0]).toMatchObject({ player: 'Ana', amount: 2.5, at: '2026-02-02T00:00:00.000Z' });
    expect(removePayment(g2, g2.payments[0].id).payments).toEqual([]);
  });

  it('unpaid amount becomes debt to winner', () => {
    let g = davisWin();
    g = pay(pay(pay(g, 'Ana', 5), 'Carla', 10), 'Davi', 5);
    g = finished(g, '2026-01-01T12:00:00.000Z');
    expect(computeDebts([g])).toEqual([
      { debtor: 'Beto', creditor: 'Davi', amount: 5, gameId: g.id, date: '2026-01-01T12:00:00.000Z' },
    ]);
  });

  it('agreement partner with unpaid entries still owes the winner', () => {
    const g = finished(davisWin(), '2026-01-01T12:00:00.000Z');
    const debts = computeDebts([{ ...g, agreement: { saves: { Ana: 0, Davi: 0 } } }]);
    expect(debts.map((d) => [d.debtor, d.creditor, d.amount])).toEqual([
      ['Ana', 'Davi', 5],
      ['Beto', 'Davi', 5],
      ['Carla', 'Davi', 10],
    ]);
  });

  it('payments clear old debts first', () => {
    const g1 = finished(pay(pay(pay(davisWin(), 'Ana', 5), 'Carla', 10), 'Davi', 5), '2026-01-01T12:00:00.000Z');
    const debts = computeDebts([g1]);
    const g2 = pay(game([]), 'Beto', 8);
    const row = computeMoney(g2, debts).rows.find((r) => r.player === 'Beto')!;
    expect(row.oldDebts).toEqual([]);
    expect(row.paidInGame).toBe(3);
    expect(row.outstanding).toBe(2);
  });

  it('partial payment shrinks the oldest debt first', () => {
    const d = (amount: number, date: string) => ({ debtor: 'Beto', creditor: 'Davi', amount, gameId: date, date });
    const prior = [d(5, '2026-03-01'), d(4, '2026-01-01')];
    const row = computeMoney(pay(game([]), 'Beto', 6), prior).rows.find((r) => r.player === 'Beto')!;
    expect(row.oldDebts).toEqual([d(3, '2026-03-01')]);
    expect(row.paidInGame).toBe(0);
  });

  it('debt survives games the debtor skips', () => {
    const g1 = finished(davisWin(), '2026-01-01T12:00:00.000Z');
    const g2 = finished(
      game([round({ Ana: 10, Carla: 'bust', Davi: 'bust' })], ['Ana', 'Carla', 'Davi']),
      '2026-01-02T12:00:00.000Z',
    );
    const debts = computeDebts([g1, g2]);
    expect(debts.filter((d) => d.debtor === 'Beto')).toEqual([
      { debtor: 'Beto', creditor: 'Davi', amount: 5, gameId: g1.id, date: '2026-01-01T12:00:00.000Z' },
    ]);
  });

  it('debts from different games stay separate and ignore unfinished games', () => {
    const g1 = finished(davisWin(), '2026-01-01T12:00:00.000Z');
    const g2 = finished(davisWin(), '2026-01-02T12:00:00.000Z');
    const running = twoLeft(5);
    const debts = computeDebts([g1, running, g2]).filter((d) => d.debtor === 'Beto');
    expect(debts.length).toBe(2);
    expect(debts.map((d) => d.gameId)).toEqual([g1.id, g2.id]);
  });

  it('floating-point leftovers do not create phantom debts', () => {
    let g = game(
      [
        round({ Ana: 10, Beto: 10, Carla: 10, Davi: 'bust' }, { Davi: 'out' }),
        round({ Ana: 'bust', Beto: 'bust', Carla: 5 }),
      ],
      four,
      0.9,
    );
    g = pay(pay(pay(g, 'Ana', 0.1), 'Ana', 0.1), 'Ana', 0.7);
    g = pay(pay(pay(g, 'Beto', 0.9), 'Carla', 0.9), 'Davi', 0.9);
    const m = computeMoney(g, []);
    expect(m.rows.find((r) => r.player === 'Ana')!.outstanding).toBe(0);
    expect(m.missingToPot).toBe(0);
    expect(computeDebts([finished(g, '2026-01-01T12:00:00.000Z')])).toEqual([]);
  });

  it('computeDebts does not depend on input order', () => {
    const g1 = finished(davisWin(), '2026-01-01T12:00:00.000Z');
    const g2 = finished(pay(davisWin(), 'Beto', 2), '2026-01-02T12:00:00.000Z');
    expect(computeDebts([g2, g1])).toEqual(computeDebts([g1, g2]));
  });
});
