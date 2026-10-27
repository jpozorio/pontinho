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

@Component({
  selector: 'app-agreement-modal',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonInput, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Acordo</ion-title>
        <ion-buttons slot="end">
          <ion-button data-cancel (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Quanto cada um salva do pote:</p>
      @for (name of names(); track name) {
        <div class="row" [attr.data-row]="name">
          <b>{{ name }}</b>
          <ion-input
            type="text"
            inputmode="decimal"
            placeholder="R$"
            [attr.data-player]="name"
            [value]="text(name)"
            (ionInput)="onInput(name, $event)"
          ></ion-input>
        </div>
      }
      <div class="shortcuts">
        <ion-button size="small" fill="outline" data-shortcut="1" (click)="fill(1)">1× entrada</ion-button>
        <ion-button size="small" fill="outline" data-shortcut="2" (click)="fill(2)">2× entrada</ion-button>
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ion-button expand="block" data-save (click)="save()">Salvar acordo</ion-button>
    </ion-content>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .row b {
      flex: 1;
      min-width: 0;
    }
    ion-input {
      flex: 0 0 110px;
      min-height: 40px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 6px;
      text-align: center;
      --padding-start: 6px;
      --padding-end: 6px;
    }
    .shortcuts {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .error {
      color: var(--ion-color-danger);
    }
  `,
})
export class AgreementModal {
  private readonly modal = inject(ModalController);

  readonly names = input.required<string[]>();
  readonly entryValue = input.required<number>();
  readonly initial = input<Record<string, number>>({});

  private readonly edited = signal<Record<string, string>>({});
  readonly error = signal<string | null>(null);

  values(): Record<string, string> {
    const base: Record<string, string> = {};
    for (const n of this.names()) {
      const v = this.initial()[n];
      if (v !== undefined) base[n] = String(v).replace('.', ',');
    }
    return { ...base, ...this.edited() };
  }

  text(name: string): string {
    return this.values()[name] ?? '';
  }

  onInput(name: string, ev: Event): void {
    const raw = String((ev as CustomEvent<{ value?: string | null }>).detail?.value ?? '');
    this.edited.update((e) => ({ ...e, [name]: raw }));
    this.error.set(null);
  }

  fill(times: number): void {
    const text = String(Math.round(times * this.entryValue() * 100) / 100).replace('.', ',');
    this.edited.set(Object.fromEntries(this.names().map((n) => [n, text])));
    this.error.set(null);
  }

  save(): void {
    const v = this.values();
    const out: Record<string, number> = {};
    for (const n of this.names()) {
      const x = parseAmount(v[n], true);
      if (x === null) {
        this.error.set('Valor inválido');
        return;
      }
      out[n] = x;
    }
    void this.modal.dismiss(out, 'save');
  }

  cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }
}
