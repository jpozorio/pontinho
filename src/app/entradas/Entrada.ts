import {Component} from "@angular/core";
import {Game, Match, Player} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'entradas',
	templateUrl: 'Entrada.html'
})
export class EntradaPage {

	max;
	min;

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
		this.max = this.game.getMaxPointsOfAllPlayers();
		this.min = this.game.getMinPointsOfAllPlayers();
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

	finishReentriesCad() {
		this._gameService.computeCurrentScoreEachPlayer();
		this.navCtrl.navigateForward(['overview']);
	}
}
