import { supabase, SUPABASE_URL } from './supabaseClient';
import type { Barra } from '../types';

const prefix = `${SUPABASE_URL}/storage/v1/object/public/tecnodrill-fotos/`;

/** Sign only paths whose access is authorized by the current user's Storage RLS. */
export async function withPrivatePhotos(registros: Barra[]): Promise<Barra[]> {
  const urls = [...new Set(registros.flatMap(b => [b.foto_url || '', ...(b.fotos || [])]).filter(url => url.startsWith(prefix)))];
  if (!urls.length) return registros;
  const paths = urls.map(url => decodeURIComponent(url.slice(prefix.length)));
  const { data, error } = await supabase.storage.from('tecnodrill-fotos').createSignedUrls(paths, 300);
  const signed = new Map(urls.map((url, index) => [url, error ? '' : (data?.[index]?.signedUrl || '')]));
  return registros.map(b => ({
    ...b,
    foto_url: signed.get(b.foto_url || '') ?? b.foto_url,
    fotos: b.fotos?.map(url => signed.get(url) ?? url).filter(Boolean)
  }));
}
