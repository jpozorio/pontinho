import { Component, computed, inject, input, signal } from '@angular/core';
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
import { Score } from '../../domain/model';

@Component({
  selector: 'app-edit-round-modal',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonInput, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Corrigir rodada {{ index() + 1 }}</ion-title>
        <ion-buttons slot="end">
          <ion-button data-cancel (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @for (name of names(); track name) {
        <div class="row" [attr.data-row]="name">
          <b>{{ name }}</b>
          <ion-input
            type="number"
            inputmode="numeric"
            min="0"
            placeholder="–"
            [attr.data-player]="name"
            [value]="inputValue(name)"
            [disabled]="values()[name] === 'bust'"
            [class.ion-invalid]="invalid().has(name)"
            [class.ion-touched]="invalid().has(name)"
            (ionInput)="onInput(name, $event)"
          ></ion-input>
          <ion-button
            size="small"
            shape="round"
            color="danger"
            [fill]="values()[name] === 'bust' ? 'solid' : 'outline'"
            [attr.data-bust]="name"
            (click)="toggleBust(name)"
          >
            estourou
          </ion-button>
        </div>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <ion-button expand="block" data-save (click)="save()">Salvar</ion-button>
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
      flex: 0 0 72px;
      min-height: 40px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 6px;
      text-align: center;
      --padding-start: 6px;
      --padding-end: 6px;
    }
    ion-input.ion-invalid {
      border-color: var(--ion-color-danger);
      background: var(--ion-color-danger-tint);
    }
    .error {
      color: var(--ion-color-danger);
    }
  `,
})
export class EditRoundModal {
  private readonly modal = inject(ModalController);

  readonly index = input.required<number>();
  readonly names = input.required<string[]>();
  readonly initial = input.required<Record<string, Score>>();

  private readonly edited = signal<Record<string, Score | null>>({});
  readonly invalid = signal<ReadonlySet<string>>(new Set());
  readonly error = signal<string | null>(null);

  readonly values = computed<Record<string, Score | null>>(() => ({ ...this.initial(), ...this.edited() }));

  inputValue(name: string): string {
    const v = this.values()[name];
    return typeof v === 'number' ? String(v) : '';
  }

  onInput(name: string, ev: Event): void {
    const raw = String((ev as CustomEvent<{ value?: string | null }>).detail?.value ?? '').trim();
    const ok = /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw));
    this.edited.update((e) => ({ ...e, [name]: ok ? Number(raw) : null }));
    this.invalid.update((s) => {
      const next = new Set(s);
      if (raw !== '' && !ok) next.add(name);
      else next.delete(name);
      return next;
    });
    this.error.set(null);
  }

  toggleBust(name: string): void {
    this.edited.update((e) => ({ ...e, [name]: this.values()[name] === 'bust' ? null : 'bust' }));
    this.invalid.update((s) => {
      const next = new Set(s);
      next.delete(name);
      return next;
    });
    this.error.set(null);
  }

  save(): void {
    const v = this.values();
    const out: Record<string, Score> = {};
    for (const n of this.names()) {
      const s = v[n];
      if (this.invalid().has(n) || s === null || s === undefined) {
        this.error.set('Lance os pontos de todos');
        return;
      }
      out[n] = s;
    }
    void this.modal.dismiss(out, 'save');
  }

  cancel(): void {
    void this.modal.dismiss(null, 'cancel');
  }
}
