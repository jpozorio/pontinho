import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
import {Game} from "../../app/customer.interface";
import {FormBuilder, FormGroup} from "@angular/forms";

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class GamePage {

  game: Game;
  public handForm: FormGroup;

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = navParams.get('game');
  }

  ngOnInit() {
    this.handForm = this._fb.group(
      {
        handForm: this._fb.array([])
      }
    );
  }
}
