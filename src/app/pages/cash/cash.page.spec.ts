import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController, ModalController, provideIonicAngular } from '@ionic/angular';
import { AppData } from '../../domain/model';
import { GameStore } from '../../state/game-store';
import { AgreementModal } from './agreement.modal';
import { CashPage } from './cash.page';
import { SettleModal } from './settle.modal';
import { TransferModal } from './transfer.modal';

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
  const fixture = TestBed.createComponent(CashPage);
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

const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('CashPage', () => {
  it('hides the agreement button with 3 playing and shows it with 2', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    expect(el.querySelector('[data-agreement-button]')).toBeNull();
    down(store);
    fixture.detectChanges();
    expect(el.querySelector('[data-agreement-button]')).not.toBeNull();
  });

  it('shows the pot and each player\'s night balance', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    const balance = () => el.querySelector('[data-row="Beto"] [data-balance]')!.textContent!.replace(/\s+/g, ' ');
    expect(el.querySelector('[data-pot]')!.textContent).toContain('15,00');
    expect(balance()).toContain('deve R$ 5,00');
    store.payIn('Beto', 5);
    fixture.detectChanges();
    expect(balance()).toContain('acertado');
    store.payIn('Beto', 3);
    fixture.detectChanges();
    expect(balance()).toContain('tem a receber R$ 3,00');
    expect(el.querySelector('[data-row="Ana"] [data-balance]')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'deve R$ 5,00',
    );
  });

  it('opens the settle modal from the Acerto final button', async () => {
    const { fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(fake('cancel') as never);
    (el.querySelector('[data-settle-button]') as HTMLElement).click();
    await fixture.whenStable();
    expect(create.mock.calls[0][0].component).toBe(SettleModal);
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

  it('navigates to / after closing the night outside the game tab', async () => {
    const { fixture } = setup(['Ana', 'Beto']);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(fake('closed') as never);
    await fixture.componentInstance.openSettle();
    expect(nav).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('does not navigate when the settle modal is only dismissed', async () => {
    const { fixture } = setup(['Ana', 'Beto']);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.openSettle();
    expect(nav).not.toHaveBeenCalled();
  });

  it('counts a finished game that is not archived yet', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto']);
    store.setDraftScore('Ana', 'bust');
    store.setDraftScore('Beto', 5);
    store.closeRound();
    fixture.detectChanges();
    expect(text(el.querySelector('[data-games]'))).toBe('1 partida encerrada na noite');
  });

  it('hides the migration note for a regular night', () => {
    const { el } = setup(['Ana', 'Beto']);
    expect(el.querySelector('[data-migrated]')).toBeNull();
  });

  it('shows the migration note on top for a migrated night', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto']);
    (store as unknown as { _data: WritableSignal<AppData> })._data.update((d) => ({
      ...d,
      night: { ...d.night!, migrated: true },
    }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(el.querySelector('[data-migrated]'))).toContain('veio da versão anterior');
  });
});

describe('CashPage night', () => {
  it('suggests what the player owes in the night, across games, and 0 when settled', () => {
    const { store } = setup(['Ana', 'Beto', 'Carla']);
    store.setDraftScore('Ana', 'bust');
    store.setDraftScore('Beto', 'bust');
    store.setDraftScore('Carla', 5);
    expect(store.closeRound()).toBe(true);
    store.archiveFinished();
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Carla', 'Ana', 'Beto'] });
    const fixture = TestBed.createComponent(CashPage);
    fixture.detectChanges();
    const row = (p: string) => store.cash()!.rows.find((r) => r.player === p)!;
    expect(fixture.componentInstance.suggested(row('Ana'))).toBe(10);
    expect(fixture.componentInstance.suggested(row('Carla'))).toBe(0);
    store.payIn('Ana', 10);
    expect(fixture.componentInstance.suggested(row('Ana'))).toBe(0);
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
    store.payIn('Beto', 1);
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

describe('CashPage cash box', () => {

  function alertAnswer(role: string, amount?: string) {
    const create = vi.spyOn(TestBed.inject(AlertController), 'create');
    create.mockResolvedValue({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role, data: { values: { amount } } }),
    } as never);
    return create;
  }

  function putPending(store: GameStore): void {
    (store as unknown as { _data: { update: (f: (d: AppData) => AppData) => void } })._data.update((d) => ({
      ...d,
      pendings: [{ id: 'p1', debtor: 'Beto', creditor: 'Ana', amount: 20, date: '2026-10-20T20:00:00' }],
    }));
  }

  it('shows cash, games and each player balance (deve / tem a receber / acertado)', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    expect(text(el.querySelector('[data-cash]'))).toContain('R$ 0,00');
    expect(el.querySelector('[data-games]')).toBeNull();
    expect(text(el.querySelector('[data-row="Beto"] [data-balance]'))).toBe('deve R$ 5,00');
    store.payIn('Beto', 5);
    store.payIn('Carla', 8);
    fixture.detectChanges();
    expect(text(el.querySelector('[data-row="Beto"] [data-balance]'))).toBe('acertado');
    expect(text(el.querySelector('[data-row="Carla"] [data-balance]'))).toBe('tem a receber R$ 3,00');
    expect(text(el.querySelector('[data-cash]'))).toContain('R$ 13,00');
  });

  it('counts only finished games, singular and plural', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto']);
    const finish = () => {
      store.setDraftScore('Ana', 'bust');
      store.setDraftScore('Beto', 5);
      store.closeRound();
      store.archiveFinished();
    };
    finish();
    fixture.detectChanges();
    expect(text(el.querySelector('[data-games]'))).toBe('1 partida encerrada na noite');
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto'] });
    finish();
    fixture.detectChanges();
    expect(text(el.querySelector('[data-games]'))).toBe('2 partidas encerradas na noite');
  });

  it('"pagou ao caixa" suggests what is owed and calls payIn', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    const create = alertAnswer('confirm', '5,5');
    (el.querySelector('[data-row="Ana"] [data-pay="in"]') as HTMLElement).click();
    await vi.waitFor(() => expect(store.night()!.movements).toHaveLength(1));
    expect(create.mock.calls[0][0]!.inputs![0].value).toBe('5');
    expect(store.night()!.movements[0]).toMatchObject({ kind: 'in', player: 'Ana', amount: 5.5 });
    fixture.detectChanges();
    expect(text(el.querySelector('[data-movement] [data-text]'))).toMatch(/^Ana pagou ao caixa R\$ 5,50 · \d\d:\d\d$/);
  });

  it('"recebeu do caixa" suggests min(credit, cash) and calls payOut; refusal shows the error', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    store.payIn('Carla', 8);
    fixture.detectChanges();
    const create = alertAnswer('confirm', '3');
    (el.querySelector('[data-row="Carla"] [data-pay="out"]') as HTMLElement).click();
    await vi.waitFor(() => expect(store.night()!.movements).toHaveLength(2));
    expect(create.mock.calls[0][0]!.inputs![0].value).toBe('3');
    expect(store.night()!.movements[1]).toMatchObject({ kind: 'out', player: 'Carla', amount: 3 });
    fixture.detectChanges();
    expect(text(el.querySelectorAll('[data-movement] [data-text]')[0])).toMatch(/^Caixa pagou a Carla R\$ 3,00 · /);
    alertAnswer('confirm', '100');
    (el.querySelector('[data-row="Carla"] [data-pay="out"]') as HTMLElement).click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text(el.querySelector('.error'))).toBe('O caixa não tem esse valor');
    });
  });

  it('transfer modal calls transfer and the line names both players', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue(fake('save', { to: 'Ana', amount: 5 }) as never);
    await fixture.componentInstance.openTransfer(store.cash()!.rows[2]);
    expect(create.mock.calls[0][0].component).toBe(TransferModal);
    expect(create.mock.calls[0][0].componentProps).toMatchObject({ from: 'Carla', others: ['Ana', 'Beto'] });
    expect(store.night()!.movements[0]).toMatchObject({ kind: 'transfer', from: 'Carla', to: 'Ana', amount: 5 });
    fixture.detectChanges();
    expect(text(el.querySelector('[data-movement] [data-text]'))).toMatch(/^Carla pagou a Ana R\$ 5,00 · /);
  });

  it('removing a movement that would leave the cash negative shows the error', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    store.payIn('Ana', 5);
    store.payOut('Ana', 5);
    const first = store.night()!.movements[0].id;
    alertAnswer('confirm');
    await fixture.componentInstance.removeMovement(first);
    fixture.detectChanges();
    expect(store.night()!.movements).toHaveLength(2);
    expect(text(el.querySelector('.error'))).toBe('O caixa não tem esse valor');
  });

  it('removes a movement only after confirmation, newest first', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto', 'Carla']);
    store.payIn('Ana', 5);
    store.payIn('Beto', 2);
    fixture.detectChanges();
    expect(text(el.querySelectorAll('[data-movement] [data-text]')[0])).toContain('Beto pagou ao caixa');
    alertAnswer('cancel');
    await fixture.componentInstance.removeMovement(store.night()!.movements[1].id);
    expect(store.night()!.movements).toHaveLength(2);
    alertAnswer('confirm');
    await fixture.componentInstance.removeMovement(store.night()!.movements[1].id);
    expect(store.night()!.movements.map((m) => m.kind === 'in' && m.player)).toEqual(['Ana']);
  });

  it('pending "pago" removes it after confirmation', async () => {
    const { store, fixture, el } = setup(['Ana', 'Beto']);
    putPending(store);
    fixture.detectChanges();
    expect(text(el.querySelector('[data-pending] [data-text]'))).toBe('Beto deve R$ 20,00 a Ana (noite de 20/10)');
    alertAnswer('cancel');
    await fixture.componentInstance.settle('p1');
    expect(store.pendings()).toHaveLength(1);
    alertAnswer('confirm');
    await fixture.componentInstance.settle('p1');
    fixture.detectChanges();
    expect(store.pendings()).toEqual([]);
    expect(el.querySelector('[data-pending]')).toBeNull();
  });

  it('renders without a night: message and only pendings, with a back button outside the tab', () => {
    const { store, fixture, el } = setup(['Ana', 'Beto']);
    store.abandonGame();
    (store as unknown as { _data: { update: (f: (d: AppData) => AppData) => void } })._data.update((d) => ({
      ...d,
      night: null,
    }));
    putPending(store);
    fixture.detectChanges();
    expect(text(el.querySelector('[data-no-night]'))).toBe('Nenhuma noite em andamento');
    expect(el.querySelector('[data-row]')).toBeNull();
    expect(el.querySelector('[data-pending]')).not.toBeNull();
    expect(el.querySelector('ion-back-button')).not.toBeNull();
  });

  it('rounds agreement saves to cents before saving', async () => {
    const { store, fixture } = setup(['Ana', 'Beto', 'Carla']);
    down(store);
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(
      fake('save', { Beto: 5.004, Carla: 4.996 }) as never,
    );
    await fixture.componentInstance.openAgreement();
    expect(store.game()!.agreement!.saves).toEqual({ Beto: 5, Carla: 5 });
  });
});

describe('TransferModal', () => {
  function modal() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true })] });
    const dismiss = vi.spyOn(TestBed.inject(ModalController), 'dismiss').mockResolvedValue(true);
    const f = TestBed.createComponent(TransferModal);
    f.componentRef.setInput('from', 'Carla');
    f.componentRef.setInput('others', ['Ana', 'Beto']);
    f.componentRef.setInput('suggested', 2.5);
    f.detectChanges();
    return { f, dismiss };
  }

  it('requires another player, then dismisses with player and amount', () => {
    const { f, dismiss } = modal();
    f.componentInstance.save();
    expect(f.componentInstance.error()).toBe('Escolha outro jogador');
    f.componentInstance.pick('Ana');
    f.componentInstance.save();
    expect(dismiss).toHaveBeenCalledWith({ to: 'Ana', amount: 2.5 }, 'save');
  });

  it('rejects an invalid amount', () => {
    const { f, dismiss } = modal();
    f.componentInstance.pick('Ana');
    f.componentInstance.onInput(new CustomEvent('ionInput', { detail: { value: 'abc' } }));
    f.componentInstance.save();
    expect(f.componentInstance.error()).toBe('Valor inválido');
    expect(dismiss).not.toHaveBeenCalled();
  });
});
