/**
 * Utilitário para detecção e conversão transparente de formatos como HEIC/HEIF para JPEG.
 * Garante que fotos tiradas em iPhones ou aparelhos Samsung com modo de alta eficiência
 * sejam compatíveis com todos os navegadores desktop e mobile.
 */

export function isHeicFile(file: { type?: string; name?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    type.includes('heic') ||
    type.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export function isHeicDataUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('data:image/heic') || url.startsWith('data:image/heif');
}

/**
 * Carrega a biblioteca heic2any sob demanda caso necessário.
 * Tenta primeiro o arquivo local em /libs/heic2any.min.js (suporta offline/PWA),
 * com fallback para CDN.
 */
export async function loadHeic2Any(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).heic2any) return (window as any).heic2any;

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-heic2any="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).heic2any));
      existing.addEventListener('error', () => reject(new Error('Erro ao carregar heic2any')));
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-heic2any', 'true');
    script.src = '/libs/heic2any.min.js';
    script.async = true;

    script.onload = () => {
      resolve((window as any).heic2any);
    };

    script.onerror = () => {
      // Fallback para CDN caso o arquivo local não esteja acessível
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      cdnScript.onload = () => resolve((window as any).heic2any);
      cdnScript.onerror = () => reject(new Error('Falha ao carregar conversor HEIC local e CDN'));
      document.head.appendChild(cdnScript);
    };

    document.head.appendChild(script);
  });
}

/**
 * Converte um arquivo ou Blob HEIC para JPEG.
 */
export async function convertHeicToJpeg(fileOrBlob: Blob | File): Promise<Blob> {
  const heic2any = await loadHeic2Any();
  if (!heic2any) {
    throw new Error('Conversor HEIC não disponível no ambiente');
  }

  const result = await heic2any({
    blob: fileOrBlob,
    toType: 'image/jpeg',
    quality: 0.85
  });

  return Array.isArray(result) ? result[0] : result;
}

/**
 * Converte uma string data:image/heic;base64,... para data:image/jpeg;base64,...
 */
export async function convertHeicBase64ToJpeg(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const convertedBlob = await convertHeicToJpeg(blob);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(convertedBlob);
  });
}
