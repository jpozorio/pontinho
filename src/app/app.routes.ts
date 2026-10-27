import { Routes } from '@angular/router';
import { startGuard } from './start.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [startGuard], children: [] },
  {
    path: 'novo',
    loadComponent: () => import('./pages/setup/setup.page').then((m) => m.SetupPage),
  },
  {
    path: 'jogo',
    loadComponent: () => import('./pages/game/game.page').then((m) => m.GamePage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'rodada' },
      { path: 'rodada', loadComponent: () => import('./pages/round/round.page').then((m) => m.RoundPage) },
      { path: 'historico', loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage) },
      { path: 'dinheiro', loadComponent: () => import('./pages/game/tab-placeholder').then((m) => m.DinheiroTab) },
    ],
  },
  {
    path: 'fim',
    loadComponent: () => import('./pages/game-over/game-over.page').then((m) => m.GameOverPage),
  },
  { path: '**', redirectTo: '' },
];
