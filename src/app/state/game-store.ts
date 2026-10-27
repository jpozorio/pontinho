import { Injectable, Signal, computed, effect, signal } from '@angular/core';
import { ActionError, Result, closeRound, decide, editRound, setDraftScore, truncateFrom } from '../domain/actions';
import { GameView, computeGame } from '../domain/engine';
import { AppData, Decision, Game, GameConfig, ReentryLimit, Score, newGame } from '../domain/model';
import {
  AgreementError,
  Debt,
  MoneyView,
  addPayment,
  clearAgreement,
  computeDebts,
  computeMoney,
  removePayment,
  setAgreement,
} from '../domain/money';

/** Aviso para a tela mostrar uma vez (ex.: acordo removido por um desfazer/reentrada). */
export type StoreNotice = 'agreement-dropped';

export const STORAGE_KEY = 'pontinho:v1';
const LEGACY_VALUE_KEY = 'game-value';

const emptyData = (): AppData => ({ version: 1, current: null, finished: [] });

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyData();
    const parsed = JSON.parse(raw) as AppData | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return emptyData();
    return { ...parsed, current: parsed.current ?? null, finished: parsed.finished ?? [] };
  } catch {
    return emptyData();
  }
}

function legacyEntryValue(): number {
  try {
    const n = Number(localStorage.getItem(LEGACY_VALUE_KEY));
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly _data = signal<AppData>(load());
  private readonly _error = signal<ActionError | AgreementError | null>(null);
  private readonly _notice = signal<StoreNotice | null>(null);

  readonly data: Signal<AppData> = this._data.asReadonly();
  readonly game: Signal<Game | null> = computed(() => this._data().current);
  readonly view: Signal<GameView | null> = computed(() => {
    const g = this.game();
    return g ? computeGame(g) : null;
  });
  readonly money: Signal<MoneyView | null> = computed(() => {
    const g = this.game();
    return g ? computeMoney(g, computeDebts(this._data().finished)) : null;
  });
  readonly lastError: Signal<ActionError | AgreementError | null> = this._error.asReadonly();
  readonly notice: Signal<StoreNotice | null> = this._notice.asReadonly();

  constructor() {
    effect(() => {
      const json = JSON.stringify(this._data());
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        // cota cheia ou modo privado: segue só em memória
      }
    });
  }

  defaultConfig(): { entryValue: number; reentryLimit: ReentryLimit } {
    return this._data().lastConfig ?? { entryValue: legacyEntryValue(), reentryLimit: 'unlimited' };
  }

  /** Pré-preenchimento da próxima partida: os jogadores da última terminada, vencedor primeiro. */
  nextConfig(): GameConfig | null {
    const last = this._data().finished.at(-1);
    if (!last) return null;
    const players = last.config.players;
    const at = Math.max(0, players.indexOf(computeGame(last).winner ?? ''));
    return { ...last.config, players: [...players.slice(at), ...players.slice(0, at)] };
  }

  startGame(config: GameConfig): void {
    this._error.set(null);
    this._data.update((d) => ({
      ...d,
      current: newGame(config),
      lastConfig: { entryValue: config.entryValue, reentryLimit: config.reentryLimit },
    }));
  }

  setDraftScore(player: string, score: Score | null): boolean {
    return this.apply((g) => setDraftScore(g, player, score));
  }

  closeRound(): boolean {
    return this.apply((g) => closeRound(g));
  }

  decide(player: string, d: Decision): boolean {
    return this.watchAgreement(() => this.apply((g) => decide(g, player, d)));
  }

  editRound(index: number, scores: Record<string, Score>): boolean {
    return this.apply((g) => editRound(g, index, scores));
  }

  undoFrom(index: number): void {
    this.watchAgreement(() => this.apply((g) => ({ game: truncateFrom(g, index) })));
  }

  /** Devolve e limpa o aviso pendente. */
  takeNotice(): StoreNotice | null {
    const n = this._notice();
    this._notice.set(null);
    return n;
  }

  addPayment(player: string, amount: number): void {
    this.apply((g) => ({ game: addPayment(g, player, amount) }));
  }

  removePayment(id: string): void {
    this.apply((g) => ({ game: removePayment(g, id) }));
  }

  setAgreement(saves: Record<string, number>): boolean {
    return this.apply((g) => setAgreement(g, saves));
  }

  clearAgreement(): void {
    this.apply((g) => ({ game: clearAgreement(g) }));
  }

  /** Guarda a partida terminada entre as finalizadas; false se não houver vencedor. */
  archiveFinished(): boolean {
    const g = this.game();
    if (!g || g.finishedAt === undefined || computeGame(g).winner === null) return false;
    this._error.set(null);
    this._data.update((d) => ({ ...d, current: null, finished: [...d.finished, g] }));
    return true;
  }

  abandonGame(): void {
    this._error.set(null);
    this._data.update((d) => ({ ...d, current: null }));
  }

  debtsFor(players: string[]): Debt[] {
    return computeDebts(this._data().finished).filter((d) => players.includes(d.debtor));
  }

  /** Roda a ação e avisa se ela removeu o acordo existente. */
  private watchAgreement<T>(run: () => T): T {
    const had = this.game()?.agreement !== undefined;
    const result = run();
    if (had && this.game() !== null && this.game()?.agreement === undefined) this._notice.set('agreement-dropped');
    return result;
  }

  /** Aplica uma ação à partida atual; em erro guarda `lastError` e não muda nada. */
  private apply(fn: (g: Game) => Result | { game: Game } | { error: AgreementError }): boolean {
    const g = this.game();
    if (!g) return false;
    const r = fn(g);
    if ('error' in r) {
      this._error.set(r.error);
      return false;
    }
    this._error.set(null);
    this._data.update((d) => ({ ...d, current: r.game }));
    return true;
  }
}
