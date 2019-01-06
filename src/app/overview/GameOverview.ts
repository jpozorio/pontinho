import {Component} from '@angular/core';
import {Game, Match} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'overview',
	templateUrl: 'GameOverview.html',
	styleUrls: ['GameOverview.scss'],
})
export class GameOverviewPage {

	max;
	min;

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
		this.max = this.game.getMaxPointsOfAllPlayers();
		this.min = this.game.getMinPointsOfAllPlayers();
	}

	goToCadHand() {
		this.navCtrl.navigateRoot(['game']);
	}

	get game(): Game {
		return this._gameService.game;
	}

	get currentMatch(): Match {
		return this._gameService.currentMatch;
	}

	get scrumblerName(): string {
		return this._gameService.scrumblerName;
	}

	viewHandHistory() {
		this.navCtrl.navigateForward(['hand-history']);
	}

}
