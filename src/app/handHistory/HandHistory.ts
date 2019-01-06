import {Component, OnDestroy} from "@angular/core";
import {Game, Hand, Match, MAX_POINTS} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'hand-history',
	templateUrl: 'HandHistory.html',
	styleUrls: ['HandHistory.scss']
})
export class HandHistoryPage implements OnDestroy {

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
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

	lancarPontos() {
		this.navCtrl.navigateRoot(['overview']);
	}

	setCurrentScore(hand: Hand, score: number, event: any) {
		if (event.detail.value) {
			const newScore = parseInt(event.detail.value);
			hand.score = newScore;
			hand.player.currentScore -= score;
			hand.player.currentScore += newScore;
			hand.boom = hand.player.currentScore >= MAX_POINTS;
		}
	}

	ngOnDestroy(): void {
		let somePlayerBoom = this.game.someoneGetsBoomed();
		if (somePlayerBoom) {
			this.navCtrl.navigateRoot(['entradas']);
		}
	}
}
