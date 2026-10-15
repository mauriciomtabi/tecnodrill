import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requestAuth } from './database/requestAuth';

/** Legacy reports/admin routes must not bypass the database's new ownership RLS. */
export async function requireManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) { res.status(401).json({ error: 'Autenticação necessária.' }); return; }
  try {
    const client = createClient(
      process.env.SUPABASE_URL || 'https://dkscchjzztwyjzjpllob.supabase.co',
      'sb_publishable_vAiCBdEioA9vqF6dzHjADQ_TkVsFWuj',
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) { res.status(401).json({ error: 'Sessão inválida.' }); return; }
    const { data: profile } = await client.from('tecnodrill_usuarios').select('perfil,ativo').eq('id', user.id).single();
    if (!profile?.ativo || !['GESTOR', 'ADMIN'].includes(profile.perfil)) {
      res.status(403).json({ error: 'Esta API é restrita à gestão. Técnicos utilizam as consultas protegidas por autoria.' }); return;
    }
    requestAuth.run(token, next);
  } catch { res.status(401).json({ error: 'Não foi possível validar a sessão.' }); }
}
