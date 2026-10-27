import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
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
});
