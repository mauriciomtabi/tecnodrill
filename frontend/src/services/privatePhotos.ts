import type { Barra } from '../types';

/**
 * Normaliza os registros com fotos.
 * O bucket 'tecnodrill-fotos' é público para entrega via CDN, garantindo
 * carregamento imediato, sem expiração de token e com alta performance.
 */
export async function withPrivatePhotos(registros: Barra[]): Promise<Barra[]> {
  return registros.map(b => {
    const allFotos = b.fotos && b.fotos.length > 0 
      ? b.fotos.filter(Boolean) 
      : (b.foto_url ? [b.foto_url] : []);
    return {
      ...b,
      foto_url: b.foto_url || (allFotos.length > 0 ? allFotos[0] : undefined),
      fotos: allFotos
    };
  });
}

