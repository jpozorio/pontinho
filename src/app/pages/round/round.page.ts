import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { ActionError } from '../../domain/actions';
import { PlayerView } from '../../domain/engine';
import { Decision } from '../../domain/model';
import { parseAmount } from '../../shared/parse-amount';
import { GameStore } from '../../state/game-store';
import { LeftLevel, leftLevel } from './points-left';

interface Row {
  p: PlayerView;
  draft: number | 'bust' | null;
  /** total mostrado com o rascunho; null quando o rascunho é estouro */
  preview: number | null;
  left: number | null;
  level: LeftLevel;
  grey: boolean;
  invalid: boolean;
}

@Component({
  selector: 'app-round',
  imports: [CurrencyPipe, IonButton, IonContent, IonHeader, IonInput, IonSegment, IonSegmentButton, IonTitle, IonToolbar],
  templateUrl: './round.page.html',
  styleUrl: './round.page.scss',
})
export class RoundPage {
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);

  readonly view = this.store.view;
  readonly money = this.store.money;
  private readonly invalidNames = signal<ReadonlySet<string>>(new Set());
  private readonly closeError = signal<ActionError | null>(null);

  readonly rows = computed<Row[]>(() => {
    const v = this.view();
    const g = this.store.game();
    if (!v || !g) return [];
    const invalid = this.invalidNames();
    return v.players.map((p) => {
      const draft = p.playsNextRound ? (g.draft[p.name] ?? null) : null;
      const preview = typeof draft === 'number' ? p.total + draft : draft === null ? p.total : null;
      const left = typeof draft === 'number' ? p.pointsLeft - draft : draft === 'bust' ? null : p.pointsLeft;
      return {
        p,
        draft,
        preview,
        left,
        level: left === null ? 'bust' : leftLevel(left),
        grey: p.status === 'out' || (p.status === 'deciding' && p.decision !== 'reenter'),
        invalid: invalid.has(p.name),
      };
    });
  });

  readonly errorMessage = computed(() => {
    const e = this.closeError();
    const v = this.view();
    switch (e) {
      case 'missing-scores':
        return 'Lance os pontos de todos';
      case 'all-bust':
        return 'Alguém precisa ficar abaixo de 100 — confira os pontos';
      case 'pending-decision': {
        const name = v?.players.find((p) => p.status === 'deciding' && !p.decision)?.name;
        return name ? `Falta decidir se ${name} reentra` : 'Falta decidir quem reentra';
      }
      case 'invalid-score':
        return 'Pontos inválidos';
      default:
        return null;
    }
  });

  inputValue(r: Row): string {
    return typeof r.draft === 'number' ? String(r.draft) : '';
  }

  onInput(name: string, ev: Event): void {
    const raw = String((ev as CustomEvent<{ value?: string | null }>).detail?.value ?? '').trim();
    const mark = (bad: boolean) =>
      this.invalidNames.update((s) => {
        if (s.has(name) === bad) return s;
        const next = new Set(s);
        if (bad) next.add(name);
        else next.delete(name);
        return next;
      });
    if (raw === '') {
      mark(false);
      this.store.setDraftScore(name, null);
    } else if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))) {
      mark(false);
      this.store.setDraftScore(name, Number(raw));
    } else {
      mark(true);
      this.store.setDraftScore(name, null);
    }
    this.closeError.set(null);
  }

  toggleBust(r: Row): void {
    this.closeError.set(null);
    this.invalidNames.update((s) => {
      const next = new Set(s);
      next.delete(r.p.name);
      return next;
    });
    this.store.setDraftScore(r.p.name, r.draft === 'bust' ? null : 'bust');
  }

  decide(name: string, ev: Event): void {
    const value = (ev as CustomEvent<{ value?: string | number }>).detail?.value;
    this.closeError.set(null);
    if (value === 'reenter' || value === 'out') this.store.decide(name, value as Decision);
  }

  async close(): Promise<void> {
    if (!this.store.closeRound()) {
      const e = this.store.lastError();
      this.closeError.set(e as ActionError | null);
      return;
    }
    this.closeError.set(null);
    this.invalidNames.set(new Set());
    const v = this.view();
    if (v?.winner) {
      await this.router.navigateByUrl('/fim');
      return;
    }
    const asking = (v?.players ?? []).filter((p) => p.status === 'deciding' && !p.decision && p.canReenter);
    for (const p of asking) await this.askReentry(p);
  }

  private async askReentry(p: PlayerView): Promise<void> {
    const entry = this.store.game()?.config.entryValue ?? 0;
    const choice = await this.choose(`${p.name} estourou. Reentra com ${p.reentryTotal ?? 0}?`, [
      { text: 'Sai', role: 'out' },
      { text: 'Reentra', role: 'reenter' },
    ]);
    if (choice !== 'reenter') {
      if (choice === 'out') this.store.decide(p.name, 'out');
      return;
    }
    if (!this.store.decide(p.name, 'reenter')) return;
    const paid = await this.alerts.create({
      header: 'Pagou agora?',
      backdropDismiss: false,
      inputs: [{ name: 'amount', type: 'text', value: String(entry) }],
      buttons: [
        { text: 'Não', role: 'cancel' },
        { text: 'Pagou', role: 'confirm' },
      ],
    });
    await paid.present();
    const res = await paid.onDidDismiss<{ values?: { amount?: string | number } }>();
    if (res.role === 'confirm') {
      const amount = parseAmount(res.data?.values?.amount);
      if (amount !== null) this.store.addPayment(p.name, amount);
    }
  }

  private async choose(header: string, buttons: { text: string; role: string }[]): Promise<string | undefined> {
    const a = await this.alerts.create({ header, backdropDismiss: false, buttons });
    await a.present();
    return (await a.onDidDismiss()).role;
  }
}
