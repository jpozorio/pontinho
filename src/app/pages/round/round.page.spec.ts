import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../../state/game-store';
import { RoundPage } from './round.page';

function setup() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md' }), provideRouter([])] });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] });
  store.setDraftScore('Ana', 78);
  store.setDraftScore('Beto', 10);
  store.setDraftScore('Carla', 10);
  expect(store.closeRound()).toBe(true);
  const fixture = TestBed.createComponent(RoundPage);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

const fake = (role: string) => ({ present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve({ role }) });

function type(el: HTMLElement, name: string, value: string): void {
  const input = el.querySelector(`ion-input[data-player="${name}"]`)!;
  input.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
}

describe('RoundPage', () => {
  it('shows total with draft and faltam while typing, before closing the round', () => {
    const { fixture, el } = setup();
    type(el, 'Ana', '12');
    fixture.detectChanges();
    const row = el.querySelector('[data-row="Ana"]')!.textContent!;
    expect(row).toContain('90');
    expect(row).toContain('faltam');
    expect(el.querySelector('[data-row="Ana"] .left b')!.textContent!.trim()).toBe('9');
    expect(el.querySelector('[data-row="Ana"] .left')!.classList.contains('near')).toBe(true);
  });

  it('shows estourou when the preview reaches 100', () => {
    const { fixture, el } = setup();
    type(el, 'Ana', '25');
    fixture.detectChanges();
    expect(el.querySelector('[data-row="Ana"]')!.textContent).toContain('estourou');
  });

  it('marks invalid input without saving it', () => {
    const { store, fixture, el } = setup();
    type(el, 'Ana', '-3');
    fixture.detectChanges();
    expect(store.game()!.draft['Ana']).toBeUndefined();
    expect(el.querySelector('ion-input[data-player="Ana"]')!.classList.contains('ion-invalid')).toBe(true);
  });

  it('shows the lastError message when closing with missing scores', () => {
    const { fixture, el } = setup();
    (el.querySelector('[data-close]') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Lance os pontos de todos');
  });

  it('drops a stale draft when the input becomes invalid, and refuses to close', () => {
    const { store, fixture, el } = setup();
    type(el, 'Ana', '12');
    type(el, 'Ana', '12.5');
    fixture.detectChanges();
    expect(store.game()!.draft['Ana']).toBeUndefined();
    expect(el.querySelector('[data-row="Ana"] .left b')!.textContent!.trim()).toBe('21');
    type(el, 'Beto', '1');
    type(el, 'Carla', '1');
    (el.querySelector('[data-close]') as HTMLElement).click();
    fixture.detectChanges();
    expect(store.game()!.rounds.length).toBe(1);
    expect(el.textContent).toContain('Lance os pontos de todos');
  });

  it('previews a reentering player from the reentry total', () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md' }), provideRouter([])] });
    const store = TestBed.inject(GameStore);
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] });
    store.setDraftScore('Ana', 'bust');
    store.setDraftScore('Beto', 10);
    store.setDraftScore('Carla', 20);
    expect(store.closeRound()).toBe(true);
    expect(store.decide('Ana', 'reenter')).toBe(true);
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    type(el, 'Ana', '5');
    fixture.detectChanges();
    const row = el.querySelector('[data-row="Ana"]')!.textContent!;
    expect(row).toContain('20 → 25');
    expect(el.querySelector('[data-row="Ana"] .left b')!.textContent!.trim()).toBe('74');
  });

  it('abandons the game only after confirming, then goes to /novo', async () => {
    const { store, fixture, el } = setup();
    expect(el.querySelector('[data-abandon]')!.textContent).toContain('Nova partida');
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
    await fixture.componentInstance.abandon();
    expect(create.mock.calls[0][0]).toMatchObject({
      header: 'Abandonar a partida atual?',
      message: 'Os pontos e pagamentos desta partida serão descartados.',
    });
    expect(store.game()).not.toBeNull();
    expect(nav).not.toHaveBeenCalled();
    create.mockResolvedValue(fake('confirm') as never);
    await fixture.componentInstance.abandon();
    expect(store.game()).toBeNull();
    expect(store.data().finished.length).toBe(0);
    expect(nav).toHaveBeenCalledWith('/novo');
  });

  describe('decisão de quem estourou na rodada anterior', () => {
    function busted(decision?: 'reenter' | 'out') {
      localStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md' }), provideRouter([])] });
      const store = TestBed.inject(GameStore);
      store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] });
      store.setDraftScore('Ana', 'bust');
      store.setDraftScore('Beto', 10);
      store.setDraftScore('Carla', 20);
      expect(store.closeRound()).toBe(true);
      if (decision) expect(store.decide('Ana', decision)).toBe(true);
      const fixture = TestBed.createComponent(RoundPage);
      fixture.detectChanges();
      return { store, fixture, el: fixture.nativeElement as HTMLElement };
    }

    it('shows only a small tag, not the segment, once the player reentered', () => {
      const { el } = busted('reenter');
      const row = el.querySelector('[data-row="Ana"]')!;
      expect(row.querySelector('ion-segment')).toBeNull();
      expect(row.querySelector('[data-change-decision="Ana"]')!.textContent).toContain('↻ reentrou');
      expect(row.querySelector('ion-input[data-player="Ana"]')).not.toBeNull();
    });

    it('shows "saiu" as a tag once the player chose to leave', () => {
      const { el } = busted('out');
      const row = el.querySelector('[data-row="Ana"]')!;
      expect(row.querySelector('ion-segment')).toBeNull();
      expect(row.querySelector('[data-change-decision="Ana"]')!.textContent).toContain('saiu');
      expect(row.querySelector('ion-input[data-player="Ana"]')).toBeNull();
    });

    it('asks about the previous round on its own line when there is no decision yet', () => {
      const { store, fixture, el } = busted();
      const ask = el.querySelector('[data-row="Ana"] [data-pending="Ana"]')!;
      expect(ask.textContent).toContain('Estourou na rodada 1:');
      (ask.querySelector('[data-decide="reenter"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(store.view()!.players[0].decision).toBe('reenter');
    });

    it('changes a decision only after confirming, naming the round', async () => {
      const { store, fixture } = busted('reenter');
      const create = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fake('cancel') as never);
      await fixture.componentInstance.changeDecision(store.view()!.players[0]);
      expect(create.mock.calls[0][0]).toMatchObject({ header: 'Ana estourou na rodada 1. Mudar para: sai?' });
      expect(store.view()!.players[0].decision).toBe('reenter');
      create.mockResolvedValue(fake('confirm') as never);
      await fixture.componentInstance.changeDecision(store.view()!.players[0]);
      expect(store.view()!.players[0].decision).toBe('out');
      await fixture.componentInstance.changeDecision(store.view()!.players[0]);
      expect(create.mock.calls[2][0]).toMatchObject({ header: 'Ana estourou na rodada 1. Mudar para: reentra com 20?' });
      expect(store.view()!.players[0].decision).toBe('reenter');
    });
  });

  it('says the game is over when closing a finished game', async () => {
    const { store, fixture, el } = setup();
    vi.spyOn(store, 'closeRound').mockReturnValue(false);
    vi.spyOn(store, 'lastError').mockReturnValue('game-over');
    await fixture.componentInstance.close();
    fixture.detectChanges();
    expect(el.textContent).toContain('A partida já terminou');
  });
});
