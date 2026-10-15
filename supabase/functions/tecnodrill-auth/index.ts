import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const fields = 'id,nome,perfil,email,username,ativo,trocar_senha_primeiro_acesso';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const authEmail = (id: string) => `${id}@login.tecnodrill.internal`;

// Import a legacy account without exposing its hash or changing its password/ID.
async function ensureAuth(profile: { id: string; senha_hash: string }) {
  const { data } = await admin.auth.admin.getUserById(profile.id);
  if (data.user) return;
  const { error } = await admin.auth.admin.createUser({
    id: profile.id,
    email: authEmail(profile.id),
    password_hash: profile.senha_hash,
    email_confirm: true,
    app_metadata: { application: 'tecnodrill' }
  });
  if (error) throw new Error('Não foi possível preparar o acesso seguro.');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
  try {
    const input = await req.json();
    if (input.action === 'login') {
      const identifier = String(input.identifier || '').trim();
      const password = String(input.password || '');
      if (!identifier || identifier.length > 200 || !password || password.length > 512) return reply({ error: 'Usuário ou senha inválidos.' }, 401);
      // Separate eq filters avoid interpolation into a PostgREST OR expression.
      const escaped = identifier.replace(/[\\%_]/g, '\\$&');
      let { data: profile } = await admin.from('tecnodrill_usuarios').select('*').ilike('username', escaped).maybeSingle();
      if (!profile && identifier.includes('@')) {
        ({ data: profile } = await admin.from('tecnodrill_usuarios').select('*').ilike('email', escaped).maybeSingle());
      }
      if (!profile?.ativo) return reply({ error: 'Usuário ou senha inválidos.' }, 401);
      await ensureAuth(profile);
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signInWithPassword({ email: authEmail(profile.id), password });
      if (error || !data.session) return reply({ error: 'Usuário ou senha inválidos.' }, 401);
      const { data: safe } = await admin.from('tecnodrill_usuarios').select(fields).eq('id', profile.id).single();
      return reply({ session: data.session, usuario: safe });
    }

    // Every management action verifies the JWT and reads current privileges in DB.
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply({ error: 'Entre novamente para continuar.' }, 401);
    const { data: caller } = await admin.from('tecnodrill_usuarios').select('id,perfil,ativo').eq('id', user.id).single();
    if (!caller?.ativo || !['ADMIN', 'GESTOR'].includes(caller.perfil)) return reply({ error: 'Acesso restrito à gestão.' }, 403);
    if (!['create', 'update', 'delete'].includes(input.action)) return reply({ error: 'Ação inválida.' }, 400);
    const payload = input.data || {};
    const id = input.action === 'create' ? crypto.randomUUID() : String(input.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: 'Usuário inválido.' }, 400);
    if (id === user.id && (input.action === 'delete' || payload.ativo === false || (payload.perfil && payload.perfil !== caller.perfil))) {
      return reply({ error: 'Você não pode remover seu próprio acesso de gestão.' }, 400);
    }
    if (input.action === 'delete') {
      // Keep authored records intact. Deactivate the account instead of cascading data.
      const { error } = await admin.from('tecnodrill_usuarios').update({ ativo: false }).eq('id', id);
      if (error) throw error;
      return reply({ success: true, message: 'Usuário desativado; registros preservados.' });
    }
    const changes: Record<string, unknown> = {};
    for (const field of ['nome', 'username', 'email', 'perfil', 'ativo', 'trocar_senha_primeiro_acesso']) {
      if (payload[field] !== undefined) changes[field] = payload[field];
    }
    if (changes.perfil && !['ADMIN', 'GESTOR', 'OPERADOR', 'NAVEGADOR'].includes(String(changes.perfil))) return reply({ error: 'Perfil inválido.' }, 400);
    const password = payload.senha ? String(payload.senha) : '';
    if (password && password.length < 6) return reply({ error: 'A senha deve possuir pelo menos 6 caracteres.' }, 400);
    if (input.action === 'create') {
      if (!password || !changes.nome || !changes.username || !changes.perfil) return reply({ error: 'Preencha nome, usuário, perfil e senha.' }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({ id, email: authEmail(id), password, email_confirm: true, app_metadata: { application: 'tecnodrill' } });
      if (error || !created.user) throw new Error('Não foi possível criar o acesso.');
      // Auth stores the real password hash; the legacy column is no longer used.
      const { data, error: insertError } = await admin.from('tecnodrill_usuarios').insert({ ...changes, id, senha_hash: 'AUTH_MANAGED', ativo: changes.ativo ?? true, trocar_senha_primeiro_acesso: true }).select(fields).single();
      if (insertError) { await admin.auth.admin.deleteUser(id); throw insertError; }
      return reply(data);
    }
    const { data: existing } = await admin.from('tecnodrill_usuarios').select('*').eq('id', id).single();
    if (!existing) return reply({ error: 'Usuário não encontrado.' }, 404);
    if (password) {
      await ensureAuth(existing);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      changes.trocar_senha_primeiro_acesso = true;
    }
    const { data, error } = await admin.from('tecnodrill_usuarios').update(changes).eq('id', id).select(fields).single();
    if (error) throw error;
    return reply(data);
  } catch {
    return reply({ error: 'Não foi possível concluir a operação de acesso.' }, 400);
  }
});
