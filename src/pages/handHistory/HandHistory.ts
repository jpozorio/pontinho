import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Match} from "../../app/customer.interface";
import {FormBuilder} from "@angular/forms";

@Component({
  selector: 'page-handHistory',
  templateUrl: 'HandHistory.html'
})
export class HandHistoryPage {

  game: Game;
  currentMatch: Match;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game');
    this.currentMatch = navParams.get('currentMatch');
  }

  ngOnInit() {

  }

}
