import {ErrorHandler, NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {IonicApp, IonicErrorHandler, IonicModule} from "ionic-angular";
import {MyApp} from "./app.component";

import {GamePage} from "../pages/about/about";
import {ContactPage} from "../pages/contact/contact";
import {CadPlayers} from "../pages/home/home";
import {TabsPage} from "../pages/tabs/tabs";

import {StatusBar} from "@ionic-native/status-bar";
import {SplashScreen} from "@ionic-native/splash-screen";
import {PlayerComponent} from "./player.component";
import {HandComponent} from "./hand.component";
import {EntradaPage} from "../pages/entradas/entrada";

@NgModule({
  declarations: [
    MyApp,
    GamePage,
    ContactPage,
    EntradaPage,
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
    ContactPage,
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
