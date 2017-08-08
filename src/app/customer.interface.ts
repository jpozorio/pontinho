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

  getAbsDueValue() {
    return Math.abs(this.reentries + 1 - this.valuePaid);
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
    return '-';
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
  private scrumbler: number;

  constructor() {
    this.playersAtGame = [];
    this.allPlayers = [];
    this.matches = [];
    this.scrumbler = -1;
  }

  addPlayer(player: Player) {
    this.playersAtGame.push(player);
    this.allPlayers.push(player);
  }

  nextScrumbler() {
    return this.allPlayers[this.discoverScrumbler(this.scrumbler)].name;
  }

  private discoverScrumbler(currentScrumbler: number) {
    currentScrumbler = ((currentScrumbler + 1) % (this.allPlayers.length));
    for (let player of this.allPlayers) {
      if (player.id == currentScrumbler && !player.getBoomed()) {
        this.scrumbler = currentScrumbler;
        return this.scrumbler;
      }
    }
    return this.discoverScrumbler(currentScrumbler);
  }
}
