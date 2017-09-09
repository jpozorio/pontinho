import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Match, Player} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";
import {GameOverviewPage} from "../overview/GameOverview";

@Component({
  selector: 'page-entrada',
  templateUrl: 'Entrada.html'
})
export class EntradaPage {

  max;
  min;
  scrumblerName;
  game: Game;
  currentMatch: Match;
  public reentriesForm: FormGroup;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game_1');
    this.currentMatch = navParams.get('currentMatch');
    this.scrumblerName = navParams.get('scrumblerName');
    this.max = this.game.getMaxPointsOfAllPlayers();
    this.min = this.game.getMinPointsOfAllPlayers();
  }

  ngOnInit() {
    this.reentriesForm = this._fb.group(
      {
        reentriesForm: this._fb.array([])
      }
    );
  }

  entrou(player: Player, i: number, value) {
    for (let hand of this.currentMatch.handsOfMatch) {
      if (hand.player.id == player.id) {
        hand.enter = value;
        hand.valuePaid = 0;
        value == true ? player.reentries++ : player.reentries--
      }
    }
  }

  setValuePaidCurrentHand(player: Player, i: number, value) {
    player.currentHand.valuePaid = value ? parseInt(value) : 0;
  }

  finishReentriesCad() {
    this.navCtrl.setRoot(GameOverviewPage, {game_1: this.game, scrumblerName: this.scrumblerName});
  }
}
