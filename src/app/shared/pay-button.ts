import { Component, computed, inject, input, output } from '@angular/core';
import { AlertController, IonButton } from '@ionic/angular';
import { CashError } from '../domain/cash';
import { GameStore } from '../state/game-store';
import { parseAmount } from './parse-amount';

/**
 * Botão do caixa: pede o valor (aceita vírgula) e lança na hora.
 * 'in': jogador → caixa ("pagou ao caixa"); 'out': caixa → jogador ("recebeu do caixa").
 */
@Component({
  selector: 'app-pay-button',
  imports: [IonButton],
  template: `<ion-button size="small" shape="round" fill="outline" [attr.data-pay]="kind()" (click)="open()">{{
    label()
  }}</ion-button>`,
})
export class PayButton {
  private readonly store = inject(GameStore);
  private readonly alerts = inject(AlertController);

  readonly player = input.required<string>();
  readonly suggested = input<number>(0);
  readonly kind = input<'in' | 'out'>('in');
  /** o caixa recusou o lançamento (ex.: o caixa não tem esse valor) */
  readonly failed = output<CashError>();

  readonly label = computed(() => (this.kind() === 'in' ? 'pagou ao caixa' : 'recebeu do caixa'));

  async open(): Promise<void> {
    const s = this.suggested();
    const alert = await this.alerts.create({
      header: `${this.player()} ${this.label()}`,
      inputs: [
        {
          name: 'amount',
          type: 'text',
          attributes: { inputmode: 'decimal' },
          placeholder: 'Valor em R$',
          value: s > 0 ? String(s).replace('.', ',') : '',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', role: 'confirm' },
      ],
    });
    await alert.present();
    const res = await alert.onDidDismiss<{ values?: { amount?: string | number } }>();
    if (res.role !== 'confirm') return;
    const amount = parseAmount(res.data?.values?.amount);
    if (amount === null) {
      this.failed.emit('invalid-amount');
      return;
    }
    const ok =
      this.kind() === 'in' ? this.store.payIn(this.player(), amount) : this.store.payOut(this.player(), amount);
    const e = this.store.lastError();
    if (!ok && e) this.failed.emit(e as CashError);
  }
}
