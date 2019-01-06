import {Component} from '@angular/core';
import {Game, Match, Player} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'game-over',
	templateUrl: 'GameOver.html',
	styleUrls: ['GameOver.scss']
})
export class GameOverPage {
	gameValue = 1;

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
		const storedValue = localStorage.getItem('game-value');
		if(storedValue) {
			this.gameValue = parseInt(storedValue);
		}
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

	get winner(): Player {
		return this._gameService.winner;
	}

	viewHandHistory() {
		this.navCtrl.navigateForward(['cad-players']);
	}

}
