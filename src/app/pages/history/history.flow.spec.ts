import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController, ModalController, provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../../state/game-store';
import { EditRoundModal } from './edit-round.modal';
import { HistoryPage } from './history.page';

const NAMES = ['Ana Maria', 'Beto', 'Carla', 'Daniel', 'Eduarda', 'Fabio', 'Gabriela', 'Hugo'];

function setup(rounds: number) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true }), provideRouter([])],
  });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: NAMES });
  const plan: Record<string, number>[] = [{ Hugo: 90 }, { Hugo: 20 }];
  for (let r = 0; r < rounds; r++) {
    NAMES.forEach((n) => store.setDraftScore(n, plan[r][n] ?? 10));
    expect(store.closeRound()).toBe(true);
  }
  const fixture = TestBed.createComponent(HistoryPage);
  fixture.detectChanges();
  return { store, fixture, el: fixture.nativeElement as HTMLElement };
}

function fakeOverlay(role: string, data?: unknown) {
  return { present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve({ role, data }) };
}

describe('HistoryPage footer', () => {
  it('shows totals and faltam with level class', () => {
    const { el } = setup(1);
    const sum = Array.from(el.querySelectorAll('tfoot tr.sum td')).map((t) => t.textContent!.trim());
    expect(sum).toEqual(['10', '10', '10', '10', '10', '10', '10', '90']);
    const left = el.querySelectorAll('tfoot tr.left td');
    expect(left[0].textContent!.trim()).toBe('89');
    expect(left[0].classList.contains('ok')).toBe(true);
    expect(left[7].textContent!.trim()).toBe('9');
    expect(left[7].classList.contains('near')).toBe(true);
  });

  it('shows a dash for an out player', () => {
    const { store, fixture, el } = setup(2);
    store.decide('Hugo', 'out');
    NAMES.slice(0, 7).forEach((n) => store.setDraftScore(n, 1));
    expect(store.closeRound()).toBe(true);
    fixture.detectChanges();
    expect(el.querySelectorAll('tfoot tr.sum td')[7].textContent!.trim()).toBe('–');
    expect(el.querySelectorAll('tfoot tr.left td')[7].textContent!.trim()).toBe('–');
  });
});

describe('HistoryPage edit flow', () => {
  it('on changes-outcome confirms, undoes from the round and goes to the Rodada tab', async () => {
    const { store, fixture } = setup(2);
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(fakeOverlay('save', { Ana: 1 }) as never);
    const alertSpy = vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fakeOverlay('confirm') as never);
    vi.spyOn(store, 'editRound').mockReturnValue(false);
    vi.spyOn(store, 'lastError').mockReturnValue('changes-outcome');
    const undo = vi.spyOn(store, 'undoFrom');
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.componentInstance.edit(1);
    expect(alertSpy.mock.calls[0][0]?.header).toBe(
      'Essa correção muda quem estourou. Desfazer a partir da rodada 2 e lançar de novo?',
    );
    expect(undo).toHaveBeenCalledWith(1);
    expect(nav).toHaveBeenCalledWith('/jogo/rodada');
  });

  it('does not undo when the alert is cancelled', async () => {
    const { store, fixture } = setup(2);
    vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue(fakeOverlay('save', { Ana: 1 }) as never);
    vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fakeOverlay('cancel') as never);
    vi.spyOn(store, 'editRound').mockReturnValue(false);
    vi.spyOn(store, 'lastError').mockReturnValue('changes-outcome');
    const undo = vi.spyOn(store, 'undoFrom');
    await fixture.componentInstance.edit(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('undoLast confirms and drops the last round', async () => {
    const { store, fixture } = setup(2);
    vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(fakeOverlay('confirm') as never);
    await fixture.componentInstance.undoLast();
    expect(store.game()!.rounds.length).toBe(1);
  });
});

describe('EditRoundModal', () => {
  it('renders one input per player and dismisses with the edited scores', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true })] });
    const dismiss = vi.spyOn(TestBed.inject(ModalController), 'dismiss').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EditRoundModal);
    fixture.componentRef.setInput('index', 0);
    fixture.componentRef.setInput('names', ['Ana', 'Beto']);
    fixture.componentRef.setInput('initial', { Ana: 10, Beto: 'bust' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('ion-input').length).toBe(2);
    el.querySelector('ion-input[data-player="Ana"]')!.dispatchEvent(
      new CustomEvent('ionInput', { detail: { value: '25' } }),
    );
    fixture.detectChanges();
    (el.querySelector('[data-save]') as HTMLElement).click();
    expect(dismiss).toHaveBeenCalledWith({ Ana: 25, Beto: 'bust' }, 'save');
  });

  it('receives componentProps through ModalController.create without breaking the signal inputs', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true })] });
    const modal = await TestBed.inject(ModalController).create({
      component: EditRoundModal,
      componentProps: { index: 0, names: ['Ana', 'Beto'], initial: { Ana: 10, Beto: 20 } },
    });
    await modal.present();
    expect(modal.querySelectorAll('ion-input').length).toBe(2);
    await modal.dismiss();
  });
});
