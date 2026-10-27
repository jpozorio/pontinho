import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { GameStore } from '../../state/game-store';

const CONFETTI_EMOJIS = ['🎉', '♠️', '♥️', '♣️', '♦️', '🃏', '✨', '🎊'];

/** Chuva de confete: posição, atraso e duração espalhados de forma fixa (sem aleatoriedade). */
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
  left: (i * 37 + 5) % 96,
  delay: ((i * 7) % 12) / 10,
  duration: 2.2 + ((i * 3) % 5) * 0.2,
}));

@Component({
  selector: 'app-game-over',
  imports: [CurrencyPipe, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './game-over.page.html',
  styleUrl: './game-over.page.scss',
})
export class GameOverPage {
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);

  readonly view = this.store.view;
  readonly confetti = CONFETTI;
  /** muda a cada nova entrada na página (a primeira já toca ao criar) para recriar e tocar de novo o confete */
  readonly party = signal(0);
  private entered = false;
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

  /** Saldo acumulado na noite (já inclui esta partida), por jogador. */
  readonly nightBalances = computed(() => new Map((this.store.cash()?.rows ?? []).map((r) => [r.player, r.balance])));

  constructor() {
    if (!this.settlement()) void this.router.navigateByUrl('/');
  }

  /** A página fica em cache: ao voltar depois de fechar a noite, não há mais o que mostrar. */
  ionViewWillEnter(): void {
    if (!this.settlement()) void this.router.navigateByUrl('/', { replaceUrl: true });
    if (this.entered) this.party.update((n) => n + 1);
    this.entered = true;
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

  openCaixa(): void {
    void this.router.navigateByUrl('/caixa');
  }

  async newGame(): Promise<void> {
    if (this.store.archiveFinished()) await this.router.navigateByUrl('/novo');
  }
}
