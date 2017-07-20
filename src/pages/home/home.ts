import {Component} from "@angular/core";
import {NavController} from "ionic-angular";
import {Game, Player} from "../../app/customer.interface";
import {AbstractControl, FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {GamePage} from "../about/about";

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class CadPlayers {

  public formPlayers: FormGroup;
  game: Game;

  constructor(public navCtrl: NavController, private _fb: FormBuilder) {

  }

  ngOnInit() {
    this.formPlayers = this._fb.group(
      {
        name: ['', [Validators.required]],
        vlrPago: ['0', [Validators.required]],
        formPlayers: this._fb.array([])
      }
    );

    this.addPlayer();
  }

  initPlayer() {
    return this._fb.group({
      name: ['', Validators.required],
      vlrPago: ['0', [Validators.required]],
    });
  }

  addPlayer() {
    const control = <FormArray>this.formPlayers.controls['formPlayers'];
    const addrCtrl = this.initPlayer();
    control.push(addrCtrl);
  }

  removePlayer(i: number) {
    const control = <FormArray>this.formPlayers.controls['formPlayers'];
    control.removeAt(i);
  }


  finishCadPlayers() {
    const control = <FormArray>this.formPlayers.controls['formPlayers'];
    this.game = new Game();
    let controlPlayer: AbstractControl;
    for (controlPlayer of control.controls) {
      let p: Player = new Player();
      p.name = controlPlayer.get('name').value;
      p.valuePaid = 0;//TODO: add field to set valuePaid by player
      if (p.name) {
        this.game.addPlayer(p);
      }
    }

    this.navCtrl.setRoot(GamePage, {game: this.game});

  }

}
