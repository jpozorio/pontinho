import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { startGuard } from '../start.guard';
import { GameConfig } from '../domain/model';
import { GameStore, STORAGE_KEY } from './game-store';

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, current: null, finished: [] }));
    expect(fresh().data()).toEqual({ version: 1, current: null, finished: [] });
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
    expect(s.data().finished.length).toBe(1);
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
    expect(s.data().finished.length).toBe(0);
  });

  it('closeRound failure sets lastError and success clears it', () => {
    const s = fresh();
    s.startGame(config);
    expect(s.closeRound()).toBe(false);
    expect(s.lastError()).toBe('missing-scores');
    s.setDraftScore('Ana', 1);
    expect(s.lastError()).toBeNull();
  });

  it('debtsFor filters by debtor and money uses finished debts', () => {
    const s = fresh();
    s.startGame(config);
    finishWithCarla(s);
    s.archiveFinished();
    s.startGame({ ...config, players: ['Carla', 'Ana', 'Beto'] });
    expect(s.debtsFor(['Ana']).map((d) => d.debtor)).toEqual(['Ana']);
    expect(s.debtsFor(['Zed'])).toEqual([]);
    expect(s.money()?.rows.find((r) => r.player === 'Ana')?.oldDebts.length).toBe(1);
  });

  it('abandonGame discards without archiving', () => {
    const s = fresh();
    s.startGame(config);
    s.abandonGame();
    expect(s.game()).toBeNull();
    expect(s.data().finished.length).toBe(0);
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
