import { Barra, Furo, Servico } from '../types';

export interface PendingBarra {
  id: string;
  furoId: string;
  barraData: Partial<Barra>;
  timestamp: number;
  userId?: string;
  userName?: string;
  status: 'PENDING' | 'SYNCING' | 'ERROR';
  errorMessage?: string;
  retryCount?: number;
}

const DB_NAME = 'tecnodrill_offline_db';
const DB_VERSION = 1;

export class OfflineDatabase {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  public static async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB não suportado neste ambiente.'));
      }

      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Fila de barras pendentes de sincronização
        if (!db.objectStoreNames.contains('pending_barras')) {
          const store = db.createObjectStore('pending_barras', { keyPath: 'id' });
          store.createIndex('furoId', 'furoId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }

        // Cache de serviços/obras
        if (!db.objectStoreNames.contains('cached_servicos')) {
          db.createObjectStore('cached_servicos', { keyPath: 'id' });
        }

        // Cache de furos
        if (!db.objectStoreNames.contains('cached_furos')) {
          const store = db.createObjectStore('cached_furos', { keyPath: 'id' });
          store.createIndex('servico_id', 'servico_id', { unique: false });
        }

        // Cache de barras por furo
        if (!db.objectStoreNames.contains('cached_barras')) {
          const store = db.createObjectStore('cached_barras', { keyPath: 'id' });
          store.createIndex('furo_id', 'furo_id', { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Erro ao abrir IndexedDB.'));
    });

    return this.dbPromise;
  }

  // ============================================================================
  // FILA DE APONTAMENTOS PENDENTES (PENDING_BARRAS)
  // ============================================================================
  public static async enqueueBarra(item: PendingBarra): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_barras', 'readwrite');
      const store = tx.objectStore('pending_barras');
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async getPendingBarras(userId?: string): Promise<PendingBarra[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_barras', 'readonly');
      const store = tx.objectStore('pending_barras');
      const req = store.getAll();
      req.onsuccess = () => {
        let items: PendingBarra[] = req.result || [];
        if (userId) {
          items = items.filter(i => !i.userId || i.userId === userId);
        }
        // Ordena por timestamp crescente (mais antigo primeiro)
        items.sort((a, b) => a.timestamp - b.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async getPendingCount(userId?: string): Promise<number> {
    const list = await this.getPendingBarras(userId);
    return list.length;
  }

  public static async removePendingBarra(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_barras', 'readwrite');
      const store = tx.objectStore('pending_barras');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async updatePendingStatus(id: string, status: 'PENDING' | 'SYNCING' | 'ERROR', errorMessage?: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_barras', 'readwrite');
      const store = tx.objectStore('pending_barras');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item: PendingBarra = getReq.result;
        if (item) {
          item.status = status;
          if (errorMessage !== undefined) item.errorMessage = errorMessage;
          if (status === 'ERROR') item.retryCount = (item.retryCount || 0) + 1;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // ============================================================================
  // CACHE DE LEITURA (SERVICOS / FUROS / BARRAS)
  // ============================================================================
  public static async cacheServicos(servicos: Servico[]): Promise<void> {
    if (!servicos || servicos.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('cached_servicos', 'readwrite');
      const store = tx.objectStore('cached_servicos');
      for (const s of servicos) {
        store.put(s);
      }
    } catch (err) {
      console.warn('[OfflineDB] Erro ao gravar cache de serviços:', err);
    }
  }

  public static async getCachedServicos(): Promise<Servico[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_servicos', 'readonly');
        const store = tx.objectStore('cached_servicos');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public static async cacheFuros(furos: Furo[]): Promise<void> {
    if (!furos || furos.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('cached_furos', 'readwrite');
      const store = tx.objectStore('cached_furos');
      for (const f of furos) {
        store.put(f);
      }
    } catch (err) {
      console.warn('[OfflineDB] Erro ao gravar cache de furos:', err);
    }
  }

  public static async getCachedFuros(servicoId?: string): Promise<Furo[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_furos', 'readonly');
        const store = tx.objectStore('cached_furos');
        const req = store.getAll();
        req.onsuccess = () => {
          let list: Furo[] = req.result || [];
          if (servicoId) {
            list = list.filter(f => f.servico_id === servicoId);
          }
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public static async cacheBarras(furoId: string, barras: Barra[]): Promise<void> {
    if (!furoId || !barras) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction('cached_barras', 'readwrite');
      const store = tx.objectStore('cached_barras');
      for (const b of barras) {
        store.put({ ...b, furo_id: furoId });
      }
    } catch (err) {
      console.warn('[OfflineDB] Erro ao gravar cache de barras:', err);
    }
  }

  public static async getCachedBarras(furoId: string): Promise<Barra[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_barras', 'readonly');
        const store = tx.objectStore('cached_barras');
        const index = store.index('furo_id');
        const req = index.getAll(furoId);
        req.onsuccess = () => {
          const list: Barra[] = req.result || [];
          list.sort((a, b) => (a.numero_barra || 0) - (b.numero_barra || 0));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
}
