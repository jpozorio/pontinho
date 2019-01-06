import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'cad-players',
    pathMatch: 'full'
  },
  {
    path: 'cad-players',
    loadChildren: './cadPlayers/cad-players.module#CadPlayersModule'
  },
  {
    path: 'entradas',
    loadChildren: './entradas/entradas.module#EntradasModule'
  },
  {
    path: 'game',
    loadChildren: './game/game.module#GameModule'
  },
  {
    path: 'hand-history',
    loadChildren: './handHistory/hand-history.module#HandHistoryModule'
  },
  {
    path: 'overview',
    loadChildren: './overview/overview.module#GameOverviewModule'
  },
  {
    path: 'settings',
    loadChildren: './settings/settings.module#SettingsModule'
  },
  {
    path: 'game-over',
    loadChildren: './game-over/game-over.module#GameOverModule'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
