import { TestBed } from '@angular/core/testing';
import { AlertController, provideIonicAngular } from '@ionic/angular';
import { GameStore } from '../state/game-store';
import { PayButton } from './pay-button';

function setup(suggested: number) {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideIonicAngular({ mode: 'md', useSetInputAPI: true })] });
  const store = TestBed.inject(GameStore);
  store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto'] });
  const fixture = TestBed.createComponent(PayButton);
  fixture.componentRef.setInput('player', 'Ana');
  fixture.componentRef.setInput('suggested', suggested);
  fixture.detectChanges();
  const create = vi.spyOn(TestBed.inject(AlertController), 'create');
  const answer = (role: string, amount?: string) =>
    create.mockResolvedValue({
      present: () => Promise.resolve(),
      onDidDismiss: () => Promise.resolve({ role, data: { values: { amount } } }),
    } as never);
  return { store, fixture, create, answer };
}

describe('PayButton', () => {
  it('registers "5,50" as 5.5', async () => {
    const { store, fixture, answer } = setup(10);
    answer('confirm', '5,50');
    await fixture.componentInstance.open();
    expect(store.game()!.payments.map((p) => [p.player, p.amount])).toEqual([['Ana', 5.5]]);
  });

  it('does nothing on cancel', async () => {
    const { store, fixture, answer } = setup(10);
    answer('cancel', '5');
    await fixture.componentInstance.open();
    expect(store.game()!.payments).toEqual([]);
  });

  it('does nothing on invalid input', async () => {
    const { store, fixture, answer } = setup(10);
    for (const v of ['abc', '', '0', '-2']) {
      answer('confirm', v);
      await fixture.componentInstance.open();
    }
    expect(store.game()!.payments).toEqual([]);
  });

  it('prefills the suggested value with a comma, or empty when nothing is owed', async () => {
    const a = setup(7.5);
    a.answer('cancel');
    await a.fixture.componentInstance.open();
    expect(a.create.mock.calls[0][0]!.inputs![0].value).toBe('7,5');
    const b = setup(0);
    b.answer('cancel');
    await b.fixture.componentInstance.open();
    expect(b.create.mock.calls[0][0]!.inputs![0].value).toBe('');
  });
});
