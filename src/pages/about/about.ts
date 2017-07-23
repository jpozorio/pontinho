import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Hand, Match, Player} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class GamePage {

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

  estourou(player: Player) {
    let hand = new Hand();
    hand.player = player;
    hand.score = 100;
    this.currentMatch.handsOfMatch.push(hand)
  }

  setPontos(player: Player, i: number, value) {
    let hand = new Hand();
    hand.player = player;
    hand.score = value;
    this.currentMatch.handsOfMatch.push(hand)
  }

}
