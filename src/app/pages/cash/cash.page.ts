import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { CashError, CashRow } from '../../domain/cash';
import { AgreementError } from '../../domain/money';
import { parseAmount } from '../../shared/parse-amount';
import { PayButton } from '../../shared/pay-button';
import { GameStore } from '../../state/game-store';
import { AgreementModal } from './agreement.modal';
import { SettleModal } from './settle.modal';
import { TransferModal, TransferResult } from './transfer.modal';

const AGREEMENT_MESSAGES: Record<AgreementError, string> = {
  'not-two-players': 'O acordo só vale com 2 jogadores',
  'invalid-amount': 'Valor inválido',
  'exceeds-pot': 'O acordo passa do valor do pote',
};

const CASH_MESSAGES: Partial<Record<CashError, string>> = {
  'exceeds-cash': 'O caixa não tem esse valor',
  'invalid-amount': 'Valor inválido',
  'same-player': 'Escolha outro jogador',
};

@Component({
  selector: 'app-cash',
  imports: [
    CurrencyPipe,
    DatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    PayButton,
  ],
  templateUrl: './cash.page.html',
  styleUrl: './cash.page.scss',
})
export class CashPage {
  private readonly store = inject(GameStore);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);
  private readonly route = inject(ActivatedRoute);

  /** Na aba da partida não há botão voltar; fora dela (#/caixa) há. */
  readonly inTab = this.route.snapshot.parent?.routeConfig?.path === 'jogo';

  readonly night = this.store.night;
  readonly cash = this.store.cash;
  readonly pendings = this.store.pendings;
  readonly money = this.store.money;
  readonly game = this.store.game;
  readonly rows = computed(() => this.cash()?.rows ?? []);
  /** movimentos, mais recentes primeiro */
  readonly movements = computed(() => [...(this.night()?.movements ?? [])].reverse());
  /** a partida atual ainda sem vencedor */
  readonly playing = computed(() => {
    const v = this.store.view();
    return !!this.game() && !!v && v.winner === null;
  });

  /** erro mostrado na tela, preso aos movimentos do momento: qualquer lançamento novo/removido o apaga */
  private readonly raised = signal<{ text: string; movements: unknown } | null>(null);
  readonly message = computed(() => {
    const r = this.raised();
    return r && r.movements === this.night()?.movements ? r.text : null;
  });

  readonly canAgree = computed(() => {
    const v = this.store.view();
    return this.playing() && !!v && v.playingCount === 2;
  });

  readonly agreement = computed(() => {
    const saves = this.game()?.agreement?.saves;
    return saves ? Object.entries(saves).map(([name, amount]) => ({ name, amount })) : null;
  });

  /** Valor sugerido no "pagou ao caixa": o que o jogador deve na noite. */
  suggested(r: CashRow): number {
    return r.balance < 0 ? -r.balance : 0;
  }

  /** Valor sugerido no "recebeu do caixa": o que tem a receber, até o que há no caixa. */
  suggestedOut(r: CashRow): number {
    return r.balance > 0 ? Math.min(r.balance, this.cash()?.cash ?? 0) : 0;
  }

  describe(m: ReturnType<typeof this.movements>[number]): string {
    const v = ' R$ ' + m.amount.toFixed(2).replace('.', ',');
    if (m.kind === 'in') return `${m.player} pagou ao caixa${v}`;
    if (m.kind === 'out') return `Caixa pagou a ${m.player}${v}`;
    return `${m.from} pagou a ${m.to}${v}`;
  }

  raise(e: CashError | null): void {
    this.raised.set({ text: (e && CASH_MESSAGES[e]) ?? 'Valor inválido', movements: this.night()?.movements });
  }

  async openTransfer(r: CashRow): Promise<void> {
    this.raised.set(null);
    const modal = await this.modals.create({
      component: TransferModal,
      componentProps: {
        from: r.player,
        others: this.rows()
          .map((x) => x.player)
          .filter((p) => p !== r.player),
        suggested: this.suggested(r),
      },
    });
    await modal.present();
    const res = await modal.onDidDismiss<TransferResult | null>();
    if (res.role !== 'save' || !res.data) return;
    const amount = parseAmount(res.data.amount);
    if (amount === null) return this.raise('invalid-amount');
    if (!this.store.transfer(r.player, res.data.to, amount)) this.raise(this.store.lastError() as CashError | null);
  }

  async openSettle(): Promise<void> {
    const modal = await this.modals.create({ component: SettleModal });
    await modal.present();
  }

  async removeMovement(id: string): Promise<void> {
    this.raised.set(null);
    if (!(await this.confirm('Remover este lançamento?', 'Remover'))) return;
    if (!this.store.removeMovement(id)) this.raise(this.store.lastError() as CashError | null);
  }

  async settle(id: string): Promise<void> {
    if (await this.confirm('Marcar como pago?', 'Pago')) this.store.settlePending(id);
  }

  async openAgreement(): Promise<void> {
    const g = this.game();
    const v = this.store.view();
    if (!g || !v) return;
    this.raised.set(null);
    const modal = await this.modals.create({
      component: AgreementModal,
      componentProps: {
        names: v.players.filter((p) => p.playsNextRound).map((p) => p.name),
        entryValue: g.config.entryValue,
        initial: { ...(g.agreement?.saves ?? {}) },
      },
    });
    await modal.present();
    const res = await modal.onDidDismiss<Record<string, number> | null>();
    if (res.role !== 'save' || !res.data) return;
    const saves: Record<string, number> = {};
    for (const [name, value] of Object.entries(res.data)) {
      const n = parseAmount(value, true);
      if (n === null) return this.raiseAgreement('invalid-amount');
      saves[name] = n;
    }
    if (this.store.setAgreement(saves)) return;
    this.raiseAgreement(this.store.lastError() as AgreementError | null);
  }

  async removeAgreement(): Promise<void> {
    if (await this.confirm('Remover o acordo?', 'Remover')) {
      this.raised.set(null);
      this.store.clearAgreement();
    }
  }

  private raiseAgreement(e: AgreementError | null): void {
    this.raised.set({
      text: (e && AGREEMENT_MESSAGES[e]) ?? 'Valor inválido',
      movements: this.night()?.movements,
    });
  }

  private async confirm(header: string, action: string): Promise<boolean> {
    const a = await this.alerts.create({
      header,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: action, role: 'confirm' },
      ],
    });
    await a.present();
    return (await a.onDidDismiss()).role === 'confirm';
  }
}
