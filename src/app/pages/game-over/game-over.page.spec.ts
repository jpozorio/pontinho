import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../../state/game-store';
import { GameOverPage } from './game-over.page';

registerLocaleData(localePt);

function setup(opts: { agreement?: boolean; finish?: boolean } = {}) {
  const { agreement = true, finish = true } = opts;
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
  store.startGame({ entryValue: 10, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla', 'Davi'] });
  // Beto e Carla saem; Ana e Davi ficam
  store.setDraftScore('Ana', 5);
  store.setDraftScore('Beto', 'bust');
  store.setDraftScore('Carla', 'bust');
  store.setDraftScore('Davi', 5);
  store.closeRound();
  store.decide('Beto', 'out');
  store.decide('Carla', 'out');
  if (agreement) store.setAgreement({ Ana: 10, Davi: 10 });
  if (finish) {
    store.setDraftScore('Ana', 'bust');
    store.setDraftScore('Davi', 5);
    store.closeRound();
    store.decide('Ana', 'out');
  }
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(GameOverPage);
  fixture.detectChanges();
  return { store, fixture, nav, el: fixture.nativeElement as HTMLElement };
}

const fake = (role: string) => ({ present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve({ role }) });

describe('GameOverPage', () => {
  it('shows winner, rounds and the split table (pot 40, saves 10/10)', () => {
    const { store, el } = setup();
    expect(store.view()!.winner).toBe('Davi');
    expect(el.querySelector('[data-winner]')!.textContent).toContain('Davi venceu');
    expect(el.querySelector('[data-rounds]')!.textContent).toContain('2 rodadas');
    const split = el.querySelector('[data-split]')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(split).toBe('Pote R$ 40,00 · Ana salvou R$ 10,00 · Davi salvou R$ 10,00 · resto R$ 20,00 para Davi');
    expect(el.querySelector('[data-row="Davi"] [data-receives]')!.textContent).toContain('30,00');
    expect(el.querySelector('[data-row="Ana"] [data-receives]')!.textContent).toContain('10,00');
    expect(el.querySelector('tbody tr')!.getAttribute('data-row')).toBe('Davi');
  });

  it('says everything goes to the winner without agreement', () => {
    const { el } = setup({ agreement: false });
    expect(el.querySelector('[data-split]')!.textContent).toContain('tudo para Davi');
  });

  it('new game archives, clears current and navigates to /novo', async () => {
    const { store, fixture, nav } = setup();
    await fixture.componentInstance.newGame();
    expect(store.game()).toBeNull();
    expect(store.night()!.games.length).toBe(1);
    expect(nav).toHaveBeenCalledWith('/novo');
  });

  it('undo last round reopens the game only after confirmation', async () => {
    const { store, fixture, nav } = setup();
    const spy = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.undoLast();
    expect(store.view()!.winner).toBe('Davi');
    expect(nav).not.toHaveBeenCalled();
    spy.mockResolvedValue(fake('confirm') as never);
    await fixture.componentInstance.undoLast();
    expect(store.view()!.winner).toBeNull();
    expect(nav).toHaveBeenCalledWith('/jogo/rodada');
  });

  it('redirects to / when the game has no winner', () => {
    const { nav } = setup({ finish: false });
    expect(nav).toHaveBeenCalledWith('/');
  });
});
