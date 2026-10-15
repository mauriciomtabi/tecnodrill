import type { Barra, Usuario } from '../types';

/** UI defense only. RLS enforces ownership before the database sends any data. */
export function canReadRegistro(user: Usuario | null, registro: Pick<Barra, 'registrado_por'>): boolean {
  if (!user?.ativo || !user.id) return false;
  if (user.perfil === 'ADMIN' || user.perfil === 'GESTOR') return true;
  if (user.perfil !== 'OPERADOR' && user.perfil !== 'NAVEGADOR') return false;
  return registro.registrado_por === user.id;
}
