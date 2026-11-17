import { Barra } from '../types';
import { ApiService } from './api';
import { OfflineDatabase, PendingBarra } from './offlineDatabase';

export type { PendingBarra };

export class OfflineSyncService {
  private static isSyncing = false;
  private static migrationDone = false;

  public static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Migra silenciosamente qualquer item legado que tenha ficado no localStorage para o IndexedDB
   */
  public static async migrateLegacyLocalStorage(): Promise<void> {
    if (this.migrationDone || typeof window === 'undefined') return;
    this.migrationDone = true;

    try {
      const user = ApiService.getUsuarioAtual();
      const keysToCheck = [
        user?.id ? `tecnodrill_offline_barras_queue_${user.id}` : null,
        'tecnodrill_offline_barras_queue'
      ].filter(Boolean) as string[];

      for (const key of keysToCheck) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const items = JSON.parse(raw);
            if (Array.isArray(items)) {
              for (const it of items) {
                if (it && it.furoId && it.barraData) {
                  await OfflineDatabase.enqueueBarra({
                    id: it.id || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    furoId: it.furoId,
                    barraData: it.barraData,
                    timestamp: it.timestamp || Date.now(),
                    userId: user?.id,
                    userName: user?.nome,
                    status: 'PENDING'
                  });
                }
              }
            }
          } catch (_) {}
          localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('[OfflineSync] Erro na migração legada:', err);
    }
  }

  public static async getQueue(): Promise<PendingBarra[]> {
    await this.migrateLegacyLocalStorage();
    const user = ApiService.getUsuarioAtual();
    return OfflineDatabase.getPendingBarras(user?.id);
  }

  public static async getPendingCount(): Promise<number> {
    await this.migrateLegacyLocalStorage();
    const user = ApiService.getUsuarioAtual();
    return OfflineDatabase.getPendingCount(user?.id);
  }

  public static async enqueueBarra(furoId: string, barraData: Partial<Barra>): Promise<PendingBarra> {
    await this.migrateLegacyLocalStorage();
    const user = ApiService.getUsuarioAtual();

    const item: PendingBarra = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      furoId,
      barraData,
      timestamp: Date.now(),
      userId: user?.id,
      userName: user?.nome,
      status: 'PENDING'
    };

    await OfflineDatabase.enqueueBarra(item);

    // Notifica ouvintes locais (UI) para atualizar contadores e badges imediatamente
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tecnodrill_offline_queue_changed', { detail: { count: await this.getPendingCount() } }));
    }

    return item;
  }

  public static async syncQueue(
    onProgress?: (synced: number, total: number, currentBarraNum?: number) => void
  ): Promise<{ syncedCount: number; errors: number }> {
    if (this.isSyncing) {
      console.log('[OfflineSync] Sincronização já em andamento. Aguardando...');
      return { syncedCount: 0, errors: 0 };
    }

    if (!this.isOnline()) {
      return { syncedCount: 0, errors: 0 };
    }

    await this.migrateLegacyLocalStorage();
    const user = ApiService.getUsuarioAtual();
    const queue = await OfflineDatabase.getPendingBarras(user?.id);

    if (queue.length === 0) {
      return { syncedCount: 0, errors: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let errors = 0;

    console.log(`[OfflineSync] Iniciando sincronização de ${queue.length} item(ns)...`);

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        // Se a conexão cair durante a sincronização em lote, para de tentar os próximos
        if (!this.isOnline()) {
          console.warn('[OfflineSync] Conexão perdida durante o lote. Pausando sincronização.');
          break;
        }

        try {
          await OfflineDatabase.updatePendingStatus(item.id, 'SYNCING');
          if (onProgress) {
            onProgress(syncedCount, queue.length, item.barraData.numero_barra);
          }

          // Salva o registro na nuvem via ApiService (que já faz upload das fotos para o storage CDN)
          await ApiService.addBarra(item.furoId, item.barraData);

          // Remove da fila local com sucesso confirmado
          await OfflineDatabase.removePendingBarra(item.id);
          syncedCount++;

          if (onProgress) {
            onProgress(syncedCount, queue.length, item.barraData.numero_barra);
          }
        } catch (err: any) {
          console.error(`[OfflineSync] Erro ao sincronizar item ${item.id}:`, err);
          errors++;
          await OfflineDatabase.updatePendingStatus(item.id, 'ERROR', err?.message || 'Erro de sincronização');
        }
      }
    } finally {
      this.isSyncing = false;
      if (typeof window !== 'undefined') {
        const remaining = await this.getPendingCount();
        window.dispatchEvent(new CustomEvent('tecnodrill_offline_queue_changed', { detail: { count: remaining } }));
      }
    }

    return { syncedCount, errors };
  }
}
