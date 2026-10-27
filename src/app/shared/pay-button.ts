import { Component, inject, input } from '@angular/core';
import { AlertController, IonButton } from '@ionic/angular';
import { GameStore } from '../state/game-store';
import { parseAmount } from './parse-amount';

/** Botão "+ pagou": pede o valor (aceita vírgula) e lança jogador → caixa na hora. */
@Component({
  selector: 'app-pay-button',
  imports: [IonButton],
  template: `<ion-button size="small" shape="round" fill="outline" data-pay (click)="open()">+ pagou</ion-button>`,
})
export class PayButton {
  private readonly store = inject(GameStore);
  private readonly alerts = inject(AlertController);

  readonly player = input.required<string>();
  readonly suggested = input<number>(0);

  async open(): Promise<void> {
    const s = this.suggested();
    const alert = await this.alerts.create({
      header: `${this.player()} pagou`,
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
        { text: 'Pagou', role: 'confirm' },
      ],
    });
    await alert.present();
    const res = await alert.onDidDismiss<{ values?: { amount?: string | number } }>();
    if (res.role !== 'confirm') return;
    const amount = parseAmount(res.data?.values?.amount);
    if (amount !== null) this.store.payIn(this.player(), amount);
  }
}
