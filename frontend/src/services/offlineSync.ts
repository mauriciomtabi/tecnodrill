import { Barra } from '../types';
import { ApiService } from './api';

export interface PendingBarra {
  id: string;
  furoId: string;
  barraData: Partial<Barra>;
  timestamp: number;
}

export class OfflineSyncService {
  private static storageKey(): string {
    const user = ApiService.getUsuarioAtual();
    if (!user?.id) throw new Error('Entre novamente antes de registrar produção.');
    // Keep the old unowned queue untouched for management to reconcile safely.
    return `tecnodrill_offline_barras_queue_${user.id}`;
  }

  public static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  public static getQueue(): PendingBarra[] {
    if (!ApiService.getUsuarioAtual()?.id) return [];
    const raw = localStorage.getItem(this.storageKey());
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static enqueueBarra(furoId: string, barraData: Partial<Barra>): PendingBarra {
    const queue = this.getQueue();
    const item: PendingBarra = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      furoId,
      barraData,
      timestamp: Date.now()
    };
    queue.push(item);
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(queue));
    } catch (err) {
      console.warn('[OfflineSync] Limite de armazenamento local excedido. Otimizando fila:', err);
      // Se estourar a cota de 5MB do localStorage, preserva os dados técnicos do registro
      item.barraData = { ...barraData, fotos: [], foto_url: undefined };
      try {
        localStorage.setItem(this.storageKey(), JSON.stringify(queue));
      } catch (_) {}
    }
    return item;
  }

  public static async syncQueue(onProgress?: (synced: number, total: number) => void): Promise<{ syncedCount: number; errors: number }> {
    if (!this.isOnline()) return { syncedCount: 0, errors: 0 };
    
    const queue = this.getQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: 0 };
    const ownerId = ApiService.getUsuarioAtual()?.id;
    const storageKey = this.storageKey();

    let syncedCount = 0;
    let errors = 0;
    const remainingQueue: PendingBarra[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (ApiService.getUsuarioAtual()?.id !== ownerId) {
        remainingQueue.push(...queue.slice(i));
        break;
      }
      try {
        await ApiService.addBarra(item.furoId, item.barraData);
        syncedCount++;
        if (onProgress) onProgress(syncedCount, queue.length);
      } catch (err) {
        console.warn('[OfflineSync] Falha ao sincronizar item:', item.id, err);
        errors++;
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(remainingQueue));
    return { syncedCount, errors };
  }
}
