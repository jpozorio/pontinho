import {Injectable} from "@angular/core";
import {Game, Match, Player} from "./customer.interface";

@Injectable()
export class GameService {
	game: Game;
	winner: Player;
	currentMatch: Match;
	scrumblerName: string;

	computeCurrentScoreEachPlayer(): void {
		let max = this.game.getMaxPointsOfAllPlayers();
		for (let idx = this.game.playersAtGame.length - 1; idx >= 0; idx--) {
			let player = this.game.playersAtGame[idx];
			if (player.getBoomed()) {
				if (player.currentHand.enter) {
					player.currentHand.boom = true;
					player.currentScore = max;
					player.reentries++;
					player.valuePaid += player.currentHand.valuePaid;
				} else {
					this.game.playersAtGame.splice(idx, 1);
				}
			}
		}
	}
}
