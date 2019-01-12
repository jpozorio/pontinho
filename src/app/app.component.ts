import {Component} from '@angular/core';

import {Platform} from '@ionic/angular';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html'
})
export class AppComponent {
	public appPages = [
		{
			title: 'Novo jogo',
			url: '/cad-players',
			icon: 'home'
		},
		// {
		//   title: 'Lançar entradas',
		//   url: '/entradas',
		//   icon: 'list'
		// },
		{
			title: 'Histórico de mãos',
			url: '/hand-history',
			icon: 'grid'
		},
		{
			title: 'Lançar pontos',
			url: '/game',
			icon: 'add'
		},
		{
			title: 'Resumo do jogo',
			url: '/overview',
			icon: 'flash'
		},
		{
			title: 'Configurações',
			url: '/settings',
			icon: 'settings'
		}
	];
	showSplash = true;

	constructor(
			private platform: Platform,
			private splashScreen: SplashScreen,
			private statusBar: StatusBar
	) {
		this.initializeApp();
	}

	initializeApp() {
		this.platform.ready().then(() => {
			// this.androidFetchWorkaround();
			this.statusBar.styleDefault();
			this.splashScreen.hide();

			const self = this;
			setTimeout(function () {
				self.showSplash = false;
			}, 3000);
		});
	}

	androidFetchWorkaround() {
		const originalFetch = (window as any).fetch;

		(window as any).fetch = (...args) => {
			const [url] = args;

			if (typeof url === 'string' && url.match(/\.svg/)) {
				return new Promise((resolve, reject) => {
					const req = new XMLHttpRequest();
					req.open('GET', url, true);
					req.addEventListener('load', () => {
						resolve({ok: true, text: () => Promise.resolve(req.responseText)});
					});
					req.addEventListener('error', reject);
					req.send();
				});
			} else {
				return originalFetch(...args);
			}
		};
	}
}
