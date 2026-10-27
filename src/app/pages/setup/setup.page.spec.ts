import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { GameConfig } from '../../domain/model';
import { GameStore } from '../../state/game-store';
import { SetupPage } from './setup.page';

registerLocaleData(localePt);

function configure() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCALE_ID, useValue: 'pt-BR' },
      provideIonicAngular({ mode: 'md', useSetInputAPI: true }),
      provideRouter([]),
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return TestBed.inject(GameStore);
}

/** Joga uma partida em que só `winner` fica abaixo de 100 e a arquiva. */
function playAndArchive(store: GameStore, config: GameConfig, winner: string): void {
  store.startGame(config);
  for (const p of config.players) store.setDraftScore(p, p === winner ? 5 : 'bust');
  expect(store.closeRound()).toBe(true);
  expect(store.archiveFinished()).toBe(true);
}

const names = (page: SetupPage) => page.rows().map((r) => r.name);

describe('SetupPage', () => {
  it('starts with empty rows and the default rule without a previous game', () => {
    configure();
    const page = TestBed.createComponent(SetupPage).componentInstance;
    expect(names(page)).toEqual(['', '', '', '']);
    expect(page.entryText()).toBe('1');
  });

  it('refills the form on every entry with the latest finished game, winner first', () => {
    const store = configure();
    playAndArchive(store, { entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto', 'Carla'] }, 'Beto');
    const fixture = TestBed.createComponent(SetupPage);
    const page = fixture.componentInstance;
    page.ionViewWillEnter();
    fixture.detectChanges();
    expect(names(page)).toEqual(['Beto', 'Carla', 'Ana']);

    // segunda partida, com a página ainda viva na pilha do Ionic
    page.start();
    expect(store.game()).not.toBeNull();
    for (const p of ['Beto', 'Carla', 'Ana']) store.setDraftScore(p, p === 'Ana' ? 5 : 'bust');
    expect(store.closeRound()).toBe(true);
    expect(store.archiveFinished()).toBe(true);

    page.ionViewWillEnter();
    fixture.detectChanges();
    expect(names(page)).toEqual(['Ana', 'Beto', 'Carla']);
    expect(page.entryText()).toBe('5');
    expect(page.error()).toBeNull();
  });

  it('keeps entry value and reentry rule of the last finished game', () => {
    const store = configure();
    playAndArchive(store, { entryValue: 2.5, reentryLimit: 'one', players: ['Ana', 'Beto'] }, 'Ana');
    const page = TestBed.createComponent(SetupPage).componentInstance;
    page.ionViewWillEnter();
    expect(page.entryText()).toBe('2,5');
    expect(page.entryValue()).toBe(2.5);
    expect(page.reentryLimit()).toBe('one');
  });

  it('shows empty rows while a game is in progress and refills after abandoning', () => {
    const store = configure();
    playAndArchive(store, { entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto'] }, 'Beto');
    store.startGame({ entryValue: 5, reentryLimit: 'unlimited', players: ['Ana', 'Beto'] });
    const fixture = TestBed.createComponent(SetupPage);
    const page = fixture.componentInstance;
    page.ionViewWillEnter();
    fixture.detectChanges();
    expect(page.blockingGame()).not.toBeNull();
    expect(names(page)).toEqual(['', '', '', '']);
    page.onAlertDismiss(new CustomEvent('x', { detail: { role: 'confirm' } }));
    expect(store.game()).toBeNull();
    expect(names(page)).toEqual(['Beto', 'Ana']);
  });

  it('says points and payments are discarded when abandoning', () => {
    configure();
    const fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('ion-alert')!;
    expect(alert.getAttribute('header')).toBe('Abandonar a partida atual?');
    expect(alert.getAttribute('message')).toBe('Os pontos e pagamentos desta partida serão descartados.');
  });

  it('accepts only plain decimal entry values, rounded to cents', () => {
    configure();
    const page = TestBed.createComponent(SetupPage).componentInstance;
    for (const bad of ['1e1', '0x10', '-2', '0', 'abc', '']) {
      page.entryText.set(bad);
      expect(page.entryValue()).toBeNull();
    }
    page.entryText.set('2,125');
    expect(page.entryValue()).toBe(2.13);
    page.entryText.set('3.5');
    expect(page.entryValue()).toBe(3.5);
  });
});
