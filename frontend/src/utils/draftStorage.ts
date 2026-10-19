import { AddressDetails } from './watermark';

export interface RodDraft {
  id?: string;
  isOpen: boolean;
  source: 'OBRA_DETALHES' | 'DIRECT';
  servicoId?: string;
  furoId?: string;
  nextBarraNumber: number;
  step: 0 | 1 | 2 | 3 | 4;
  tipoRegistro: 'CANALIZACAO' | 'CAIXA';
  diametro: string;
  customDiametro?: string;
  numeroOs?: string;
  metros: number;
  temCaixa: boolean;
  observacao?: string;
  mesReferencia: string;
  latitude?: number | null;
  longitude?: number | null;
  precisao?: number | null;
  addressDetails?: AddressDetails | null;
  fotosList: string[];
  updatedAt: number;
}

const DB_NAME = 'tecnodrill_drafts_db';
const STORE_NAME = 'rod_drafts';
const DB_VERSION = 1;
const DRAFT_STORAGE_KEY = 'tecnodrill_active_rod_draft';

// Abre conexão com IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva rascunho de apontamento no IndexedDB (sem limite de 5MB)
 * e mantém cópia dos metadados no localStorage para verificação instantânea.
 */
export async function saveRodDraft(draft: Omit<RodDraft, 'id' | 'updatedAt'>): Promise<void> {
  const fullDraft: RodDraft = {
    ...draft,
    id: DRAFT_STORAGE_KEY,
    updatedAt: Date.now()
  };

  // 1. Salva metadados leves no localStorage para detecção instantânea
  try {
    const metaOnly = {
      isOpen: fullDraft.isOpen,
      source: fullDraft.source,
      servicoId: fullDraft.servicoId,
      furoId: fullDraft.furoId,
      nextBarraNumber: fullDraft.nextBarraNumber,
      step: fullDraft.step,
      tipoRegistro: fullDraft.tipoRegistro,
      fotosCount: fullDraft.fotosList.length,
      updatedAt: fullDraft.updatedAt
    };
    localStorage.setItem(DRAFT_STORAGE_KEY + '_meta', JSON.stringify(metaOnly));
  } catch (_) {}

  // 2. Salva o rascunho completo com as fotos no IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fullDraft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback: tenta salvar no localStorage com fotos truncadas se IndexedDB falhar
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fullDraft));
    } catch (_) {}
  }
}

/**
 * Recupera o rascunho ativo salvo
 */
export async function getRodDraft(servicoId?: string): Promise<RodDraft | null> {
  let draft: RodDraft | null = null;

  try {
    const db = await openDB();
    draft = await new Promise<RodDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_STORAGE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback para localStorage
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch (_) {}
  }

  if (!draft) return null;

  // Descarta rascunhos com mais de 48 horas (evita dados obsoletos)
  const isExpired = Date.now() - draft.updatedAt > 48 * 60 * 60 * 1000;
  if (isExpired) {
    await clearRodDraft();
    return null;
  }

  // Se foi requisitado para um serviço específico, confere compatibilidade
  if (servicoId && draft.servicoId && draft.servicoId !== servicoId) {
    return null;
  }

  return draft;
}

/**
 * Remove o rascunho após finalização com sucesso ou cancelamento explícito
 */
export async function clearRodDraft(): Promise<void> {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY + '_meta');
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_) {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_STORAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {}
}

/**
 * Verifica de forma síncrona/rápida se existe um rascunho ativo recente
 */
export function hasActiveDraftFast(): boolean {
  try {
    const rawMeta = localStorage.getItem(DRAFT_STORAGE_KEY + '_meta');
    if (!rawMeta) return false;
    const meta = JSON.parse(rawMeta);
    if (!meta || !meta.updatedAt) return false;
    const isExpired = Date.now() - meta.updatedAt > 48 * 60 * 60 * 1000;
    if (isExpired) return false;
    return Boolean(meta.isOpen || meta.fotosCount > 0);
  } catch {
    return false;
  }
}
