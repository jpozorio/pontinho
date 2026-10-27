import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { MoneyRow, suggestedPayment } from '../../domain/money';
import { PayButton } from '../../shared/pay-button';
import { GameStore } from '../../state/game-store';

@Component({
  selector: 'app-game-over',
  imports: [CurrencyPipe, DatePipe, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, PayButton],
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

  /** quanto sobra para o vencedor depois do que os outros salvaram */
  readonly rest = computed(() => {
    const s = this.settlement();
    return s ? Math.round((s.winnerTakes - (s.saves[s.winner] ?? 0)) * 100) / 100 : 0;
  });

  readonly savers = computed(() => {
    const s = this.settlement();
    return s ? Object.entries(s.saves).filter(([name]) => name !== s.winner) : [];
  });

  readonly owing = computed(() =>
    (this.store.money()?.rows ?? []).filter((r) => r.outstanding > 0 || r.oldDebts.length > 0),
  );

  constructor() {
    if (!this.settlement()) void this.router.navigateByUrl('/');
  }

  suggested(r: MoneyRow): number {
    return suggestedPayment(r);
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
    if (this.store.archiveAndPrepareNext()) await this.router.navigateByUrl('/novo');
  }
}
