import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ToastController, provideIonicAngular } from '@ionic/angular';
import { HistoryPage } from '../pages/history/history.page';
import { RoundPage } from '../pages/round/round.page';
import { GameStore } from '../state/game-store';
import { showStoreNotice } from './notice-toast';

const fake = (role = '') => ({ present: vi.fn(() => Promise.resolve()), onDidDismiss: () => Promise.resolve({ role }) });

function setup() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true }), provideRouter([])],
  });
  const store = TestBed.inject(GameStore);
  const toast = fake();
  const create = vi.spyOn(TestBed.inject(ToastController), 'create').mockResolvedValue(toast as never);
  return { store, toast, create };
}

/** Quatro jogadores; Carla e Davi saem e Ana e Beto fazem acordo. */
function withAgreement(store: GameStore): void {
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla', 'Davi'] });
  for (const [p, v] of [['Ana', 40], ['Beto', 30], ['Carla', 'bust'], ['Davi', 'bust']] as const) store.setDraftScore(p, v);
  expect(store.closeRound()).toBe(true);
  store.decide('Carla', 'out');
  store.decide('Davi', 'out');
  expect(store.setAgreement({ Ana: 10, Beto: 10 })).toBe(true);
}

describe('showStoreNotice', () => {
  it('does nothing without a notice', async () => {
    const { store, create } = setup();
    await showStoreNotice(store, TestBed.inject(ToastController));
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the dropped-agreement toast once', async () => {
    const { store, toast, create } = setup();
    withAgreement(store);
    store.decide('Carla', 'reenter');
    await showStoreNotice(store, TestBed.inject(ToastController));
    expect(create.mock.calls[0][0]?.message).toBe('O acordo foi desfeito porque voltou a ter mais de 2 jogadores');
    expect(toast.present).toHaveBeenCalled();
    await showStoreNotice(store, TestBed.inject(ToastController));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('Histórico undo that brings back a third player shows the toast', async () => {
    const { store, create } = setup();
    withAgreement(store);
    vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('confirm') as never);
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.componentInstance.undoLast();
    expect(store.game()!.agreement).toBeUndefined();
    expect(create.mock.calls[0][0]?.message).toContain('O acordo foi desfeito');
  });

  it('Rodada reentry decision that brings back a third player shows the toast', async () => {
    const { store, create } = setup();
    withAgreement(store);
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.componentInstance.decide('Carla', 'reenter');
    expect(store.game()!.agreement).toBeUndefined();
    expect(create.mock.calls[0][0]?.message).toContain('O acordo foi desfeito');
  });
});
