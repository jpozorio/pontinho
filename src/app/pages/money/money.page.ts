import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { CashRow } from '../../domain/cash';
import { AgreementError } from '../../domain/money';
import { PayButton } from '../../shared/pay-button';
import { GameStore } from '../../state/game-store';
import { AgreementModal } from './agreement.modal';

const AGREEMENT_MESSAGES: Record<AgreementError, string> = {
  'not-two-players': 'O acordo só vale com 2 jogadores',
  'invalid-amount': 'Valor inválido',
  'exceeds-pot': 'O acordo passa do valor do pote',
};

@Component({
  selector: 'app-money',
  imports: [CurrencyPipe, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, PayButton],
  templateUrl: './money.page.html',
  styleUrl: './money.page.scss',
})
export class MoneyPage {
  private readonly store = inject(GameStore);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);

  readonly money = this.store.money;
  readonly game = this.store.game;
  /** saldo da noite de cada jogador */
  readonly rows = computed(() => this.store.cash()?.rows ?? []);
  /** erro de acordo, preso aos movimentos do momento: qualquer pagamento novo/removido o apaga */
  private readonly raised = signal<{ text: string; movements: unknown } | null>(null);
  readonly message = computed(() => {
    const r = this.raised();
    return r && r.movements === this.store.night()?.movements ? r.text : null;
  });

  readonly canAgree = computed(() => {
    const v = this.store.view();
    return !!v && v.winner === null && v.playingCount === 2;
  });

  readonly agreement = computed(() => {
    const saves = this.game()?.agreement?.saves;
    return saves ? Object.entries(saves).map(([name, amount]) => ({ name, amount })) : null;
  });

  /** Valor sugerido no "+ pagou": o que o jogador deve na noite. */
  suggested(r: CashRow): number {
    return r.balance < 0 ? -r.balance : 0;
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
    if (this.store.setAgreement(res.data)) return;
    const e = this.store.lastError() as AgreementError | null;
    this.raised.set({
      text: (e && AGREEMENT_MESSAGES[e]) ?? 'Valor inválido',
      movements: this.store.night()?.movements,
    });
  }

  async removeAgreement(): Promise<void> {
    if (await this.confirm('Remover o acordo?', 'Remover')) {
      this.raised.set(null);
      this.store.clearAgreement();
    }
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
