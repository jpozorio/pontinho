import {Component, OnDestroy} from "@angular/core";
import {Game, Hand, Match, MAX_POINTS, Player} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'game',
	templateUrl: 'Game.html'
})
export class GamePage implements OnDestroy {

	mensagem;
	private gameValue = 1;

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
		const storedValue = localStorage.getItem('game-value');
		if (storedValue) {
			this.gameValue = parseInt(storedValue);
		}

		if (this._gameService.game && (!this.currentMatch || (this.currentMatch && this.currentMatch.scoreCadFinished))) {
			this._gameService.currentMatch = new Match();
			this._gameService.currentMatch.handsOfMatch = [];
			this._gameService.game.matches.push(this._gameService.currentMatch);
			if (!this._gameService.scrumblerName) {
				this._gameService.scrumblerName = this._gameService.game.nextScrumbler();
			}
			for (let player of this._gameService.game.allPlayers) {
				let hand = new Hand();
				hand.player = player;
				this._gameService.currentMatch.handsOfMatch.push(hand);
				player.allHands.push(hand);
				player.currentHand = hand;
			}
		}
	}

	get game(): Game {
		return this._gameService.game;
	}

	get winner(): Player {
		return this._gameService.winner;
	}

	get currentMatch(): Match {
		return this._gameService.currentMatch;
	}

	get scrumblerName(): string {
		return this._gameService.scrumblerName;
	}

	fillScoreOfAllPlayers(): boolean {
		let fill = true;
		for (let p of this._gameService.game.playersAtGame) {
			if ((p.currentHand.score === undefined || p.currentHand.score === null) && !p.currentHand.boom) {
				fill = false;
			}
		}
		return fill
	}

	finishScoreCad() {
		if (this.fillScoreOfAllPlayers()) {
			this.currentMatch.scoreCadFinished = true;
			this.computePlayersCurrentScore();
			this._gameService.winner = this.getWinner();
			this._gameService.scrumblerName = this._gameService.game.nextScrumbler();
			if (this._gameService.winner) {
				this.navCtrl.navigateRoot(['game-over']);
			} else {
				let somePlayerBoom = this.game.someoneGetsBoomed();
				if (somePlayerBoom) {
					this.navCtrl.navigateRoot(['entradas']);
				} else {
					this._gameService.computeCurrentScoreEachPlayer();
					this.navCtrl.navigateRoot(['overview']);
				}
			}
		} else {
			this.mensagem = 'Lance os pontos de todos os jogadores';
		}
	}

	private computePlayersCurrentScore() {
		for (let p of this._gameService.game.playersAtGame) {
			if (p.currentHand.boom) {
				p.currentHand.score = MAX_POINTS;
			}
			p.currentScore += p.currentHand.score;
		}
	}

	private getWinner() {
		let qtdeLeftPlayers = 0;
		let winner: Player;
		for (let player of this._gameService.game.playersAtGame) {
			if (player.currentScore < MAX_POINTS) {
				qtdeLeftPlayers++;
				winner = player;
			}
		}
		return qtdeLeftPlayers == 1 ? winner : null;
	}

	newGame() {
		this.navCtrl.navigateRoot(['cad-players']);
	}

	ngOnDestroy(): void {

	}

}
