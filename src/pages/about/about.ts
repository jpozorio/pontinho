import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Hand, Match, MAX_POINTS, Player} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";
import {ContactPage} from "../contact/contact";

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class GamePage {

  mensagem;
  game: Game;
  currentMatch: Match;
  public handForm: FormGroup;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game');
    this.currentMatch = new Match();
    this.currentMatch.handsOfMatch = [];
    this.game.matches.push(this.currentMatch);
  }

  ngOnInit() {
    this.handForm = this._fb.group(
      {
        handForm: this._fb.array([])
      }
    );
  }

  estourou(player: Player, i: number) {
    this.setPontos(player, i, MAX_POINTS)
  }

  private getPreviousHand(player: Player) {
    let previousHand;
    for (let hand of this.currentMatch.handsOfMatch) {
      if (hand.player.id == player.id) {
        previousHand = hand;
        break;
      }
    }
    return previousHand;
  }

  setPontos(player: Player, i: number, value) {
    this.mensagem = '';
    let previousHand = this.getPreviousHand(player);
    let hand;
    if (previousHand) {
      hand = previousHand;
      player.currentScore = player.currentScore - hand.score;
    } else {
      hand = new Hand();
      hand.player = player;
      this.currentMatch.handsOfMatch.push(hand)
    }
    hand.score = parseInt(value);
    player.currentScore = player.currentScore + hand.score;
  }

  finishScoreCad() {
    let qtdeHands = this.currentMatch.handsOfMatch.length;
    let qtdePlayers = this.game.playersAtGame.length;
    if (qtdeHands == qtdePlayers) {
      this.computeCurrentScoreEachPlayer();
      this.navCtrl.setRoot(ContactPage, {game: this.game});
    } else {
      this.mensagem = 'Lance os pontos de todos os jogadores';
    }
  }

  private computeCurrentScoreEachPlayer() {
    let max = this.getMaxPointsOfAllPlayers();
    for (let player of this.game.playersAtGame) {
      if (player.currentScore >= MAX_POINTS) {
        player.currentScore = max;
      }
    }
  }

  private getMaxPointsOfAllPlayers() {
    let max = -1;
    for (let player of this.game.playersAtGame) {
      if (player.currentScore > max && player.currentScore < MAX_POINTS) {
        max = player.currentScore;
      }
    }
    return max;
  }

  entrou(player: Player, i: number) {
    for (let hand of this.currentMatch.handsOfMatch) {
      if (hand.player.id == player.id) {
        hand.enter = true;
        player.reentries++
      }
    }
  }
}
