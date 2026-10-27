import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-setup',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header><ion-toolbar><ion-title>Novo jogo</ion-title></ion-toolbar></ion-header>
    <ion-content></ion-content>
  `,
})
export class SetupPage {}
