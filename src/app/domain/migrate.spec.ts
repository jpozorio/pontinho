import { migrate } from './migrate';
import { AppData, Game, Night, Payment } from './model';

type GameV1 = Game & { payments: Payment[] };

const config = { entryValue: 5, reentryLimit: 'unlimited' as const, players: ['Ana', 'Beto', 'Carla'] };

function v1Game(id: string, startedAt: string, extra: Partial<GameV1> = {}): GameV1 {
  return { id, startedAt, config, rounds: [], draft: {}, payments: [], ...extra };
}

const won = (id: string, startedAt: string, finishedAt: string): GameV1 =>
  v1Game(id, startedAt, {
    finishedAt,
    rounds: [{ scores: { Ana: 10, Beto: 'bust', Carla: 'bust' }, decisions: { Beto: 'out', Carla: 'out' } }],
  });

describe('migrate', () => {
  it('migrates a v1 game in progress without losing it', () => {
    const payment: Payment = { id: 'p1', player: 'Beto', amount: 5, at: '2026-10-27T20:05:00.000Z' };
    const current = v1Game('g1', '2026-10-27T20:00:00.000Z', {
      rounds: [
        { scores: { Ana: 10, Beto: 20, Carla: 30 }, decisions: {} },
        { scores: { Ana: 15, Beto: 25, Carla: 35 }, decisions: {} },
      ],
      draft: { Ana: 4 },
      payments: [payment],
    });
    const data = migrate({ version: 1, current, finished: [], lastConfig: { entryValue: 5, reentryLimit: 'one' } });

    expect(data.version).toBe(2);
    expect(data.current!.rounds.length).toBe(2);
    expect(data.current!.draft).toEqual({ Ana: 4 });
    expect('payments' in data.current!).toBe(false);
    expect(data.night!.movements).toEqual([{ id: 'p1', at: payment.at, kind: 'in', player: 'Beto', amount: 5 }]);
    expect(data.night!.games).toEqual([]);
    expect(data.night!.startedAt).toBe('2026-10-27T20:00:00.000Z');
    expect(data.pendings).toEqual([]);
    expect(data.lastConfig).toEqual({ entryValue: 5, reentryLimit: 'one' });
  });

  it('folds finished games into one open night', () => {
    const late = won('late', '2026-10-27T21:00:00.000Z', '2026-10-27T21:30:00.000Z');
    const early = won('early', '2026-10-27T19:00:00.000Z', '2026-10-27T19:30:00.000Z');
    early.payments = [{ id: 'p2', player: 'Carla', amount: 5, at: '2026-10-27T19:10:00.000Z' }];
    const data = migrate({ version: 1, current: null, finished: [late, early] });

    expect(data.current).toBeNull();
    expect(data.night!.games.map((g) => g.id)).toEqual(['early', 'late']);
    expect(data.night!.games.every((g) => !('payments' in g))).toBe(true);
    expect(data.night!.startedAt).toBe('2026-10-27T19:00:00.000Z');
    expect(data.night!.movements.map((m) => m.id)).toEqual(['p2']);
    expect(data.lastFinished!.id).toBe('late');
    expect('payments' in data.lastFinished!).toBe(false);
  });

  it('empty v1 gives no night', () => {
    expect(migrate({ version: 1, current: null, finished: [] })).toEqual({
      version: 2,
      current: null,
      night: null,
      pendings: [],
    });
  });

  it('garbage gives empty v2', () => {
    const empty: AppData = { version: 2, current: null, night: null, pendings: [] };
    for (const raw of [null, undefined, 42, 'x', [], {}, { version: 3 }, { version: 1, finished: 'no' }]) {
      expect(migrate(raw)).toEqual(empty);
    }
  });

  it('v2 passes through', () => {
    const night: Night = {
      id: 'n1',
      startedAt: '2026-10-27T19:00:00.000Z',
      games: [],
      movements: [{ id: 'm1', at: '2026-10-27T19:01:00.000Z', kind: 'in', player: 'Ana', amount: 5 }],
    };
    const data: AppData = {
      version: 2,
      current: null,
      night,
      pendings: [{ id: 'x', debtor: 'Beto', creditor: 'Ana', amount: 3, date: '2026-10-26T19:00:00.000Z' }],
      lastConfig: { entryValue: 2, reentryLimit: 'one' },
    };
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(migrate({ version: 2 })).toEqual({ version: 2, current: null, night: null, pendings: [] });
  });
});
