import {Component, OnDestroy} from '@angular/core';

@Component({
	selector: 'settings',
	templateUrl: 'settings.html'
})
export class SettingsPage implements OnDestroy{

	gameValue = 1;

	constructor() {
		const storedValue = localStorage.getItem('game-value');
		if(storedValue) {
			this.gameValue = parseInt(storedValue);
		}
	}

	ngOnDestroy(): void {
		localStorage.setItem('game-value', this.gameValue.toString())
	}

}
