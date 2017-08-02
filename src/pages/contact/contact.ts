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
    this.game = navParams.get('game_1');
    this.computeCurrentScoreEachPlayer();
  }

  goToCadHand() {
    this.navCtrl.setRoot(GamePage, {game: this.game});
  }


  private computeCurrentScoreEachPlayer() {
    let max = this.getMaxPointsOfAllPlayers();
    for (let idx = this.game.playersAtGame.length - 1; idx >= 0; idx--) {
      let player = this.game.playersAtGame[idx];
      if (player.getBoomed()) {
        if (player.currentHand.enter) {
          player.currentScore = max;
          player.valuePaid += player.currentHand.valuePaid;
        } else {
          this.game.playersAtGame.splice(idx, 1);
        }
      }
    }
  }

  private getMaxPointsOfAllPlayers() {
    let max = -1;
    for (let player of this.game.playersAtGame) {
      if (player.currentScore > max && !player.getBoomed()) {
        max = player.currentScore;
      }
    }
    return max;
  }
}
