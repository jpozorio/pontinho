import {Component, Input} from "@angular/core";
import {FormGroup} from "@angular/forms";

@Component(
  {
    // moduleId: module.id,
    selector: 'player',
    templateUrl: 'player.component.html',
  }
)
export class PlayerComponent {
  @Input('group')
  public playerForm: FormGroup;
}
