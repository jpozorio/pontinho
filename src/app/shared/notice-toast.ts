import { ToastController } from '@ionic/angular';
import { GameStore } from '../state/game-store';

const MESSAGES = {
  'agreement-dropped': 'O acordo foi desfeito porque voltou a ter mais de 2 jogadores',
} as const;

/** Mostra (uma vez) o aviso pendente do store, se houver. */
export async function showStoreNotice(store: GameStore, toasts: ToastController): Promise<void> {
  const notice = store.takeNotice();
  if (notice === null) return;
  const toast = await toasts.create({ message: MESSAGES[notice], duration: 4000, position: 'top' });
  await toast.present();
}
