import {ErrorHandler, NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {IonicApp, IonicErrorHandler, IonicModule} from "ionic-angular";
import {MyApp} from "./app.component";

import {GamePage} from "../pages/game/Game";
import {GameOverviewPage} from "../pages/overview/GameOverview";
import {CadPlayers} from "../pages/cadPlayers/CadPlayers";
import {TabsPage} from "../pages/tabs/tabs";

import {StatusBar} from "@ionic-native/status-bar";
import {SplashScreen} from "@ionic-native/splash-screen";
import {PlayerComponent} from "./player.component";
import {HandComponent} from "./hand.component";
import {EntradaPage} from "../pages/entradas/Entrada";
import {HandHistoryPage} from "../pages/handHistory/HandHistory";

@NgModule({
  declarations: [
    MyApp,
    GamePage,
    GameOverviewPage,
    EntradaPage,
    HandHistoryPage,
    CadPlayers,
    TabsPage,
    PlayerComponent,
    HandComponent
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(MyApp)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    GamePage,
    GameOverviewPage,
    HandHistoryPage,
    EntradaPage,
    CadPlayers,
    TabsPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler}
  ]
})
export class AppModule {
}
