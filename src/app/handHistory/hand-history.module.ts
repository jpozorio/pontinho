import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {RouterModule} from '@angular/router';

import {HandHistoryPage} from "./HandHistory";

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		RouterModule.forChild([
			{
				path: '',
				component: HandHistoryPage
			}
		])
	],
	declarations: [HandHistoryPage]
})
export class HandHistoryModule {
}
