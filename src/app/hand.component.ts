import {Component, Input} from "@angular/core";
import {FormGroup} from "@angular/forms";

@Component(
  {
    selector: 'hand',
    templateUrl: 'hand.component.html',
  }
)
export class HandComponent {
  @Input('group')
  public handForm: FormGroup;
}
