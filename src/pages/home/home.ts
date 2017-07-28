import {Component} from "@angular/core";
import {NavController, NavParams} from "ionic-angular";
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

  constructor(public navCtrl: NavController, private _fb: FormBuilder, public navParams: NavParams) {
    this.game = new Game();
    let oldGame = navParams.get('game_1');
    if (oldGame) {
      for (let oldPlayer of oldGame.allPlayers) {
        let newPlayer = new Player();
        newPlayer.name = oldPlayer.name;
        newPlayer.id = oldPlayer.id;
        newPlayer.valuePaid = 0;
        this.game.addPlayer(newPlayer)
      }
    }
  }

  ngOnInit() {
    this.formPlayers = this._fb.group(
      {
        name: ['', [Validators.required]],
        vlrPago: ['0', [Validators.required]],
        formPlayers: this._fb.array([])
      }
    );
    if (this.game.allPlayers.length > 0) {
      for (let player of this.game.allPlayers) {
        this.addPlayer(player);
      }
    } else {
      this.newPlayer();
      this.newPlayer();
      this.newPlayer();
      this.newPlayer();
    }

  }

  initPlayer() {
    return this._fb.group({
      name: ['', Validators.required],
      vlrPago: ['0', [Validators.required]],
    });
  }

  initExistentPlayer(player: Player) {
    return this._fb.group({
      name: [player.name, Validators.required],
      vlrPago: [player.valuePaid, [Validators.required]],
    });
  }

  addPlayer(player: Player) {
    const control = <FormArray>this.formPlayers.controls['formPlayers'];
    const addrCtrl = this.initExistentPlayer(player);
    control.push(addrCtrl);
  }

  newPlayer() {
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
    let idPlayer = 0;
    for (controlPlayer of control.controls) {
      let p: Player = new Player();
      p.name = controlPlayer.get('name').value;
      p.valuePaid = controlPlayer.get('vlrPago').value;
      p.id = idPlayer++;
      if (p.name) {
        this.game.addPlayer(p);
      }
    }

    this.navCtrl.setRoot(GamePage, {game: this.game});

  }

}
