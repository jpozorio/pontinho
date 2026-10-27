import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { gameGuard, startGuard } from '../start.guard';
import { GameConfig } from '../domain/model';
import { BACKUP_KEY, GameStore, STORAGE_KEY } from './game-store';

const config: GameConfig = { entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] };

function fresh(): GameStore {
  TestBed.resetTestingModule();
  return TestBed.inject(GameStore);
}

function finishWithCarla(s: GameStore): void {
  s.setDraftScore('Ana', 'bust');
  s.setDraftScore('Beto', 'bust');
  s.setDraftScore('Carla', 5);
  expect(s.closeRound()).toBe(true);
}

describe('GameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('persists draft scores across reload', () => {
    const s = TestBed.inject(GameStore);
    s.startGame(config);
    s.setDraftScore('Ana', 12);
    TestBed.tick();
    expect(fresh().game()?.draft['Ana']).toBe(12);
  });

  it('starts empty on corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(fresh().game()).toBeNull();
  });

  it('starts empty on unknown version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, current: null, finished: [] }));
    expect(fresh().data()).toEqual({ version: 2, current: null, night: null, pendings: [] });
  });

  it('reads legacy game-value as default entry', () => {
    localStorage.setItem('game-value', '3');
    expect(fresh().defaultConfig()).toEqual({ entryValue: 3, reentryLimit: 'unlimited' });
  });

  it('defaults to 1 without legacy value, and prefers lastConfig', () => {
    const s = fresh();
    expect(s.defaultConfig().entryValue).toBe(1);
    s.startGame({ ...config, entryValue: 7, reentryLimit: 'one' });
    expect(s.defaultConfig()).toEqual({ entryValue: 7, reentryLimit: 'one' });
  });

  it('archiveFinished archives and nextConfig puts winner first, surviving reload', () => {
    const s = fresh();
    expect(s.nextConfig()).toBeNull();
    s.startGame({ ...config, entryValue: 2.5, reentryLimit: 'one' });
    finishWithCarla(s);
    expect(s.archiveFinished()).toBe(true);
    expect(s.data().current).toBeNull();
    expect(s.night()!.games.length).toBe(1);
    const next = { entryValue: 2.5, reentryLimit: 'one', players: ['Carla', 'Ana', 'Beto'] };
    expect(s.nextConfig()).toEqual(next);
    TestBed.tick();
    expect(fresh().nextConfig()).toEqual(next);
  });

  it('archiveFinished does nothing without a winner', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.archiveFinished()).toBe(false);
    expect(s.game()).not.toBeNull();
    expect(s.night()!.games.length).toBe(0);
  });

  it('closeRound failure sets lastError and success clears it', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.closeRound()).toBe(false);
    expect(s.lastError()).toBe('missing-scores');
    s.setDraftScore('Ana', 1);
    expect(s.lastError()).toBeNull();
  });

  it('notices when decide or undo drops the agreement, and only then', () => {
    const s = fresh();
    s.startGame({ ...config, players: ['Ana', 'Beto', 'Carla', 'Davi'] });
    for (const [p, v] of [['Ana', 40], ['Beto', 30], ['Carla', 'bust'], ['Davi', 'bust']] as const) s.setDraftScore(p, v);
    expect(s.closeRound()).toBe(true);
    s.decide('Davi', 'out');
    s.decide('Carla', 'out');
    expect(s.setAgreement({ Ana: 10, Beto: 10 })).toBe(true);
    expect(s.notice()).toBeNull();

    s.decide('Carla', 'reenter');
    expect(s.game()!.agreement).toBeUndefined();
    expect(s.takeNotice()).toBe('agreement-dropped');
    expect(s.notice()).toBeNull();

    s.decide('Carla', 'out');
    expect(s.notice()).toBeNull();
    expect(s.setAgreement({ Ana: 10, Beto: 10 })).toBe(true);
    s.undoFrom(0);
    expect(s.game()!.agreement).toBeUndefined();
    expect(s.takeNotice()).toBe('agreement-dropped');

    s.undoFrom(0);
    expect(s.takeNotice()).toBeNull();
  });

  it('abandonGame discards without archiving', () => {
    const s = fresh();
    s.startGame(config);
    s.abandonGame();
    expect(s.game()).toBeNull();
    expect(s.night()!.games.length).toBe(0);
  });

  it('persists the night across reload', () => {
    const s = fresh();
    s.startGame(config);
    finishWithCarla(s);
    expect(s.archiveFinished()).toBe(true);
    s.startGame({ ...config, players: ['Carla', 'Ana', 'Beto'] });
    finishWithCarla(s);
    expect(s.archiveFinished()).toBe(true);
    s.startGame(config);
    s.setDraftScore('Ana', 7);
    expect(s.payIn('Ana', 5)).toBe(true);
    expect(s.transfer('Beto', 'Carla', 2)).toBe(true);
    expect(s.payOut('Carla', 3)).toBe(true);
    TestBed.tick();
    const before = s.data();
    const after = fresh();
    expect(after.data()).toEqual(before);
    expect(after.night()!.games.length).toBe(2);
    expect(after.night()!.movements.length).toBe(3);
    expect(after.game()!.draft['Ana']).toBe(7);
    expect(after.cash()).toEqual(s.cash());
  });

  it('startGame opens a night once', () => {
    const s = fresh();
    expect(s.night()).toBeNull();
    expect(s.cash()).toBeNull();
    s.startGame(config);
    const id = s.night()!.id;
    s.abandonGame();
    s.startGame(config);
    expect(s.night()!.id).toBe(id);
    expect(s.cash()!.games).toBe(0);
  });

  it('archiveFinished adds to the night', () => {
    const s = fresh();
    s.startGame(config);
    finishWithCarla(s);
    const g = s.game()!;
    expect(s.archiveFinished()).toBe(true);
    expect(s.night()!.games).toEqual([g]);
    expect(s.data().lastFinished).toEqual(g);
    expect(s.cash()!.games).toBe(1);
    expect(s.cash()!.rows.find((r) => r.player === 'Carla')!.balance).toBe(10);
  });

  it('abandoned game does not count but its movements stay', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.payIn('Ana', 5)).toBe(true);
    expect(s.cash()!.rows.find((r) => r.player === 'Ana')!.balance).toBe(0);
    s.abandonGame();
    expect(s.cash()!.rows.find((r) => r.player === 'Ana')!.balance).toBe(5);
    expect(s.cash()!.cash).toBe(5);
    expect(s.night()!.games.length).toBe(0);
  });

  it('closeNight stores pendings and clears the night', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.closeNight()).toBe(false);
    expect(s.lastError()).toBe('game-in-progress');
    finishWithCarla(s);
    expect(s.archiveFinished()).toBe(true);
    expect(s.payIn('Ana', 5)).toBe(true);
    expect(s.closeNight()).toBe(false);
    expect(s.lastError()).toBe('cash-not-empty');
    expect(s.payOut('Carla', 5)).toBe(true);
    expect(s.closeNight()).toBe(true);
    expect(s.lastError()).toBeNull();
    expect(s.night()).toBeNull();
    expect(s.cash()).toBeNull();
    expect(s.pendings().map((p) => [p.debtor, p.creditor, p.amount])).toEqual([['Beto', 'Carla', 5]]);
    expect(s.nextConfig()!.players).toEqual(['Carla', 'Ana', 'Beto']);
    TestBed.tick();
    expect(fresh().pendings()).toEqual(s.pendings());

    s.startGame(config);
    expect(s.night()!.movements).toEqual([]);
    expect(s.pendings().length).toBe(1);
    s.settlePending(s.pendings()[0].id);
    expect(s.pendings()).toEqual([]);
  });

  it('closeNight with a finished game not yet archived takes it along', () => {
    const s = fresh();
    s.startGame(config);
    finishWithCarla(s);
    const g = s.game()!;
    expect(s.closeNight()).toBe(true);
    expect(s.game()).toBeNull();
    expect(s.data().lastFinished).toEqual(g);
    expect(s.pendings().map((p) => [p.debtor, p.creditor, p.amount])).toEqual([
      ['Ana', 'Carla', 5],
      ['Beto', 'Carla', 5],
    ]);
  });

  it('payOut beyond cash sets lastError exceeds-cash', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.payIn('Ana', 5)).toBe(true);
    expect(s.payOut('Beto', 10)).toBe(false);
    expect(s.lastError()).toBe('exceeds-cash');
    expect(s.night()!.movements.length).toBe(1);
    expect(s.payOut('Beto', 5)).toBe(true);
    expect(s.lastError()).toBeNull();
    expect(s.transfer('Ana', 'Ana', 1)).toBe(false);
    expect(s.lastError()).toBe('same-player');
    expect(s.payIn('Ana', 0)).toBe(false);
    expect(s.lastError()).toBe('invalid-amount');
  });

  it('removeMovement refuses to leave the cash negative', () => {
    const s = fresh();
    s.startGame(config);
    s.payIn('Ana', 5);
    s.payOut('Beto', 5);
    const [paidIn, paidOut] = s.night()!.movements;
    expect(s.removeMovement(paidIn.id)).toBe(false);
    expect(s.lastError()).toBe('exceeds-cash');
    expect(s.removeMovement(paidOut.id)).toBe(true);
    expect(s.removeMovement(paidIn.id)).toBe(true);
    expect(s.night()!.movements).toEqual([]);
  });

  it('cash actions fail without an open night', () => {
    const s = fresh();
    expect(s.payIn('Ana', 5)).toBe(false);
    expect(s.closeNight()).toBe(false);
    expect(s.night()).toBeNull();
  });

  it('backs up the stored v1 before overwriting it, only once', () => {
    const v1 = JSON.stringify({ version: 1, current: null, finished: [null] });
    localStorage.setItem(STORAGE_KEY, v1);
    const s = fresh();
    expect(s.night()).toBeNull();
    TestBed.tick();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(v1);
    localStorage.setItem(STORAGE_KEY, '{oops');
    fresh();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(v1);
  });

  it('backs up unreadable data and does not back up v2', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    fresh();
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{oops');
    localStorage.clear();
    const s = fresh();
    s.startGame(config);
    TestBed.tick();
    fresh();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it('archiveFinished puts the game in a night even without one', () => {
    const s = fresh();
    s.startGame(config);
    finishWithCarla(s);
    const g = s.game()!;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s.data(), night: null }));
    const t = fresh();
    expect(t.archiveFinished()).toBe(true);
    expect(t.night()!.games).toEqual([g]);
  });

  it('migrates stored v1 on load', () => {
    const current = {
      id: 'g1',
      startedAt: '2026-10-27T20:00:00.000Z',
      config,
      rounds: [{ scores: { Ana: 10, Beto: 20, Carla: 30 }, decisions: {} }],
      draft: {},
      payments: [{ id: 'p1', player: 'Beto', amount: 5, at: '2026-10-27T20:05:00.000Z' }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, current, finished: [] }));
    const s = fresh();
    expect(s.data().version).toBe(2);
    expect(s.game()!.rounds.length).toBe(1);
    expect(s.night()!.movements.map((m) => m.id)).toEqual(['p1']);
    expect(s.cash()!.cash).toBe(5);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2);
  });

  it('does not throw when storage writes fail', () => {
    const s = fresh();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    s.startGame(config);
    expect(() => TestBed.tick()).not.toThrow();
    spy.mockRestore();
  });
});

describe('startGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const run = () =>
    TestBed.runInInjectionContext(() => startGuard({} as never, {} as never)) as ReturnType<Router['parseUrl']>;

  it('goes to /novo without a game', () => {
    expect(TestBed.inject(Router).serializeUrl(run())).toBe('/novo');
  });

  it('goes to /jogo/rodada with a running game', () => {
    TestBed.inject(GameStore).startGame(config);
    expect(TestBed.inject(Router).serializeUrl(run())).toBe('/jogo/rodada');
  });

  it('goes to /fim with a finished game', () => {
    const s = TestBed.inject(GameStore);
    s.startGame(config);
    finishWithCarla(s);
    expect(TestBed.inject(Router).serializeUrl(run())).toBe('/fim');
  });
});

describe('gameGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const run = () => TestBed.runInInjectionContext(() => gameGuard({} as never, {} as never));
  const url = (r: ReturnType<typeof run>) => TestBed.inject(Router).serializeUrl(r as ReturnType<Router['parseUrl']>);

  it('redirects to /novo without a game', () => {
    expect(url(run())).toBe('/novo');
  });

  it('lets a running game through', () => {
    TestBed.inject(GameStore).startGame(config);
    expect(run()).toBe(true);
  });

  it('redirects to /fim when the game is finished', () => {
    const s = TestBed.inject(GameStore);
    s.startGame(config);
    finishWithCarla(s);
    expect(url(run())).toBe('/fim');
  });

  it('lets the game through again after undoing the last round', () => {
    const s = TestBed.inject(GameStore);
    s.startGame(config);
    finishWithCarla(s);
    s.undoFrom(0);
    expect(run()).toBe(true);
  });
});
