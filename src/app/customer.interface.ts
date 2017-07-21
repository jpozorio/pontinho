export class Player {
  name: string;
  valuePaid: number;
}

export class Match {
  handsOfMatch: Hand[];
}

export class Hand {
  player: Player;
  score: number;
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
