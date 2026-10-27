import { CurrencyPipe, formatCurrency } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { CashError, CashRow, closeNight } from '../../domain/cash';
import { migratedNoteText } from '../../domain/migrated-note';
import { PayButton } from '../../shared/pay-button';
import { parseAmount } from '../../shared/parse-amount';
import { GameStore } from '../../state/game-store';
import { TransferModal, TransferResult } from './transfer.modal';

const CASH_MESSAGES: Partial<Record<CashError, string>> = {
  'exceeds-cash': 'O caixa não tem esse valor',
  'invalid-amount': 'Valor inválido',
  'same-player': 'Escolha outro jogador',
};

const brl = (n: number): string => formatCurrency(n, 'pt-BR', 'R$', 'BRL');

@Component({
  selector: 'app-settle-modal',
  imports: [CurrencyPipe, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, PayButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Acerto final</ion-title>
        <ion-buttons slot="end">
          <ion-button data-cancel (click)="cancel()">Voltar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (night()?.migrated) {
        <p class="note" data-migrated>{{ migratedNote }}</p>
      }
      <p>Dinheiro no caixa <b data-cash>{{ cashAmount() | currency: 'BRL' }}</b></p>

      @if (debtors().length) {
        <section data-payers>
          <h2>Paga</h2>
          @for (r of debtors(); track r.player) {
            <div class="row" [attr.data-payer]="r.player">
              <span>{{ r.player }} <b data-amount>{{ -r.balance | currency: 'BRL' }}</b></span>
              <app-pay-button [player]="r.player" [suggested]="-r.balance" (failed)="raise($event)" />
              <ion-button size="small" shape="round" fill="outline" data-transfer (click)="openTransfer(r)"
                >pagou a…</ion-button
              >
            </div>
          }
        </section>
      }
      @if (creditors().length) {
        <section data-receivers>
          <h2>Recebe</h2>
          @for (r of creditors(); track r.player) {
            <div class="row" [attr.data-receiver]="r.player">
              <span>{{ r.player }} <b data-amount>{{ r.balance | currency: 'BRL' }}</b></span>
              <app-pay-button
                [player]="r.player"
                kind="out"
                [suggested]="suggestedOut(r)"
                (failed)="raise($event)"
              />
              <ion-button size="small" shape="round" fill="outline" data-transfer (click)="openTransfer(r)"
                >pagou a…</ion-button
              >
            </div>
          }
        </section>
      }

      @if (playing()) {
        <p class="error" data-blocked role="alert">Termine ou abandone a partida antes do acerto</p>
      } @else if (cashAmount() > 0) {
        @if (creditors().length) {
          <p class="error" data-blocked role="alert">
            Ainda há {{ cashAmount() | currency: 'BRL' }} no caixa — pague os credores antes de fechar
          </p>
        } @else {
          <p class="error" data-blocked role="alert">
            Ainda há {{ cashAmount() | currency: 'BRL' }} no caixa sem credor — registre a devolução a quem pagou
          </p>
        }
      }
      @if (message(); as msg) {
        <p class="error" data-error role="alert">{{ msg }}</p>
      }

      <ion-button expand="block" data-close [disabled]="!canClose()" (click)="close()">Fechar a noite</ion-button>
    </ion-content>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .note {
      color: var(--ion-color-medium);
    }
    .error {
      color: var(--ion-color-danger);
    }
  `,
})
export class SettleModal {
  private readonly store = inject(GameStore);
  private readonly modal = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly night = this.store.night;
  readonly migratedNote = migratedNoteText();
  readonly rows = computed(() => this.store.cash()?.rows ?? []);
  readonly cashAmount = computed(() => this.store.cash()?.cash ?? 0);
  readonly debtors = computed(() => this.rows().filter((r) => r.balance < 0));
  readonly creditors = computed(() => this.rows().filter((r) => r.balance > 0));
  readonly playing = computed(() => !!this.store.game() && this.store.view()?.winner === null);
  readonly canClose = computed(() => !this.playing() && this.cashAmount() <= 0);

  /** erro do caixa, preso aos movimentos do momento: qualquer lançamento novo o apaga */
  private readonly raised = signal<{ text: string; movements: unknown } | null>(null);
  readonly message = computed(() => {
    const r = this.raised();
    return r && r.movements === this.store.night()?.movements ? r.text : null;
  });

  suggestedOut(r: CashRow): number {
    return Math.min(r.balance, this.cashAmount());
  }

  async openTransfer(r: CashRow): Promise<void> {
    const modal = await this.modal.create({
      component: TransferModal,
      componentProps: {
        from: r.player,
        others: this.rows()
          .map((x) => x.player)
          .filter((p) => p !== r.player),
        suggested: r.balance < 0 ? -r.balance : 0,
      },
    });
    await modal.present();
    const res = await modal.onDidDismiss<TransferResult | null>();
    if (res.role !== 'save' || !res.data) return;
    const amount = parseAmount(res.data.amount);
    if (amount === null) return this.raise('invalid-amount');
    if (!this.store.transfer(r.player, res.data.to, amount)) {
      this.raise((this.store.lastError() as CashError | null) ?? 'invalid-amount');
    }
  }

  raise(e: CashError): void {
    this.raised.set({ text: CASH_MESSAGES[e] ?? 'Valor inválido', movements: this.store.night()?.movements });
  }

  async close(): Promise<void> {
    const night = this.store.night();
    if (!night || !this.canClose()) return;
    const preview = closeNight(night, this.store.game());
    if ('error' in preview) return;
    const lines = preview.pendings.map((p) => `${p.debtor} deve ${brl(p.amount)} a ${p.creditor}`);
    const alert = await this.alerts.create({
      header: 'Fechar a noite?',
      cssClass: 'pre-line-alert',
      message: lines.length ? lines.join('\n') : 'Ninguém fica devendo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Fechar', role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    if (!this.store.closeNight()) {
      this.raise((this.store.lastError() as CashError | null) ?? 'invalid-amount');
      return;
    }
    await this.modal.dismiss(null, 'closed');
    const toast = await this.toasts.create({ message: '🌙 Noite encerrada', duration: 2500 });
    await toast.present();
  }

  cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }
}
