import { Component, inject, input, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { parseAmount } from '../../shared/parse-amount';

export interface TransferResult {
  to: string;
  amount: number;
}

@Component({
  selector: 'app-transfer-modal',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonInput, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ from() }} pagou a…</ion-title>
        <ion-buttons slot="end">
          <ion-button data-cancel (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="players">
        @for (name of others(); track name) {
          <ion-button
            size="small"
            shape="round"
            [fill]="to() === name ? 'solid' : 'outline'"
            [attr.data-to]="name"
            (click)="pick(name)"
            >{{ name }}</ion-button
          >
        }
      </div>
      <ion-input
        type="text"
        inputmode="decimal"
        placeholder="Valor em R$"
        data-amount
        [value]="amount()"
        (ionInput)="onInput($event)"
      ></ion-input>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ion-button expand="block" data-save (click)="save()">Confirmar</ion-button>
    </ion-content>
  `,
  styles: `
    .players {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    ion-input {
      min-height: 40px;
      margin-bottom: 12px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 6px;
      --padding-start: 8px;
      --padding-end: 8px;
    }
    .error {
      color: var(--ion-color-danger);
    }
  `,
})
export class TransferModal {
  private readonly modal = inject(ModalController);

  readonly from = input.required<string>();
  /** jogadores que podem receber (sem quem paga) */
  readonly others = input.required<string[]>();
  readonly suggested = input<number>(0);

  readonly to = signal<string | null>(null);
  private readonly edited = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  amount(): string {
    const e = this.edited();
    if (e !== null) return e;
    const s = this.suggested();
    return s > 0 ? String(s).replace('.', ',') : '';
  }

  pick(name: string): void {
    this.to.set(name);
    this.error.set(null);
  }

  onInput(ev: Event): void {
    this.edited.set(String((ev as CustomEvent<{ value?: string | null }>).detail?.value ?? ''));
    this.error.set(null);
  }

  save(): void {
    const to = this.to();
    if (!to) {
      this.error.set('Escolha outro jogador');
      return;
    }
    const amount = parseAmount(this.amount());
    if (amount === null) {
      this.error.set('Valor inválido');
      return;
    }
    void this.modal.dismiss({ to, amount } satisfies TransferResult, 'save');
  }

  cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }
}
