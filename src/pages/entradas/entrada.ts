import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Match, Player} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";
import {ContactPage} from "../contact/contact";

@Component({
  selector: 'page-entrada',
  templateUrl: 'entrada.html'
})
export class EntradaPage {

  scrumblerName;
  game: Game;
  currentMatch: Match;
  public reentriesForm: FormGroup;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game_1');
    this.currentMatch = navParams.get('currentMatch');
    this.scrumblerName = navParams.get('scrumblerName');
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
    this.navCtrl.setRoot(ContactPage, {game_1: this.game, scrumblerName: this.scrumblerName});
  }
}
