import {Component} from '@angular/core';
import {NavController, NavParams} from 'ionic-angular';
import {GamePage} from "../game/Game";
import {Game} from "../../app/customer.interface";
import {HandHistoryPage} from "../handHistory/HandHistory";

@Component({
  selector: 'page-contact',
  templateUrl: 'GameOverview.html'
})
export class GameOverviewPage {

  game: Game;
  scrumblerName;

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.game = navParams.get('game_1');
    this.scrumblerName = navParams.get('scrumblerName');
    this.computeCurrentScoreEachPlayer();
  }

  goToCadHand() {
    this.navCtrl.setRoot(GamePage, {game: this.game});
  }


  private computeCurrentScoreEachPlayer() {
    let max = this.game.getMaxPointsOfAllPlayers();
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

  viewHandHistory() {
    this.navCtrl.push(HandHistoryPage, {game: this.game});
  }
}
