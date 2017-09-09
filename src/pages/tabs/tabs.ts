import { Component } from '@angular/core';

import { GamePage } from '../game/Game';
import { GameOverviewPage } from '../overview/GameOverview';
import { CadPlayers } from '../cadPlayers/CadPlayers';

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {

  tab1Root = CadPlayers;
  tab2Root = GamePage;
  tab3Root = GameOverviewPage;

  constructor() {

  }
}
