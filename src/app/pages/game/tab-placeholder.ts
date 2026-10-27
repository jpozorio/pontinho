import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

// Placeholders: os Tasks seguintes substituem por HistoryTab e MoneyTab.
@Component({
  selector: 'app-historico-tab',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `<ion-header><ion-toolbar><ion-title>Histórico</ion-title></ion-toolbar></ion-header><ion-content></ion-content>`,
})
export class HistoricoTab {}

@Component({
  selector: 'app-dinheiro-tab',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `<ion-header><ion-toolbar><ion-title>Dinheiro</ion-title></ion-toolbar></ion-header><ion-content></ion-content>`,
})
export class DinheiroTab {}
