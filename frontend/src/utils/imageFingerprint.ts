/**
 * Utilitário de Impressão Digital Perceptual e Prevenção de Fotos Duplicadas
 * 
 * Detecta fotos duplicadas no mesmo registro de apontamento, mesmo que:
 * 1. Uma foto tenha sido recuperada do rascunho com carimbo/marca d'água e a nova seja crua.
 * 2. O operador selecione a mesma foto duas vezes pela galeria ou em arquivos copiados.
 * 3. O operador tire duas fotos consecutivas do mesmo ponto sem mudar de ângulo.
 * 4. Haja diferenças sutis de compressão JPEG ou metadados EXIF.
 */

// Cache de fingerprints computados em memória para resposta instantânea (0ms)
const fingerprintCache = new Map<string, Float32Array>();

/**
 * Gera uma chave de cache curta e segura para a imagem (baseada no tamanho e fatias da base64)
 */
function getCacheKey(src: string): string {
  if (src.length < 500) return src;
  return `${src.length}_${src.slice(50, 150)}_${src.slice(-100)}`;
}

/**
 * Computa uma assinatura visual perceptual (16x16 em escala de cinza normalizada).
 * Foca nos 70% centrais da imagem, ignorando o cabeçalho e rodapé onde são aplicados
 * os carimbos da TecnoDrill (logo no topo, GPS/data no rodapé).
 */
export async function computeImageFingerprint(src: string): Promise<Float32Array | null> {
  if (!src) return null;

  const cacheKey = getCacheKey(src);
  const cached = fingerprintCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result: Float32Array | null) => {
      if (!resolved) {
        resolved = true;
        if (result) {
          // Limita tamanho do cache em 100 itens para economizar memória
          if (fingerprintCache.size > 100) {
            const firstKey = fingerprintCache.keys().next().value;
            if (firstKey) fingerprintCache.delete(firstKey);
          }
          fingerprintCache.set(cacheKey, result);
        }
        resolve(result);
      }
    };

    // Trava de segurança: máximo 1.8 segundos
    const timer = setTimeout(() => {
      finish(null);
    }, 1800);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width || 100;
        const h = img.naturalHeight || img.height || 100;

        // Recorta área central (15% margem superior e inferior para excluir carimbos da TecnoDrill)
        const cropX = Math.round(w * 0.10);
        const cropY = Math.round(h * 0.15);
        const cropW = Math.max(10, Math.round(w * 0.80));
        const cropH = Math.max(10, Math.round(h * 0.70));

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          return finish(null);
        }

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 16, 16);
        const imgData = ctx.getImageData(0, 0, 16, 16).data;

        // Limpa canvas
        canvas.width = 1;
        canvas.height = 1;

        const grayscale = new Float32Array(256);
        let sum = 0;
        let p = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          // Luminância ITU-R BT.601
          const gray = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
          grayscale[p] = gray;
          sum += gray;
          p++;
        }

        // Normalização estatística (Z-Score)
        const mean = sum / 256;
        let variance = 0;
        for (let i = 0; i < 256; i++) {
          const diff = grayscale[i] - mean;
          variance += diff * diff;
        }
        const std = Math.sqrt(variance / 256) || 1;

        const normalized = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          normalized[i] = (grayscale[i] - mean) / std;
        }

        finish(normalized);
      } catch (err) {
        console.warn('[computeImageFingerprint] Erro no processamento canvas:', err);
        finish(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };

    img.src = src;
  });
}

/**
 * Calcula a correlação de Pearson entre dois fingerprints (-1.0 a +1.0)
 */
export function compareFingerprints(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length !== 256 || b.length !== 256) return 0;
  let dotProduct = 0;
  for (let i = 0; i < 256; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct / 256;
}

/**
 * Verifica se a foto candidata é duplicada em relação à lista de fotos existentes
 * Retorna true se for idêntica ou se o coeficiente de similaridade visual for >= threshold (padrão 0.82)
 */
export async function checkIsDuplicatePhoto(
  candidate: string,
  existingList: string[],
  threshold: number = 0.82
): Promise<{ isDuplicate: boolean; duplicateIndex: number; similarity: number }> {
  if (!candidate || !existingList || existingList.length === 0) {
    return { isDuplicate: false, duplicateIndex: -1, similarity: 0 };
  }

  // 1. Verificação ultra-rápida de igualdade de string exata
  const exactIdx = existingList.indexOf(candidate);
  if (exactIdx !== -1) {
    return { isDuplicate: true, duplicateIndex: exactIdx, similarity: 1.0 };
  }

  // 2. Verificação de tamanho e fatias da base64
  const candLen = candidate.length;
  const candHead = candidate.slice(0, 400);
  const candTail = candidate.slice(-200);

  for (let i = 0; i < existingList.length; i++) {
    const existing = existingList[i];
    if (existing === candidate) {
      return { isDuplicate: true, duplicateIndex: i, similarity: 1.0 };
    }
    // Se o tamanho da string for idêntico e o cabeçalho coincidir
    if (existing.length === candLen && existing.slice(0, 400) === candHead && existing.slice(-200) === candTail) {
      return { isDuplicate: true, duplicateIndex: i, similarity: 1.0 };
    }
  }

  // 3. Verificação perceptual visual profunda (compara cena excluindo carimbos)
  const candidateFp = await computeImageFingerprint(candidate);
  if (!candidateFp) {
    return { isDuplicate: false, duplicateIndex: -1, similarity: 0 };
  }

  let maxSimilarity = 0;
  let maxIdx = -1;

  for (let i = 0; i < existingList.length; i++) {
    const existingFp = await computeImageFingerprint(existingList[i]);
    if (existingFp) {
      const similarity = compareFingerprints(candidateFp, existingFp);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIdx = i;
      }
      if (similarity >= threshold) {
        return { isDuplicate: true, duplicateIndex: i, similarity };
      }
    }
  }

  return { isDuplicate: false, duplicateIndex: maxIdx, similarity: maxSimilarity };
}

/**
 * Remove fotos duplicadas de uma lista de imagens (usado ao recuperar rascunhos)
 */
export async function deduplicatePhotoList(photos: string[], threshold: number = 0.82): Promise<string[]> {
  if (!photos || photos.length <= 1) return photos || [];

  const uniquePhotos: string[] = [];

  for (const photo of photos) {
    const dupCheck = await checkIsDuplicatePhoto(photo, uniquePhotos, threshold);
    if (!dupCheck.isDuplicate) {
      uniquePhotos.push(photo);
    } else {
      console.warn(`[deduplicatePhotoList] Foto duplicada descartada (similaridade: ${(dupCheck.similarity * 100).toFixed(1)}%)`);
    }
  }

  return uniquePhotos;
}
