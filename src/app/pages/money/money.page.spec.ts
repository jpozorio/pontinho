import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ModalController, provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../../state/game-store';
import { AgreementModal } from './agreement.modal';
import { MoneyPage } from './money.page';

registerLocaleData(localePt);

function setup(players: string[]) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCALE_ID, useValue: 'pt-BR' },
      provideIonicAngular({ mode: 'md', useSetInputAPI: true }),
      provideRouter([]),
    ],
  });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players });
  const fixture = TestBed.createComponent(MoneyPage);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

function fake(role: string, data?: unknown) {
  return { present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve({ role, data }) };
}

function down(store: GameStore): void {
  store.setDraftScore('Ana', 'bust');
  store.setDraftScore('Beto', 10);
  store.setDraftScore('Carla', 10);
  expect(store.closeRound()).toBe(true);
  store.decide('Ana', 'out');
}

describe('MoneyPage', () => {
  it('hides the agreement button with 3 playing and shows it with 2', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    expect(el.querySelector('[data-agreement-button]')).toBeNull();
    down(store);
    fixture.detectChanges();
    expect(el.querySelector('[data-agreement-button]')).not.toBeNull();
  });

  it('shows ok on the row after the player pays in full', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    expect(el.querySelector('[data-row="Beto"] [data-ok]')).toBeNull();
    store.addPayment('Beto', 5);
    fixture.detectChanges();
    expect(el.querySelector('[data-row="Beto"] [data-ok]')).not.toBeNull();
    expect(el.querySelector('[data-row="Ana"] [data-ok]')).toBeNull();
  });

  it('shows pot, missing and credit on overpayment', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    expect(el.querySelector('[data-pot]')!.textContent).toContain('15,00');
    store.addPayment('Beto', 8);
    fixture.detectChanges();
    expect(el.querySelector('[data-missing]')!.textContent).toContain('10,00');
    expect(el.querySelector('[data-row="Beto"] [data-credit]')!.textContent).toContain('3,00');
  });

  it('removes a payment only after confirmation', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    store.addPayment('Beto', 5);
    fixture.detectChanges();
    (el.querySelector('[data-row="Beto"] [data-toggle]') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-payment]').length).toBe(1);
    const spy = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    const id = store.game()!.payments[0].id;
    await fixture.componentInstance.removePayment(id);
    expect(store.game()!.payments.length).toBe(1);
    spy.mockResolvedValue(fake('confirm') as never);
    await fixture.componentInstance.removePayment(id);
    expect(store.game()!.payments.length).toBe(0);
  });

  it('saves an agreement and maps errors to Portuguese', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    down(store);
    fixture.detectChanges();
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue(fake('save', { Beto: 10, Carla: 10 }) as never);
    await fixture.componentInstance.openAgreement();
    expect(create.mock.calls[0][0].component).toBe(AgreementModal);
    expect(store.game()!.agreement).toBeUndefined();
    fixture.detectChanges();
    expect(el.querySelector('.error')!.textContent).toContain('O acordo passa do valor do pote');
    create.mockResolvedValue(fake('save', { Beto: 5, Carla: 5 }) as never);
    await fixture.componentInstance.openAgreement();
    fixture.detectChanges();
    expect(el.querySelector('[data-agreement]')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Beto salva R$ 5,00 · Carla salva R$ 5,00',
    );
    expect(el.querySelector('.error')).toBeNull();
  });
});

describe('MoneyPage debts', () => {
  function withDebt() {
    const { store } = setup(['Ana', 'Beto', 'Carla']);
    store.setDraftScore('Ana', 'bust');
    store.setDraftScore('Beto', 'bust');
    store.setDraftScore('Carla', 5);
    expect(store.closeRound()).toBe(true);
    store.archiveFinished();
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Carla', 'Ana', 'Beto'] });
    const fixture = TestBed.createComponent(MoneyPage);
    fixture.detectChanges();
    return { store, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows an old debt with creditor and date, not ok until debt and entry are paid', () => {
    const { store, fixture, el } = withDebt();
    const row = () => el.querySelector('[data-row="Ana"]')!;
    const d = new Date(store.data().finished[0].startedAt);
    const dd = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(row().querySelector('[data-debt]')!.textContent!.replace(/\s+/g, ' ')).toContain(
      `deve R$ 5,00 ao Carla (partida de ${dd})`,
    );
    expect(row().querySelector('[data-ok]')).toBeNull();
    expect(fixture.componentInstance.suggested(store.money()!.rows.find((r) => r.player === 'Ana')!)).toBe(10);
    store.addPayment('Ana', 5);
    fixture.detectChanges();
    expect(row().querySelector('[data-debt]')).toBeNull();
    expect(row().querySelector('[data-ok]')).toBeNull();
    store.addPayment('Ana', 5);
    fixture.detectChanges();
    expect(row().querySelector('[data-ok]')).not.toBeNull();
  });

  it('suggests only the entry when there is no old debt, and 0 when settled', () => {
    const { store, fixture } = setup(['Ana', 'Beto', 'Carla']);
    const ana = () => store.money()!.rows.find((r) => r.player === 'Ana')!;
    expect(fixture.componentInstance.suggested(ana())).toBe(5);
    store.addPayment('Ana', 5);
    expect(fixture.componentInstance.suggested(ana())).toBe(0);
  });

  it('clears a stale agreement error after a payment, and cancel saves nothing', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    down(store);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue(fake('cancel', null) as never);
    await fixture.componentInstance.openAgreement();
    expect(store.game()!.agreement).toBeUndefined();
    create.mockResolvedValue(fake('save', { Beto: 10, Carla: 10 }) as never);
    await fixture.componentInstance.openAgreement();
    fixture.detectChanges();
    expect(el.querySelector('.error')).not.toBeNull();
    store.addPayment('Beto', 1);
    fixture.detectChanges();
    expect(el.querySelector('.error')).toBeNull();
  });
});

describe('AgreementModal', () => {
  function modal() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true })] });
    const dismiss = vi.spyOn(TestBed.inject(ModalController), 'dismiss').mockResolvedValue(true);
    const f = TestBed.createComponent(AgreementModal);
    f.componentRef.setInput('names', ['Beto', 'Carla']);
    f.componentRef.setInput('entryValue', 5);
    f.detectChanges();
    return { f, dismiss };
  }

  it('shortcut fills both players and save dismisses with values', () => {
    const { f, dismiss } = modal();
    f.componentInstance.fill(2);
    f.componentInstance.save();
    expect(dismiss).toHaveBeenCalledWith({ Beto: 10, Carla: 10 }, 'save');
  });

  it('rejects invalid values', () => {
    const { f, dismiss } = modal();
    f.componentInstance.onInput('Beto', new CustomEvent('ionInput', { detail: { value: 'abc' } }));
    f.componentInstance.save();
    expect(f.componentInstance.error()).toBe('Valor inválido');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('cancel dismisses without values', () => {
    const { f, dismiss } = modal();
    f.componentInstance.cancel();
    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
