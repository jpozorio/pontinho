import { Injectable, Signal, computed, effect, signal } from '@angular/core';
import { ActionError, Result, closeRound, decide, editRound, setDraftScore, truncateFrom } from '../domain/actions';
import { GameView, computeGame } from '../domain/engine';
import { CashError, CashView, addMovement, closeNight, computeCash, removeMovement } from '../domain/cash';
import { migrate } from '../domain/migrate';
import {
  AppData,
  Decision,
  Game,
  GameConfig,
  NewMovement,
  Night,
  Pending,
  ReentryLimit,
  Score,
  newGame,
  newNight,
} from '../domain/model';
import { AgreementError, GameMoney, clearAgreement, computeMoney, setAgreement } from '../domain/money';

/** Aviso para a tela mostrar uma vez (ex.: acordo removido por um desfazer/reentrada). */
export type StoreNotice = 'agreement-dropped';

export const STORAGE_KEY = 'pontinho:v1';
const LEGACY_VALUE_KEY = 'game-value';

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return migrate(raw === null ? null : JSON.parse(raw));
  } catch {
    return migrate(null);
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
  private readonly _error = signal<ActionError | AgreementError | CashError | null>(null);
  private readonly _notice = signal<StoreNotice | null>(null);

  readonly data: Signal<AppData> = this._data.asReadonly();
  readonly game: Signal<Game | null> = computed(() => this._data().current);
  readonly view: Signal<GameView | null> = computed(() => {
    const g = this.game();
    return g ? computeGame(g) : null;
  });
  readonly money: Signal<GameMoney | null> = computed(() => {
    const g = this.game();
    return g ? computeMoney(g) : null;
  });
  readonly night: Signal<Night | null> = computed(() => this._data().night);
  readonly pendings: Signal<Pending[]> = computed(() => this._data().pendings);
  /** Saldo da noite (partidas terminadas + atual + movimentos); null sem noite aberta. */
  readonly cash: Signal<CashView | null> = computed(() => {
    const n = this.night();
    return n ? computeCash(n, this.game()) : null;
  });
  readonly lastError: Signal<ActionError | AgreementError | CashError | null> = this._error.asReadonly();
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
    const d = this._data();
    const last = d.night?.games.at(-1) ?? d.lastFinished;
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
      night: d.night ?? newNight(),
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

  /** Jogador paga ao caixa. */
  payIn(player: string, amount: number): boolean {
    return this.move({ kind: 'in', player, amount });
  }

  /** Caixa paga ao jogador (limitado ao que há no caixa). */
  payOut(player: string, amount: number): boolean {
    return this.move({ kind: 'out', player, amount });
  }

  /** Jogador paga direto a outro jogador. */
  transfer(from: string, to: string, amount: number): boolean {
    return this.move({ kind: 'transfer', from, to, amount });
  }

  removeMovement(id: string): boolean {
    return this.applyNight((n, g) => removeMovement(n, id, g));
  }

  /** Acerto final: o que ficou sem pagar vira pendência e a noite fecha. */
  closeNight(): boolean {
    const d = this._data();
    if (!d.night) return false;
    const r = closeNight(d.night, d.current);
    if ('error' in r) {
      this._error.set(r.error);
      return false;
    }
    this._error.set(null);
    // Uma partida terminada e não arquivada já contou na noite fechada: sai da tela junto com ela.
    const done = d.current;
    this._data.update((x) => ({
      ...x,
      night: null,
      current: null,
      pendings: [...x.pendings, ...r.pendings],
      ...(done ? { lastFinished: done } : {}),
    }));
    return true;
  }

  /** Marca a pendência como paga (só remove). */
  settlePending(id: string): void {
    this._data.update((d) => ({ ...d, pendings: d.pendings.filter((p) => p.id !== id) }));
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
    this._data.update((d) => ({
      ...d,
      current: null,
      night: d.night ? { ...d.night, games: [...d.night.games, g] } : null,
      lastFinished: g,
    }));
    return true;
  }

  abandonGame(): void {
    this._error.set(null);
    this._data.update((d) => ({ ...d, current: null }));
  }

  /** Roda a ação e avisa se ela removeu o acordo existente. */
  private watchAgreement<T>(run: () => T): T {
    const had = this.game()?.agreement !== undefined;
    const result = run();
    if (had && this.game() !== null && this.game()?.agreement === undefined) this._notice.set('agreement-dropped');
    return result;
  }

  private move(m: NewMovement): boolean {
    return this.applyNight((n, g) => addMovement(n, m, g));
  }

  /** Aplica uma ação à noite aberta; em erro guarda `lastError` e não muda nada. */
  private applyNight(fn: (n: Night, current: Game | null) => { night: Night } | { error: CashError }): boolean {
    const d = this._data();
    if (!d.night) return false;
    const r = fn(d.night, d.current);
    if ('error' in r) {
      this._error.set(r.error);
      return false;
    }
    this._error.set(null);
    this._data.update((x) => ({ ...x, night: r.night }));
    return true;
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
