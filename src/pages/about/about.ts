import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game, Hand, Match, Player} from "../../app/customer.interface";
import {FormArray, FormBuilder, FormGroup} from "@angular/forms";

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
        pontos: ['0'],
        estourou: [false],
        handForm: this._fb.array([])
      }
    );

    // for(let player of this.game.playersAtGame){
    //   this.addHand(player)
    // }
  }

  addHand(player: Player) {
    const control = <FormArray>this.handForm.controls['handForm'];
    const addrCtrl = this.initHand(player);
    control.push(addrCtrl);
  }

  estourou(player: Player) {
    let hand = new Hand();
    hand.player = player;
    hand.score = 100;
    this.currentMatch.handsOfMatch.push(hand)
  }

  setPontos(player: Player, i: number) {
    const control = <FormArray>this.handForm.controls['handForm'];
    let hand = new Hand();
    hand.player = player;
    console.log(control);
    // hand.score = control.controls[i].get('pontos').value;
    // this.currentMatch.handsOfMatch.push(hand)
  }

  private initHand(player: Player) {
    return this._fb.group({
      pontos: ['0'],
      estourou: [false],
    });
  }
}
