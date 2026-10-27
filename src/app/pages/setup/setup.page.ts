import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ReentryLimit } from '../../domain/model';
import { GameStore } from '../../state/game-store';
import { validatePlayers } from './validate-players';

interface Row {
  id: number;
  name: string;
}

@Component({
  selector: 'app-setup',
  imports: [
    CurrencyPipe,
    RouterLink,
    IonAlert,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonReorder,
    IonReorderGroup,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class SetupPage {
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);
  private nextId = 0;

  readonly game = this.store.game;
  readonly rows = signal<Row[]>([]);
  readonly entryText = signal('');
  readonly reentryLimit = signal<ReentryLimit>('unlimited');
  readonly confirmOpen = signal(false);

  readonly blockingGame = computed(() => {
    const g = this.game();
    return g && g.finishedAt === undefined ? g : null;
  });
  readonly finishedGame = computed(() => {
    const g = this.game();
    return g && g.finishedAt !== undefined ? g : null;
  });

  readonly alertButtons = [
    { text: 'Cancelar', role: 'cancel' },
    { text: 'Abandonar', role: 'confirm' },
  ];

  readonly entryValue = computed(() => {
    const text = this.entryText().trim();
    const n = Number(text.replace(',', '.'));
    return text !== '' && Number.isFinite(n) && n > 0 ? n : null;
  });

  private readonly validation = computed(() => validatePlayers(this.rows().map((r) => r.name)));

  readonly error = computed(() => {
    const v = this.validation();
    if ('error' in v) {
      if (v.error === 'too-few') return 'Informe pelo menos 2 jogadores';
      if (v.error === 'empty-name') return `Nome vazio na linha ${(v.index ?? 0) + 1}`;
      return `Nome repetido: ${this.rows()[v.index ?? 0].name.trim()}`;
    }
    return this.entryValue() === null ? 'Informe o valor da entrada' : null;
  });

  constructor() {
    const pending = this.store.consumePendingConfig();
    if (pending) {
      this.rows.set(pending.players.map((name) => this.row(name)));
      this.entryText.set(String(pending.entryValue));
      this.reentryLimit.set(pending.reentryLimit);
    } else {
      const d = this.store.defaultConfig();
      this.rows.set(Array.from({ length: 4 }, () => this.row('')));
      this.entryText.set(String(d.entryValue));
      this.reentryLimit.set(d.reentryLimit);
    }
  }

  private row(name: string): Row {
    return { id: this.nextId++, name };
  }

  inputValue(ev: Event): string {
    return String((ev as CustomEvent<{ value?: string | null }>).detail?.value ?? '');
  }

  setName(id: number, ev: Event): void {
    const name = this.inputValue(ev);
    this.rows.update((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)));
  }

  add(): void {
    this.rows.update((rs) => [...rs, this.row('')]);
  }

  remove(id: number): void {
    this.rows.update((rs) => rs.filter((r) => r.id !== id));
  }

  onReorder(ev: Event): void {
    const { complete } = (ev as CustomEvent).detail as { complete: (data: Row[]) => Row[] };
    this.rows.set(complete([...this.rows()]));
  }

  onReentry(ev: Event): void {
    const v = (ev as CustomEvent<{ value?: string | number }>).detail?.value;
    if (v === 'one' || v === 'unlimited') this.reentryLimit.set(v);
  }

  debtOf(name: string): number {
    const n = name.trim();
    if (!n) return 0;
    return this.store.debtsFor([n]).reduce((s, d) => s + d.amount, 0);
  }

  onAlertDismiss(ev: Event): void {
    this.confirmOpen.set(false);
    if ((ev as CustomEvent<{ role?: string }>).detail?.role === 'confirm') this.store.abandonGame();
  }

  start(): void {
    const v = this.validation();
    const entry = this.entryValue();
    if ('error' in v || entry === null || this.game()) return;
    this.store.startGame({ entryValue: entry, reentryLimit: this.reentryLimit(), players: v.names });
    void this.router.navigateByUrl('/jogo/rodada');
  }
}
