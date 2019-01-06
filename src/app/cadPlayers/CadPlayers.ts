import {Component, OnInit} from "@angular/core";
import {Game, Player} from "../customer.interface";
import {GameService} from "../game.service";
import {NavController} from "@ionic/angular";

@Component({
	selector: 'cad-players',
	templateUrl: 'CadPlayers.html',
	styleUrls: ['CadPlayers.scss']
})
export class CadPlayers implements OnInit {

	players: Player[] = [];
	gameValue = 1;

	constructor(
			public navCtrl: NavController,
			private _gameService: GameService,
	) {
		let oldGame: Game = this._gameService.game;
		let winner: Player = this._gameService.winner;
		if (oldGame && winner) {
			const storedValue = localStorage.getItem('game-value');
			if (storedValue) {
				this.gameValue = parseInt(storedValue);
			}
			this._gameService.game = new Game();
			this._gameService.winner = null;
			this._gameService.currentMatch = null;
			this._gameService.scrumblerName = null;

			const idxWinner = oldGame.allPlayers.indexOf(winner);
			for (let idx = idxWinner; idx < oldGame.allPlayers.length; idx++) {
				this.reAddPlayerAtGame(oldGame, idx);
			}
			for (let idx = 0; idx < idxWinner; idx++) {
				this.reAddPlayerAtGame(oldGame, idx);
			}

		} else if ((!oldGame || (oldGame && oldGame.allPlayers.length === 0)) && !winner) {
			this._gameService.game = new Game();
			this._gameService.winner = null;
			this._gameService.currentMatch = null;
			this._gameService.scrumblerName = null;
			this.newPlayer();
			this.newPlayer();
			this.newPlayer();
			this.newPlayer();
		} else if (oldGame && oldGame.allPlayers.length > 0 && !winner) {
			for (let p of this.game.allPlayers) {
				this.addPlayer(p);
			}
		}
	}

	private reAddPlayerAtGame(oldGame: Game, idx: number) {
		const p = oldGame.allPlayers[idx];
		const nPlayer = this.initPlayer();
		nPlayer.name = p.name;
		nPlayer.valuePaid = p.getDueValue(this.gameValue);
		this.addPlayer(nPlayer);
	}

	ngOnInit() {

	}

	initPlayer(): Player {
		return new Player();
	}

	addPlayer(player: Player) {
		this.players.push(player);
	}

	newPlayer() {
		const addrCtrl = this.initPlayer();
		this.players.push(addrCtrl);
	}

	get game(): Game {
		return this._gameService.game
	}

	get winner(): Player {
		return this._gameService.winner
	}

	finishCadPlayers() {
		for (const p of this.players) {
			if (p.name) {
				this.game.addPlayer(p);
			}
		}
		if (this.game.playersAtGame.length > 0) {
			this.navCtrl.navigateRoot(['game']);
		}
	}

}
