import {Component} from '@angular/core';
import {NavController, NavParams} from 'ionic-angular';
import {GamePage} from "../about/about";
import {Game} from "../../app/customer.interface";

@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactPage {

  game: Game;

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.game = navParams.get('game');
  }

  goToCadHand() {
    this.navCtrl.setRoot(GamePage, {game: this.game});
  }
}
