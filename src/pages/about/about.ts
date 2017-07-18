import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game} from "../../app/customer.interface";

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class GamePage {

  game: Game;

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.game = navParams.get('game');
  }

}
