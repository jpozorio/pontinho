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

  getEstourado() {
    return this.currentScore >= MAX_POINTS;
  }
}

export class Match {
  handsOfMatch: Hand[];
}

export class Hand {
  player: Player;
  score: number;
  enter: boolean;

  constructor() {
    this.enter = false;
  }
}

export class Game {
  playersAtGame: Player[];
  matches: Match[];

  constructor() {
    this.playersAtGame = [];
    this.matches = [];
  }

  addPlayer(player: Player) {
    this.playersAtGame.push(player);
  }
}
