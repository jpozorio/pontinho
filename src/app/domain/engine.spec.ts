import { computeGame } from './engine';
import { Decision, Game, ReentryLimit, Round, Score, newGame } from './model';

const round = (scores: Record<string, Score>, decisions: Record<string, Decision> = {}): Round => ({
  scores,
  decisions,
});

function game(rounds: Round[], players = ['Ana', 'Beto', 'Carla'], reentryLimit: ReentryLimit = 'unlimited'): Game {
  return { ...newGame({ entryValue: 5, reentryLimit, players }), rounds };
}

const four = ['Ana', 'Beto', 'Carla', 'Davi'];
const bustRound = (d: Record<string, Decision>) => round({ Ana: 40, Beto: 'bust', Carla: 60, Davi: 10 }, d);
const byName = (v: ReturnType<typeof computeGame>, n: string) => v.players.find((p) => p.name === n)!;

describe('computeGame', () => {
  it('starts with zero totals and first player dealing', () => {
    const v = computeGame(game([]));
    expect(v.nextRound).toBe(1);
    expect(v.dealer).toBe('Ana');
    expect(v.winner).toBeNull();
    for (const p of v.players) {
      expect(p.total).toBe(0);
      expect(p.pointsLeft).toBe(99);
      expect(p.status).toBe('active');
    }
  });

  it('sums points per round', () => {
    const v = computeGame(
      game([round({ Ana: 10, Beto: 22, Carla: 5 }), round({ Ana: 15, Beto: 9, Carla: 4 })]),
    );
    expect(v.players.map((p) => p.total)).toEqual([25, 31, 9]);
    expect(v.nextRound).toBe(3);
    expect(v.dealer).toBe('Carla');
    expect(v.history[1][0]).toEqual({ points: 15, total: 25, busted: false, out: false });
  });

  it('marks bust from points or bust flag', () => {
    const v = computeGame(game([round({ Ana: 10, Beto: 'bust', Carla: 100 })]));
    for (const n of ['Beto', 'Carla']) {
      const p = byName(v, n);
      expect(p.status).toBe('out');
      expect(p.total).toBeGreaterThanOrEqual(100);
      expect(p.pointsLeft).toBeLessThan(0);
    }
    expect(v.winner).toBe('Ana');
  });

  it('after a win nobody is deciding and there is no dealer', () => {
    const v = computeGame(game([round({ Ana: 10, Beto: 'bust', Carla: 100 })]));
    expect(v.dealer).toBeNull();
    expect(v.playingCount).toBe(1);
    expect(byName(v, 'Beto').status).toBe('out');
    expect(byName(v, 'Ana').status).toBe('active');
  });

  it('reentry returns with highest non-busted total', () => {
    const v = computeGame(game([bustRound({ Beto: 'reenter' })], four));
    const beto = byName(v, 'Beto');
    expect(beto.total).toBe(60);
    expect(beto.reentries).toBe(1);
    expect(beto.playsNextRound).toBe(true);
    expect(beto.reentryTotal).toBe(60);
    expect(v.history[0][1].reenteredWith).toBe(60);
    expect(v.winner).toBeNull();
  });

  it('deciding out does not play next round but can still switch', () => {
    const v = computeGame(game([bustRound({ Beto: 'out' })], four));
    const beto = byName(v, 'Beto');
    expect(beto.status).toBe('deciding');
    expect(beto.playsNextRound).toBe(false);
    expect(v.playingCount).toBe(3);
    expect(v.history[0][1].reenteredWith).toBeUndefined();
  });

  it('deciding without decision does not play next round', () => {
    const v = computeGame(game([bustRound({})], four));
    expect(byName(v, 'Beto').playsNextRound).toBe(false);
    expect(byName(v, 'Beto').decision).toBeUndefined();
  });

  it('decision becomes fixed after next round closes', () => {
    const v = computeGame(game([bustRound({ Beto: 'out' }), round({ Ana: 5, Carla: 5, Davi: 5 })], four));
    expect(byName(v, 'Beto').status).toBe('out');
    expect(v.history[1][1].points).toBeNull();
    expect(v.history[1][1].out).toBe(true);
  });

  it('fixed reenter plays again as active with reentry counted', () => {
    const v = computeGame(
      game([bustRound({ Beto: 'reenter' }), round({ Ana: 5, Beto: 3, Carla: 5, Davi: 5 })], four),
    );
    const beto = byName(v, 'Beto');
    expect(beto.status).toBe('active');
    expect(beto.total).toBe(63);
    expect(beto.reentries).toBe(1);
  });

  it('reentry limit one blocks second reentry', () => {
    const v = computeGame(
      game(
        [
          bustRound({ Beto: 'reenter' }),
          round({ Ana: 5, Beto: 'bust', Carla: 5, Davi: 5 }, { Beto: 'reenter' }),
        ],
        four,
        'one',
      ),
    );
    expect(byName(v, 'Beto').canReenter).toBe(false);
    expect(byName(v, 'Ana').canReenter).toBe(true);
  });

  it('dealer skips players who are out', () => {
    const rounds = [bustRound({ Beto: 'out' }), round({ Ana: 5, Carla: 5, Davi: 5 })];
    expect(computeGame(game(rounds.slice(0, 1), four)).dealer).toBe('Carla');
    expect(computeGame(game(rounds, four)).dealer).toBe('Davi');
  });
});
