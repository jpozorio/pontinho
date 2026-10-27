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
import { parseAmount } from '../../shared/parse-amount';
import { GameStore } from '../../state/game-store';
import { computeDebts } from '../../domain/money';
import { canonicalName, validatePlayers } from './validate-players';

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

  readonly entryValue = computed(() => parseAmount(this.entryText()));

  /** Dívida total por jogador conhecido (nome na grafia guardada). */
  private readonly debtors = computed(() => {
    const totals = new Map<string, number>();
    for (const d of computeDebts(this.store.data().finished)) {
      totals.set(d.debtor, (totals.get(d.debtor) ?? 0) + d.amount);
    }
    return totals;
  });

  /** Dívida a mostrar ao lado de cada linha, por id. */
  readonly debtHints = computed(() => {
    const totals = this.debtors();
    const known = [...totals.keys()];
    const hints = new Map<number, number>();
    for (const r of this.rows()) {
      const amount = totals.get(canonicalName(r.name, known)) ?? 0;
      if (r.name.trim() !== '' && amount > 0) hints.set(r.id, amount);
    }
    return hints;
  });

  private readonly filled = computed(() => this.rows().filter((r) => r.name.trim() !== ''));
  private readonly validation = computed(() => validatePlayers(this.filled().map((r) => r.name)));

  readonly error = computed(() => {
    const v = this.validation();
    if ('error' in v) {
      if (v.error === 'too-few') return 'Informe pelo menos 2 jogadores';
      if (v.error === 'empty-name') return `Nome vazio na linha ${(v.index ?? 0) + 1}`;
      return `Nome repetido: ${this.filled()[v.index ?? 0].name.trim()}`;
    }
    return this.entryValue() === null ? 'Informe o valor da entrada' : null;
  });

  constructor() {
    this.resetForm();
  }

  /** O Ionic reaproveita a página na pilha: o formulário é refeito a cada entrada. */
  ionViewWillEnter(): void {
    this.resetForm();
  }

  /** Sem partida atual, vem a próxima (vencedor primeiro); senão, linhas vazias com a última regra. */
  private resetForm(): void {
    const next = this.game() ? null : this.store.nextConfig();
    const d = next ?? this.store.defaultConfig();
    this.rows.set(next ? next.players.map((name) => this.row(name)) : Array.from({ length: 4 }, () => this.row('')));
    this.entryText.set(String(d.entryValue).replace('.', ','));
    this.reentryLimit.set(d.reentryLimit);
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

  onAlertDismiss(ev: Event): void {
    this.confirmOpen.set(false);
    if ((ev as CustomEvent<{ role?: string }>).detail?.role !== 'confirm') return;
    this.store.abandonGame();
    if (this.filled().length === 0) this.resetForm();
  }

  start(): void {
    const v = this.validation();
    const entry = this.entryValue();
    if ('error' in v || entry === null || this.game()) return;
    const known = [...this.debtors().keys()];
    const players = v.names.map((n) => canonicalName(n, known));
    this.store.startGame({ entryValue: entry, reentryLimit: this.reentryLimit(), players });
    void this.router.navigateByUrl('/jogo/rodada');
  }
}
