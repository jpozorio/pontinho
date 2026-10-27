import { addMovement, closeNight, computeCash, removeMovement } from './cash';
import { Decision, Game, Movement, NewMovement, Night, Round, Score, newGame, newNight } from './model';

const round = (scores: Record<string, Score>, decisions: Record<string, Decision> = {}): Round => ({
  scores,
  decisions,
});

const three = ['Ana', 'Beto', 'Carla'];

function game(rounds: Round[], players = three): Game {
  return {
    ...newGame({ entryValue: 5, reentryLimit: 'unlimited', players }, new Date('2026-01-01T10:00:00Z')),
    rounds,
  };
}

/** `winner` vence; os outros estouram e saem. Pote 15. */
function won(winner: string): Game {
  const scores: Record<string, Score> = {};
  const decisions: Record<string, Decision> = {};
  for (const p of three) {
    if (p === winner) scores[p] = 10;
    else {
      scores[p] = 'bust';
      decisions[p] = 'out';
    }
  }
  return game([round(scores, decisions)]);
}

const nightWith = (games: Game[], movements: Movement[] = []): Night => ({
  ...newNight(new Date('2026-01-01T09:00:00Z')),
  games,
  movements,
});

const base = (): Night => nightWith([won('Ana'), won('Beto')]);

const apply = (n: Night, m: NewMovement, current: Game | null = null): Night => {
  const r = addMovement(n, m, current);
  if (!('night' in r)) throw new Error('unexpected ' + r.error);
  return r.night;
};

const row = (n: Night, p: string, current: Game | null = null) =>
  computeCash(n, current).rows.find((r) => r.player === p)!;

describe('cash', () => {
  it('result sums settlements of finished games', () => {
    const v = computeCash(base(), null);
    expect(v.games).toBe(2);
    expect(v.rows.map((r) => [r.player, r.result])).toEqual([
      ['Ana', 5],
      ['Beto', 5],
      ['Carla', -10],
    ]);
  });

  it('game in progress counts what each one put so far', () => {
    const g = game([round({ Ana: 10, Beto: 10, Carla: 'bust' }, { Carla: 'reenter' })]);
    const n = nightWith([]);
    expect(row(n, 'Carla', g).result).toBe(-10);
    expect(row(n, 'Ana', g).result).toBe(-5);
    expect(row(n, 'Beto', g).result).toBe(-5);
  });

  it('in/out/transfer change balance and cash', () => {
    const t = apply(base(), { kind: 'transfer', from: 'Carla', to: 'Beto', amount: 5 });
    expect(row(t, 'Carla').balance).toBe(-5);
    expect(row(t, 'Beto').balance).toBe(0);
    expect(computeCash(t, null).cash).toBe(0);

    const i = apply(t, { kind: 'in', player: 'Carla', amount: 5 });
    expect(row(i, 'Carla').balance).toBe(0);
    expect(computeCash(i, null).cash).toBe(5);

    const o = apply(i, { kind: 'out', player: 'Ana', amount: 5 });
    expect(row(o, 'Ana').balance).toBe(0);
    expect(computeCash(o, null).cash).toBe(0);
  });

  it('sum of balances equals cash', () => {
    let n = base();
    n = apply(n, { kind: 'in', player: 'Carla', amount: 7.5 });
    n = apply(n, { kind: 'out', player: 'Beto', amount: 2.25 });
    n = apply(n, { kind: 'transfer', from: 'Carla', to: 'Ana', amount: 1.1 });
    const v = computeCash(n, null);
    const total = Math.round(v.rows.reduce((a, r) => a + r.balance, 0) * 100) / 100;
    expect(total).toBe(v.cash);
  });

  it('refuses out beyond the cash', () => {
    expect(addMovement(base(), { kind: 'out', player: 'Ana', amount: 1 }, null)).toEqual({
      error: 'exceeds-cash',
    });
  });

  it('refuses zero/negative/NaN', () => {
    for (const amount of [0, -1, NaN]) {
      expect(addMovement(base(), { kind: 'in', player: 'Ana', amount }, null)).toEqual({
        error: 'invalid-amount',
      });
    }
  });

  it('refuses transfer to self', () => {
    expect(addMovement(base(), { kind: 'transfer', from: 'Ana', to: 'Ana', amount: 1 }, null)).toEqual({
      error: 'same-player',
    });
  });

  it('refuses removing a movement that would make the cash negative', () => {
    let n = apply(base(), { kind: 'in', player: 'Carla', amount: 10 });
    n = apply(n, { kind: 'out', player: 'Ana', amount: 10 });
    const inId = n.movements.find((m) => m.kind === 'in')!.id;
    expect(removeMovement(n, inId, null)).toEqual({ error: 'exceeds-cash' });
    const outId = n.movements.find((m) => m.kind === 'out')!.id;
    expect('night' in removeMovement(n, outId, null)).toBe(true);
  });

  it('closeNight blocks with game in progress', () => {
    const g = game([round({ Ana: 10, Beto: 10, Carla: 10 })]);
    expect(closeNight(base(), g)).toEqual({ error: 'game-in-progress' });
  });

  it('closeNight blocks with cash left', () => {
    const n = apply(base(), { kind: 'in', player: 'Carla', amount: 5 });
    expect(closeNight(n, null)).toEqual({ error: 'cash-not-empty' });
  });

  it('closeNight turns unpaid balances into greedy pendings', () => {
    const mv = (m: NewMovement, i: number): Movement => ({ ...m, id: 'm' + i, at: 'x' }) as Movement;
    const n = nightWith(
      [],
      [
        mv({ kind: 'in', player: 'Ana', amount: 20 }, 1),
        mv({ kind: 'in', player: 'Beto', amount: 5 }, 2),
        mv({ kind: 'out', player: 'Carla', amount: 15 }, 3),
        mv({ kind: 'out', player: 'Davi', amount: 10 }, 4),
      ],
    );
    const r = closeNight(n, null);
    if (!('pendings' in r)) throw new Error('unexpected ' + r.error);
    expect(r.pendings.map((p) => [p.debtor, p.creditor, p.amount])).toEqual([
      ['Carla', 'Ana', 15],
      ['Davi', 'Ana', 5],
      ['Davi', 'Beto', 5],
    ]);
    expect(r.pendings.every((p) => p.date === n.startedAt)).toBe(true);
  });
});
