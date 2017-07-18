export class Player {
  name: string;
  valuePaid: number;
}

export class Hand {
  player: Player;
  score: number;
}

export class Game {
  players: Player[];
  hands: Hand[];

  constructor() {
    this.players = [];
    this.hands = [];
  }

  addPlayer(player: Player) {
    this.players.push(player);
  }
}
