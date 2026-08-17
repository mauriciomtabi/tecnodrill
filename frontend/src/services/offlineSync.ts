import { Barra } from '../types';
import { ApiService } from './api';

export interface PendingBarra {
  id: string;
  furoId: string;
  barraData: Partial<Barra>;
  timestamp: number;
}

export class OfflineSyncService {
  private static STORAGE_KEY = 'tecnodrill_offline_barras_queue';

  public static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  public static getQueue(): PendingBarra[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
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
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    return item;
  }

  public static async syncQueue(onProgress?: (synced: number, total: number) => void): Promise<{ syncedCount: number; errors: number }> {
    if (!this.isOnline()) return { syncedCount: 0, errors: 0 };
    
    const queue = this.getQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;
    const remainingQueue: PendingBarra[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
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

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remainingQueue));
    return { syncedCount, errors };
  }
}
