import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../../state/game-store';
import { HistoryPage } from './history.page';

const NAMES = ['Ana Maria', 'Beto', 'Carla', 'Daniel', 'Eduarda', 'Fabio', 'Gabriela', 'Hugo'];

function setup(rounds = 2) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md' }), provideRouter([])] });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: NAMES });
  const plan: Record<string, number>[] = [{ Hugo: 90 }, { Hugo: 20 }];
  for (let r = 0; r < rounds; r++) {
    NAMES.forEach((n) => store.setDraftScore(n, plan[r][n] ?? 10));
    expect(store.closeRound()).toBe(true);
  }
  if (rounds === 2) store.decide('Hugo', 'reenter'); // Hugo estourou na rodada 2 e reentra
  const fixture = TestBed.createComponent(HistoryPage);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

describe('HistoryPage', () => {
  it('renders full names as column headers, one row per round and a faltam row', () => {
    const { el } = setup();
    const heads = Array.from(el.querySelectorAll('thead th')).map((t) => t.textContent!.trim());
    expect(heads.slice(1)).toEqual(NAMES);
    expect(el.querySelectorAll('tbody tr.round').length).toBe(2);
    expect(el.querySelectorAll('tfoot tr.left td').length).toBe(8);
    expect(el.querySelectorAll('tfoot tr.sum td').length).toBe(8);
  });

  it('marks bust and reentry in the round where they happened', () => {
    const { el } = setup();
    const hugo = el.querySelectorAll('tbody tr.round[data-round="2"] td')[7];
    expect(hugo.textContent).toContain('💥');
    expect(hugo.textContent).toContain('↻');
  });

  it('shows the empty state without rounds', () => {
    const { el } = setup(0);
    expect(el.textContent).toContain('Nenhuma rodada fechada ainda');
    expect(el.querySelector('[data-undo]')).toBeNull();
  });
});
