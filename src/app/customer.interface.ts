export const MAX_POINTS = 100;

export class Player {
  name: string;
  valuePaid: number;
  currentScore: number;
  reentries: number;
  id: number;
  currentHand: Hand;

  constructor() {
    this.currentScore = 0;
    this.reentries = 0;
  }

  getBoomed() {
    return this.currentScore >= MAX_POINTS;
  }

  getDueValue() {
    return (this.reentries + 1 - this.valuePaid);
  }

  getPointsToEscape() {
    return (99 - this.currentScore)
  }
}

export class Match {
  handsOfMatch: Hand[];

  getScoreOfPlayer(player: Player) {
    for (let hand of this.handsOfMatch) {
      if (hand.player.id == player.id) {
        return hand.score;
      }
    }
    return -1;
  }
}

export class Hand {
  player: Player;
  score: number;
  enter: boolean;
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

  constructor() {
    this.playersAtGame = [];
    this.allPlayers = [];
    this.matches = [];
  }

  addPlayer(player: Player) {
    this.playersAtGame.push(player);
    this.allPlayers.push(player);
  }
}
