import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { PlayerView } from '../../domain/engine';
import { Score } from '../../domain/model';
import { showStoreNotice } from '../../shared/notice-toast';
import { GameStore } from '../../state/game-store';
import { LeftLevel, leftLevel } from '../round/points-left';
import { EditRoundModal } from './edit-round.modal';

interface FooterCell {
  total: string;
  left: string;
  level: LeftLevel | 'out';
}

@Component({
  selector: 'app-history',
  imports: [IonButton, IonContent, IonFooter, IonHeader, IonTitle, IonToolbar],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage {
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);

  readonly view = this.store.view;
  readonly game = this.store.game;
  readonly message = signal<string | null>(null);

  readonly players = computed(() => this.game()?.config.players ?? []);
  readonly rounds = computed(() => this.view()?.history ?? []);

  readonly footer = computed<FooterCell[]>(() =>
    (this.view()?.players ?? []).map((p: PlayerView): FooterCell => {
      if (p.status === 'out') return { total: '–', left: '–', level: 'out' };
      // quem estourou e ainda não reentrou fica com 💥; quem vai reentrar já mostra o que falta (como na Rodada)
      const bust = p.status === 'deciding' && p.decision !== 'reenter';
      const level: LeftLevel = bust ? 'bust' : leftLevel(p.pointsLeft);
      return { total: String(p.total), left: level === 'bust' ? '💥' : String(p.pointsLeft), level };
    }),
  );

  async edit(index: number): Promise<void> {
    const g = this.game();
    const round = g?.rounds[index];
    if (!g || !round) return;
    this.message.set(null);
    const modal = await this.modals.create({
      component: EditRoundModal,
      componentProps: {
        index,
        names: g.config.players.filter((n) => n in round.scores),
        initial: { ...round.scores },
      },
    });
    await modal.present();
    const res = await modal.onDidDismiss<Record<string, Score> | null>();
    if (res.role !== 'save' || !res.data) return;
    if (this.store.editRound(index, res.data)) return;
    const err = this.store.lastError();
    if (err === 'changes-outcome') {
      await this.confirmUndo(
        `Essa correção muda quem estourou. Desfazer a partir da rodada ${index + 1} e lançar de novo?`,
        index,
        true,
      );
    } else if (err === 'missing-scores') {
      this.message.set('Lance os pontos de todos');
    } else {
      this.message.set('Pontos inválidos');
    }
  }

  async undoLast(): Promise<void> {
    const n = this.rounds().length;
    if (n === 0) return;
    await this.confirmUndo(`Desfazer a rodada ${n}?`, n - 1, false);
  }

  private async confirmUndo(header: string, index: number, goToRound: boolean): Promise<void> {
    const a = await this.alerts.create({
      header,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Desfazer', role: 'confirm' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'confirm') return;
    this.store.undoFrom(index);
    this.message.set(null);
    await showStoreNotice(this.store, this.toasts);
    if (goToRound) await this.router.navigateByUrl('/jogo/rodada');
  }
}
