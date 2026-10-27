import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { GameStore } from '../../state/game-store';

@Component({
  selector: 'app-game-over',
  imports: [CurrencyPipe, IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './game-over.page.html',
  styleUrl: './game-over.page.scss',
})
export class GameOverPage {
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);

  readonly view = this.store.view;
  readonly settlement = computed(() => (this.view()?.winner ? (this.store.money()?.settlement ?? null) : null));
  readonly rounds = computed(() => this.view()?.history.length ?? 0);

  /** linhas da tabela com o vencedor primeiro */
  readonly rows = computed(() => {
    const s = this.settlement();
    if (!s) return [];
    return [...s.rows].sort((a, b) => Number(b.player === s.winner) - Number(a.player === s.winner));
  });

  /** todos que salvaram no acordo (inclusive o vencedor), na ordem dos jogadores */
  readonly savers = computed(() => {
    const s = this.settlement();
    return s ? s.rows.filter((r) => Object.hasOwn(s.saves, r.player)).map((r) => [r.player, s.saves[r.player]] as const) : [];
  });

  /** o que sobra do pote para o vencedor depois de todos os valores salvos */
  readonly rest = computed(() => {
    const s = this.settlement();
    if (!s) return 0;
    return Math.round((s.pot - this.savers().reduce((a, [, v]) => a + v, 0)) * 100) / 100;
  });

  constructor() {
    if (!this.settlement()) void this.router.navigateByUrl('/');
  }

  async undoLast(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Desfazer a última rodada?',
      message: 'A partida volta a ficar em andamento.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Desfazer', role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    this.store.undoFrom(this.rounds() - 1);
    await this.router.navigateByUrl('/jogo/rodada');
  }

  async newGame(): Promise<void> {
    if (this.store.archiveFinished()) await this.router.navigateByUrl('/novo');
  }
}
