import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController, ModalController, ToastController, provideIonicAngular } from '@ionic/angular';
import { AppData } from '../../domain/model';
import { GameStore } from '../../state/game-store';
import { SettleModal } from './settle.modal';
import { TransferModal } from './transfer.modal';

registerLocaleData(localePt);

function fake(role: string, data?: unknown) {
  return { present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve({ role, data }) };
}

function setup() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }, provideIonicAngular({ mode: 'md', useSetInputAPI: true })],
  });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] });
  const fixture = TestBed.createComponent(SettleModal);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

/** Ana vence a partida de 15; Beto e Carla ficam devendo 5 cada */
function finish(store: GameStore): void {
  store.setDraftScore('Ana', 5);
  store.setDraftScore('Beto', 'bust');
  store.setDraftScore('Carla', 'bust');
  store.closeRound();
}

const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ');
const closeBtn = (el: HTMLElement) => el.querySelector('[data-close]') as HTMLIonButtonElement;

describe('SettleModal', () => {
  it('blocks closing while a game is in progress', () => {
    const { el } = setup();
    expect(text(el.querySelector('[data-blocked]'))).toContain('Termine ou abandone a partida antes do acerto');
    expect(closeBtn(el).disabled).toBe(true);
  });

  it('lists who receives and blocks closing while there is cash and a creditor', () => {
    const { store, fixture, el } = setup();
    finish(store);
    expect(store.view()!.winner).toBe('Ana');
    store.payIn('Beto', 5);
    store.payIn('Carla', 5);
    fixture.detectChanges();
    expect(el.querySelector('[data-payer]')).toBeNull();
    expect(text(el.querySelector('[data-receiver="Ana"]'))).toContain('R$ 10,00');
    expect(text(el.querySelector('[data-cash]'))).toContain('10,00');
    expect(text(el.querySelector('[data-blocked]'))).toContain(
      'Ainda há R$ 10,00 no caixa — pague os credores antes de fechar',
    );
    expect(closeBtn(el).disabled).toBe(true);
  });

  it('shows payers, then closes with cash zero creating the pendings', async () => {
    const { store, fixture, el } = setup();
    finish(store);
    store.payIn('Beto', 5);
    fixture.detectChanges();
    expect(text(el.querySelector('[data-payer="Carla"]'))).toContain('R$ 5,00');
    expect(store.payOut('Ana', 5)).toBe(true);
    fixture.detectChanges();
    expect(closeBtn(el).disabled).toBe(false);

    const alertCreate = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('confirm') as never);
    const dismiss = vi.spyOn(TestBed.inject(ModalController), 'dismiss').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(ToastController), 'create').mockResolvedValue(fake('x') as never);
    await fixture.componentInstance.close();
    const opts = alertCreate.mock.calls[0][0]!;
    expect(opts.header).toBe('Fechar a noite?');
    expect(opts.message).toBe('Carla deve R$\u00a05,00 a Ana');
    expect(opts.cssClass).toBe('pre-line-alert');
    expect(store.night()).toBeNull();
    expect(store.pendings().map((p) => [p.debtor, p.creditor, p.amount])).toEqual([['Carla', 'Ana', 5]]);
    expect(dismiss).toHaveBeenCalled();
    expect(toast.mock.calls[0][0]!.message).toBe('Noite encerrada');
  });

  it('does not close when the confirmation is cancelled', async () => {
    const { store, fixture } = setup();
    finish(store);
    store.payIn('Beto', 5);
    store.payOut('Ana', 5);
    const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.close();
    expect(create).toHaveBeenCalledTimes(1);
    expect(store.night()).not.toBeNull();
  });

  it('puts each pending on its own line', async () => {
    const { store, fixture } = setup();
    finish(store);
    const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.close();
    expect(create.mock.calls[0][0]!.message).toBe('Beto deve R$\u00a05,00 a Ana\nCarla deve R$\u00a05,00 a Ana');
  });

  it('keeps player names as plain text in the confirmation', async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }, provideIonicAngular({ mode: 'md', useSetInputAPI: true })],
    });
    const store = TestBed.inject(GameStore);
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', '<b>Beto</b>'] });
    store.setDraftScore('Ana', 5);
    store.setDraftScore('<b>Beto</b>', 'bust');
    store.closeRound();
    const fixture = TestBed.createComponent(SettleModal);
    fixture.detectChanges();
    const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.close();
    expect(create.mock.calls[0][0]!.message).toBe('<b>Beto</b> deve R$\u00a05,00 a Ana');
  });

  it('registers a direct player payment through the transfer modal', async () => {
    const { store, fixture } = setup();
    finish(store);
    fixture.detectChanges();
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue(fake('save', { to: 'Ana', amount: 5 }) as never);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-payer="Carla"] [data-transfer]')).toHaveLength(1);
    await fixture.componentInstance.openTransfer(store.cash()!.rows.find((r) => r.player === 'Carla')!);
    expect(create.mock.calls[0][0].component).toBe(TransferModal);
    expect(create.mock.calls[0][0].componentProps).toMatchObject({
      from: 'Carla',
      others: ['Ana', 'Beto'],
      suggested: 5,
    });
    expect(store.night()!.movements[0]).toMatchObject({ kind: 'transfer', from: 'Carla', to: 'Ana', amount: 5 });
  });

  it('hides the migration note for a regular night', () => {
    const { el } = setup();
    expect(el.querySelector('[data-migrated]')).toBeNull();
  });

  it('shows the migration note for a migrated night', () => {
    const { store, fixture, el } = setup();
    (store as unknown as { _data: WritableSignal<AppData> })._data.update((d) => ({
      ...d,
      night: { ...d.night!, migrated: true },
    }));
    fixture.detectChanges();
    expect(text(el.querySelector('[data-migrated]'))).toContain('Esta noite veio da versão anterior do app');
  });

  it('says nobody owes when the night is already even', async () => {
    const { store, fixture } = setup();
    finish(store);
    store.payIn('Beto', 5);
    store.payIn('Carla', 5);
    store.payOut('Ana', 10);
    fixture.detectChanges();
    const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.close();
    expect(create.mock.calls[0][0]!.message).toBe('Ninguém fica devendo.');
  });

  it('warns about cash without a creditor (inconsistent data)', () => {
    const { store } = setup();
    finish(store);
    // os saldos sempre somam o caixa; só dados inconsistentes chegam aqui
    Object.defineProperty(store, 'cash', {
      value: () => ({ cash: 3, games: 0, rows: [{ player: 'Ana', balance: -3 }] }),
    });
    const fixture = TestBed.createComponent(SettleModal);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('[data-blocked]'))).toContain(
      'Ainda há R$ 3,00 no caixa sem credor — registre a devolução a quem pagou',
    );
    expect(closeBtn(el).disabled).toBe(true);
  });
});
