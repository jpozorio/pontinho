export const MAX_POINTS = 100;

export class Player {
	name: string;
	valuePaid: number;
	currentScore: number;
	reentries: number;
	currentHand?: Hand;
	allHands: Hand[];
	scrumbler: boolean;

	constructor() {
		this.scrumbler = false;
		this.name = '';
		this.currentScore = 0;
		this.valuePaid = 0;
		this.reentries = 0;
		this.allHands = [];
	}

	getBoomed(): boolean {
		return this.currentScore >= MAX_POINTS;
	}

	getDueValue(gameValue: number): number {
		return (this.valuePaid - ((this.reentries + 1) * gameValue));
	}

	getAbsDueValue(gameValue: number): number {
		return Math.abs(((this.reentries + 1) * gameValue) - this.valuePaid);
	}

	getPointsToEscape(): number {
		return (99 - this.currentScore)
	}

}

export class Match {
	handsOfMatch: Hand[];
	scoreCadFinished = false;
}

export class Hand {
	player: Player;
	score: number;
	enter: boolean;
	boom: boolean;
	valuePaid: number;

	constructor() {
		this.enter = false;
		this.valuePaid = 0;
	}
}

export class Game {
	playersAtGame: Player[];
	allPlayers: Player[];
	matches: Match[];
	private scrumbler: number;

	constructor() {
		this.playersAtGame = [];
		this.allPlayers = [];
		this.matches = [];
		this.scrumbler = 0;
	}

	someoneGetsBoomed(): boolean {
		for (let player of this.playersAtGame) {
			if (player.currentScore >= MAX_POINTS) {
				return true;
			}
		}
		return false;
	}

	addPlayer(player: Player) {
		this.playersAtGame.push(player);
		this.allPlayers.push(player);
	}

	nextScrumbler(): string {
		let finded = false;
		let scrumblerName = '';
		for (const p of this.playersAtGame) {
			if (finded) {
				p.scrumbler = true;
				scrumblerName = p.name;
				break;
			}
			if (p.scrumbler) {
				p.scrumbler = false;
				finded = true;
			}
		}

		if (!finded || !scrumblerName) {
			if (this.playersAtGame.length > 0) {
				this.playersAtGame[0].scrumbler = true;
				scrumblerName = this.playersAtGame[0].name;
			}
		}

		return scrumblerName;
	}

	getMaxPointsOfAllPlayers() {
		let max = -1;
		for (let player of this.playersAtGame) {
			if (player.currentScore > max && !player.getBoomed()) {
				max = player.currentScore;
			}
		}
		return max;
	}

	getMinPointsOfAllPlayers() {
		let min = 1000;
		for (let player of this.playersAtGame) {
			if (player.currentScore < min && !player.getBoomed()) {
				min = player.currentScore;
			}
		}
		return min;
	}

	get anyPlayerReenter(): boolean {
		for (let player of this.playersAtGame) {
			if (player.reentries > 0) {
				return true;
			}
		}
		return false;
	}

}
