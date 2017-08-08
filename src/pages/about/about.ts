import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Hand, Match, MAX_POINTS, Player} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";
import {CadPlayers} from "../home/home";
import {EntradaPage} from "../entradas/entrada";
import {ContactPage} from "../contact/contact";

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class GamePage {

  mensagem;
  scrumblerName;
  game: Game;
  winner: Player;
  currentMatch: Match;
  public handForm: FormGroup;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game');
    this.currentMatch = new Match();
    this.currentMatch.handsOfMatch = [];
    this.game.matches.push(this.currentMatch);
    this.scrumblerName = this.game.nextScrumbler();
    for (let player of this.game.playersAtGame) {
      player.currentHand = null;
    }
  }

  ngOnInit() {
    this.handForm = this._fb.group(
      {
        handForm: this._fb.array([])
      }
    );
  }

  boom(player: Player, i: number, estourou: boolean) {
    if (estourou) {
      this.setPontos(player, i, MAX_POINTS);
    } else {
      this.setPontos(player, i, 0);
    }
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
      player.currentHand = hand;
      this.currentMatch.handsOfMatch.push(hand)
    }
    hand.score = value ? parseInt(value) : 0;
    player.currentScore = player.currentScore + hand.score;
  }

  finishScoreCad() {
    let qtdeHands = this.currentMatch.handsOfMatch.length;
    let qtdePlayers = this.game.playersAtGame.length;
    if (qtdeHands == qtdePlayers) {
      this.winner = this.getWinner();
      if (!this.winner) {
        let somePlayerBoom = this.someoneGetsBoomed();
        if (somePlayerBoom) {
          this.navCtrl.setRoot(EntradaPage, {game_1: this.game, currentMatch: this.currentMatch, scrumblerName: this.scrumblerName});
        } else {
          this.navCtrl.setRoot(ContactPage, {game_1: this.game, scrumblerName: this.scrumblerName});
        }
      }
    } else {
      this.mensagem = 'Lance os pontos de todos os jogadores';
    }
  }

  private someoneGetsBoomed() {
    for (let player of this.game.playersAtGame) {
      if (player.currentScore >= MAX_POINTS) {
        return true;
      }
    }
    return false;
  }

  private getWinner() {
    let qtdeLeftPlayers = 0;
    let winner: Player;
    for (let player of this.game.playersAtGame) {
      if (player.currentScore < MAX_POINTS) {
        qtdeLeftPlayers++;
        winner = player;
      }
    }
    return qtdeLeftPlayers == 1 ? winner : null;
  }

  newGame() {
    this.navCtrl.setRoot(CadPlayers, {game_1: this.game});
  }

}
