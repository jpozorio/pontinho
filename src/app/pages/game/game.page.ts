import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { cashOutline, createOutline, listOutline } from 'ionicons/icons';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

@Component({
  selector: 'app-game',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="rodada">
          <ion-icon name="create-outline" />
          <ion-label>Rodada</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="historico">
          <ion-icon name="list-outline" />
          <ion-label>Histórico</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="caixa">
          <ion-icon name="cash-outline" />
          <ion-label>Caixa</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class GamePage {
  constructor() {
    addIcons({ createOutline, listOutline, cashOutline });
  }
}
