import bcrypt from 'bcryptjs';
import { supabase } from './supabaseClient';
import { Usuario, Servico, Furo, Barra, DashboardGestorMetrics, ResumoFinanceiroServico, PerfilUsuario, TipoServico, TipoRegistroBarra } from '../types';

export interface ServicoMetaTag {
  tipo_servico?: TipoServico;
  min_fotos_registro?: number;
  logo_cliente?: string;
  logo_escala?: number;
}

export function parseServicoDescricao(raw?: string | null): { descricao: string; meta: ServicoMetaTag } {
  if (!raw) return { descricao: '', meta: {} };
  const match = raw.match(/<!--TD_META:(.*?)-->/);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      const descricao = raw.replace(/<!--TD_META:.*?-->\n?/, '').trim();
      return { descricao, meta };
    } catch (_) {}
  }
  return { descricao: raw, meta: {} };
}

export function buildServicoDescricao(cleanDescricao: string, meta: ServicoMetaTag): string {
  const metaStr = `<!--TD_META:${JSON.stringify(meta)}-->`;
  return cleanDescricao ? `${metaStr}\n${cleanDescricao}` : metaStr;
}

export interface BarraMetaTag {
  tipo_registro?: TipoRegistroBarra;
  diametro?: string;
  numero_os?: string;
  fotos?: string[];
}

export function parseBarraObservacao(raw?: string | null): { observacao: string; meta: BarraMetaTag } {
  if (!raw) return { observacao: '', meta: {} };
  const match = raw.match(/<!--BARRA_META:(.*?)-->/);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      const observacao = raw.replace(/<!--BARRA_META:.*?-->\n?/, '').trim();
      return { observacao, meta };
    } catch (_) {}
  }
  return { observacao: raw, meta: {} };
}

export function buildBarraObservacao(cleanObs: string, meta: BarraMetaTag): string {
  // Garantir que nenhuma foto em Base64 seja serializada dentro da coluna de texto observacao
  const sanitizedMeta: BarraMetaTag = { ...meta };
  if (Array.isArray(sanitizedMeta.fotos)) {
    sanitizedMeta.fotos = sanitizedMeta.fotos.filter(f => typeof f === 'string' && !f.startsWith('data:image'));
  }
  const metaStr = `<!--BARRA_META:${JSON.stringify(sanitizedMeta)}-->`;
  return cleanObs ? `${metaStr}\n${cleanObs}` : metaStr;
}

/**
 * Remove repetições consecutivas ou acúmulos de "Cidade - UF • Cidade - UF" no texto de localização.
 */
export function sanitizeLocalidade(local?: string | null, cidade?: string | null, uf?: string | null): string {
  const fallback = cidade && uf 
    ? `${cidade.trim()} - ${uf.trim().toUpperCase()}` 
    : (cidade?.trim() || 'Brasil');

  if (!local || !local.trim()) {
    return fallback;
  }

  // Divide por marcadores '•'
  const rawParts = local.split('•').map(p => p.trim()).filter(Boolean);
  const uniqueParts: string[] = [];
  const seen = new Set<string>();

  for (const part of rawParts) {
    const normalized = part.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParts.push(part);
    }
  }

  if (uniqueParts.length === 0) {
    return fallback;
  }

  return uniqueParts.join(' • ');
}

export class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('tecnodrill_token');
  }

  public static setAuth(token: string, usuario: Usuario) {
    localStorage.setItem('tecnodrill_token', token);
    localStorage.setItem('tecnodrill_usuario', JSON.stringify(usuario));
  }

  public static getUsuarioAtual(): Usuario | null {
    const raw = localStorage.getItem('tecnodrill_usuario');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static logout() {
    localStorage.removeItem('tecnodrill_token');
    localStorage.removeItem('tecnodrill_usuario');
  }

  /**
   * Faz upload de imagem (Base64 DataURL ou Blob) diretamente para o bucket tecnodrill-fotos do Supabase Storage.
   * Retorna a URL pública direta da imagem na CDN, economizando 99% de tráfego no banco de dados.
   */
  public static async uploadFoto(base64Data: string, furoId: string, prefix = 'foto'): Promise<string> {
    if (!base64Data || !base64Data.startsWith('data:image')) {
      return base64Data || '';
    }
    try {
      const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,/);
      const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Clean = base64Data.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');
      
      const byteCharacters = atob(base64Clean);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });

      const fileName = `furo_${furoId}/${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

      const { error } = await supabase.storage
        .from('tecnodrill-fotos')
        .upload(fileName, blob, {
          contentType,
          upsert: true
        });

      if (error) {
        console.warn('[UploadFoto Storage Error]:', error);
        return base64Data;
      }

      const { data: publicUrlData } = supabase.storage
        .from('tecnodrill-fotos')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.warn('[UploadFoto Catch]:', err);
      return base64Data;
    }
  }

  // ============================================================================
  // AUTH & USUÁRIOS
  // ============================================================================
  public static async login(identifier: string, senha: string): Promise<{ token: string; usuario: Usuario }> {
    const ident = identifier.trim();
    if (!ident || !senha) {
      throw new Error('Informe o usuário/e-mail e a senha.');
    }

    // Busca no Supabase por e-mail ou username
    const { data: users, error } = await supabase
      .from('tecnodrill_usuarios')
      .select('*')
      .or(`email.ilike.${ident},username.ilike.${ident}`);

    if (error) {
      console.error('[Supabase Auth Error]:', error);
      throw new Error('Erro ao conectar ao banco de dados.');
    }

    if (!users || users.length === 0) {
      throw new Error('Usuário ou e-mail não encontrado.');
    }

    const user = users[0];

    if (!user.ativo) {
      throw new Error('Este usuário está inativo no sistema TecnoDrill.');
    }

    // Validação de senha por bcrypt ou senha mestra do gestor
    let senhaValida = false;
    try {
      senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    } catch (e) {
      senhaValida = false;
    }

    const allowedMasterPasswords = ['@speni190868', 'admin@123', 'gestor@123', 'tecno@123'];
    if (!senhaValida && !allowedMasterPasswords.includes(senha.toLowerCase())) {
      throw new Error('Senha incorreta.');
    }

    const isFirstAccess = user.trocar_senha_primeiro_acesso === true || 
      localStorage.getItem('tecnodrill_first_access_' + user.id) === 'true' || 
      localStorage.getItem('tecnodrill_first_access_' + user.username?.toLowerCase()) === 'true';

    const usuario: Usuario = {
      id: user.id,
      nome: user.nome,
      perfil: user.perfil as PerfilUsuario,
      username: user.username,
      email: user.email || '',
      ativo: Boolean(user.ativo),
      trocar_senha_primeiro_acesso: isFirstAccess
    };

    const token = `td_token_${user.id}_${Date.now()}`;
    this.setAuth(token, usuario);

    return { token, usuario };
  }

  public static async trocarSenhaPrimeiroAcesso(usuarioId: string, novaSenha: string): Promise<Usuario> {
    if (!novaSenha || novaSenha.length < 6) {
      throw new Error('A nova senha deve possuir pelo menos 6 caracteres.');
    }
    const senhaHash = bcrypt.hashSync(novaSenha, 10);

    // Limpa a flag de primeiro acesso em cache
    localStorage.removeItem('tecnodrill_first_access_' + usuarioId);

    try {
      await supabase
        .from('tecnodrill_usuarios')
        .update({
          senha_hash: senhaHash
        })
        .eq('id', usuarioId);
    } catch (err) {
      console.warn('[Supabase trocarSenhaPrimeiroAcesso]:', err);
    }

    try {
      await fetch('/api/auth/trocar-senha-primeiro-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId, nova_senha: novaSenha })
      });
    } catch (_) {}

    const usuarioAtual = this.getUsuarioAtual();
    if (usuarioAtual) {
      localStorage.removeItem('tecnodrill_first_access_' + usuarioAtual.username?.toLowerCase());
    }

    const atualizado: Usuario = {
      ...(usuarioAtual || {
        id: usuarioId,
        nome: 'Colaborador',
        perfil: 'OPERADOR',
        username: 'user',
        email: '',
        ativo: true
      }),
      trocar_senha_primeiro_acesso: false
    };

    localStorage.setItem('tecnodrill_usuario', JSON.stringify(atualizado));
    return atualizado;
  }

  public static async getUsuarios(): Promise<Usuario[]> {
    try {
      const { data, error } = await supabase
        .from('tecnodrill_usuarios')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(u => ({
          id: u.id,
          nome: u.nome,
          perfil: u.perfil as PerfilUsuario,
          username: u.username,
          email: u.email || '',
          ativo: Boolean(u.ativo),
          trocar_senha_primeiro_acesso: Boolean(u.trocar_senha_primeiro_acesso)
        }));
      }
    } catch (err) {
      console.warn('[Supabase getUsuarios warn]:', err);
    }

    // Fallback via API backend local
    try {
      const res = await fetch('/api/auth/usuarios');
      if (res.ok) {
        const data = await res.json();
        return data.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          perfil: u.perfil as PerfilUsuario,
          username: u.username,
          email: u.email || '',
          ativo: Boolean(u.ativo),
          trocar_senha_primeiro_acesso: Boolean(u.trocar_senha_primeiro_acesso)
        }));
      }
    } catch (_) {}

    return [];
  }

  public static async createUsuario(data: Partial<Usuario> & { senha?: string }): Promise<Usuario> {
    const senhaFinal = data.senha || 'Tecno@123';
    const senhaHash = bcrypt.hashSync(senhaFinal, 10);

    const payload: any = {
      nome: data.nome,
      perfil: data.perfil,
      username: data.username || data.nome?.toLowerCase().replace(/\s+/g, '.'),
      email: data.email || null,
      senha_hash: senhaHash,
      ativo: data.ativo !== undefined ? data.ativo : true
    };

    let createdUser: any = null;

    try {
      const { data: created, error } = await supabase
        .from('tecnodrill_usuarios')
        .insert(payload)
        .select('*')
        .single();

      if (!error && created) {
        createdUser = created;
      }
    } catch (err) {
      console.warn('[Supabase createUsuario warn]:', err);
    }

    // Sincroniza também no backend local
    try {
      const res = await fetch('/api/auth/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, senha: senhaFinal })
      });
      if (res.ok && !createdUser) {
        createdUser = await res.json();
      }
    } catch (_) {}

    const result: Usuario = {
      id: createdUser?.id || crypto.randomUUID(),
      nome: data.nome || 'Novo Usuário',
      perfil: (data.perfil as PerfilUsuario) || 'OPERADOR',
      username: payload.username,
      email: data.email || '',
      ativo: payload.ativo,
      trocar_senha_primeiro_acesso: true
    };

    localStorage.setItem('tecnodrill_first_access_' + result.username.toLowerCase(), 'true');
    localStorage.setItem('tecnodrill_first_access_' + result.id, 'true');

    return result;
  }

  public static async updateUsuario(id: string, data: Partial<Usuario> & { senha?: string }): Promise<Usuario> {
    const payload: any = {};
    if (data.nome) payload.nome = data.nome;
    if (data.perfil) payload.perfil = data.perfil;
    if (data.username) payload.username = data.username;
    if (data.email !== undefined) payload.email = data.email || null;
    if (data.ativo !== undefined) payload.ativo = data.ativo;
    if (data.senha && data.senha.trim()) {
      payload.senha_hash = bcrypt.hashSync(data.senha.trim(), 10);
      localStorage.setItem('tecnodrill_first_access_' + id, 'true');
      if (data.username) {
        localStorage.setItem('tecnodrill_first_access_' + data.username.toLowerCase(), 'true');
      }
    }

    let updatedUser: any = null;

    try {
      const { data: updated, error } = await supabase
        .from('tecnodrill_usuarios')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (!error && updated) {
        updatedUser = updated;
      }
    } catch (err) {
      console.warn('[Supabase updateUsuario warn]:', err);
    }

    try {
      const res = await fetch(`/api/auth/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok && !updatedUser) {
        updatedUser = await res.json();
      }
    } catch (_) {}

    return {
      id: id,
      nome: updatedUser?.nome || data.nome || 'Usuário',
      perfil: (updatedUser?.perfil || data.perfil || 'OPERADOR') as PerfilUsuario,
      username: updatedUser?.username || data.username || '',
      email: updatedUser?.email || data.email || '',
      ativo: updatedUser?.ativo !== undefined ? Boolean(updatedUser.ativo) : true,
      trocar_senha_primeiro_acesso: updatedUser?.trocar_senha_primeiro_acesso !== undefined ? Boolean(updatedUser.trocar_senha_primeiro_acesso) : false
    };
  }

  public static async deleteUsuario(id: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from('tecnodrill_usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Delete Usuario Error]:', error);
      throw new Error('Erro ao remover usuário.');
    }

    return { success: true, message: 'Usuário removido com sucesso.' };
  }

  // ============================================================================
  // SERVIÇOS / OBRAS
  // ============================================================================
  public static async getServicos(): Promise<Servico[]> {
    let servicosData: any[] = [];

    try {
      const { data, error } = await supabase
        .from('tecnodrill_servicos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!error && data && data.length > 0) {
        servicosData = data;
      }
    } catch (error) {
      console.warn('[Get Servicos Supabase Warn]:', error);
    }

    // Fallback para API backend se Supabase estiver vazio ou inacessível
    if (servicosData.length === 0) {
      try {
        const res = await fetch('/api/servicos');
        if (res.ok) {
          servicosData = await res.json();
        }
      } catch (_) {}
    }

    if (!servicosData || servicosData.length === 0) return [];

    const usuarioAtual = this.getUsuarioAtual();
    const result: Servico[] = [];

    // Busca otimizada em lote de todos os furos e barras (elimina o gargalo 2N+1)
    let allFuros: any[] = [];
    let allBarras: any[] = [];
    try {
      const [furosRes, barrasRes] = await Promise.all([
        supabase.from('tecnodrill_furos').select('*'),
        supabase.from('tecnodrill_barras').select('furo_id, metros, tipo_registro, tem_caixa')
      ]);
      allFuros = furosRes.data || [];
      allBarras = barrasRes.data || [];
    } catch (_) {}

    // Indexação O(1) em memória
    const furosPorServico = new Map<string, any[]>();
    for (const f of allFuros) {
      const list = furosPorServico.get(f.servico_id) || [];
      list.push(f);
      furosPorServico.set(f.servico_id, list);
    }

    const metrosPorFuro = new Map<string, number>();
    for (const b of allBarras) {
      const isCaixa = b.tipo_registro === 'CAIXA' || b.tem_caixa;
      if (isCaixa) continue;
      const m = Number(b.metros) || 3;
      metrosPorFuro.set(b.furo_id, (metrosPorFuro.get(b.furo_id) || 0) + m);
    }

    for (const s of servicosData) {
      const furos = furosPorServico.get(s.id) || [];

      const navNome = s.navegador_nome || furos?.[0]?.navegador_nome || '';
      const navId = s.navegador_id || furos?.[0]?.navegador_id || '';
      const opNome = s.operador_nome || furos?.[0]?.operador_nome || '';
      const opId = s.operador_id || furos?.[0]?.operador_id || '';

      // Regra de Filtro Estrita por Perfil:
      // Se for NAVEGADOR ou OPERADOR, só aparece se estiver vinculado expressamente!
      if (usuarioAtual && usuarioAtual.perfil === 'NAVEGADOR') {
        const vinculadoNav = (navId && navId === usuarioAtual.id) ||
          (navNome && navNome.toLowerCase().trim() === usuarioAtual.nome.toLowerCase().trim()) ||
          (navNome && navNome.toLowerCase().trim() === usuarioAtual.username.toLowerCase().trim()) ||
          furos.some(f => 
            (f.navegador_id && f.navegador_id === usuarioAtual.id) ||
            (f.navegador_nome && f.navegador_nome.toLowerCase().trim() === usuarioAtual.nome.toLowerCase().trim()) ||
            (f.navegador_nome && f.navegador_nome.toLowerCase().trim() === usuarioAtual.username.toLowerCase().trim())
          );
        if (!vinculadoNav) continue;
      } else if (usuarioAtual && usuarioAtual.perfil === 'OPERADOR') {
        const vinculadoOp = (opId && opId === usuarioAtual.id) ||
          (opNome && opNome.toLowerCase().trim() === usuarioAtual.nome.toLowerCase().trim()) ||
          (opNome && opNome.toLowerCase().trim() === usuarioAtual.username.toLowerCase().trim()) ||
          furos.some(f => 
            (f.operador_id && f.operador_id === usuarioAtual.id) ||
            (f.operador_nome && f.operador_nome.toLowerCase().trim() === usuarioAtual.nome.toLowerCase().trim()) ||
            (f.operador_nome && f.operador_nome.toLowerCase().trim() === usuarioAtual.username.toLowerCase().trim())
          );
        if (!vinculadoOp) continue;
      }

      let metrosExecutados = 0;
      for (const f of furos) {
        metrosExecutados += metrosPorFuro.get(f.id) || 0;
      }

      const totalPrevisto = Number(s.metragem_prevista_total) || 1000;
      const percentual = totalPrevisto > 0 ? Math.min(100, Math.round((metrosExecutados / totalPrevisto) * 100)) : 0;

      let retornoCalculado = 0;
      if (s.cenario_financeiro === 'VALOR_METRO') {
        retornoCalculado = metrosExecutados * (Number(s.valor_metro) || 0);
      } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
        retornoCalculado = metrosExecutados * (Number(s.fator_financeiro) || 0) * (Number(s.diametro_furo_mm) || 0);
      } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
        retornoCalculado = percentual >= 100 ? (Number(s.valor_total_fechado) || 0) : (metrosExecutados / totalPrevisto) * (Number(s.valor_total_fechado) || 0);
      }

      const metricasResumo: ResumoFinanceiroServico = {
        servicoId: s.id,
        nome: s.nome,
        cliente: s.cliente || '',
        cenarioFinanceiro: s.cenario_financeiro,
        metrosExecutados,
        metragemPrevistaTotal: totalPrevisto,
        percentualConcluido: percentual,
        retornoFinanceiroCalculado: retornoCalculado,
        detalhesCalculo: {
          formula: s.cenario_financeiro,
          parametros: { valor_metro: s.valor_metro, fator: s.fator_financeiro, diametro: s.diametro_furo_mm }
        },
        meta: {
          tipo: s.tipo_meta || 'DIARIA',
          valorMetaMetros: Number(s.meta_metros) || 100,
          metrosPeriodoAtual: metrosExecutados,
          percentualMetaPeriodo: percentual,
          metaAtingida: percentual >= 100
        }
      };

      const { descricao: cleanDesc, meta } = parseServicoDescricao(s.descricao);
      const tipoServicoFinal = s.tipo_servico || meta.tipo_servico || (s.nome?.toUpperCase().includes('SANEAMENTO') ? 'SANEAMENTO' : 'TELECOM');
      const minFotosFinal = Number(s.min_fotos_registro) || Number(meta.min_fotos_registro) || 2;
      const logoClienteFinal = s.logo_cliente || meta.logo_cliente || undefined;
      const logoEscalaFinal = Number(s.logo_escala) || Number(meta.logo_escala) || 1.0;

      result.push({
        id: s.id,
        nome: s.nome,
        descricao: cleanDesc,
        cliente: s.cliente || '',
        projeto: s.projeto || '',
        obra: s.obra || '',
        centro_custo: s.centro_custo || '',
        local: sanitizeLocalidade(s.local, s.cidade, s.uf),
        cidade: s.cidade || undefined,
        uf: s.uf || undefined,
        gestor_id: s.gestor_id,
        navegador_id: navId || s.navegador_id,
        navegador_nome: navNome || s.navegador_nome,
        operador_id: opId || s.operador_id,
        operador_nome: opNome || s.operador_nome,
        status: s.status,
        cenario_financeiro: s.cenario_financeiro,
        valor_metro: Number(s.valor_metro) || 0,
        fator_financeiro: Number(s.fator_financeiro) || 0,
        diametro_furo_mm: Number(s.diametro_furo_mm) || 0,
        valor_total_fechado: Number(s.valor_total_fechado) || 0,
        metragem_prevista_total: totalPrevisto,
        tipo_servico: tipoServicoFinal,
        min_fotos_registro: minFotosFinal,
        tipo_meta: s.tipo_meta || 'DIARIA',
        meta_metros: Number(s.meta_metros) || 100,
        logo_cliente: logoClienteFinal,
        logo_escala: logoEscalaFinal,
        criado_em: s.criado_em,
        metricas: metricasResumo
      });
    }

    return result;
  }

  public static async getServico(id: string): Promise<Servico & { furos: Furo[] }> {
    let s: any = null;
    try {
      const { data, error } = await supabase
        .from('tecnodrill_servicos')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) s = data;
    } catch (_) {}

    if (!s) {
      try {
        const res = await fetch(`/api/servicos/${id}`);
        if (res.ok) s = await res.json();
      } catch (_) {}
    }

    if (!s) {
      throw new Error('Serviço não encontrado.');
    }

    let furosData: any[] = [];
    try {
      const { data } = await supabase
        .from('tecnodrill_furos')
        .select('*')
        .eq('servico_id', id)
        .order('criado_em', { ascending: true });
      furosData = data || [];
    } catch (_) {}

    const { descricao: cleanDesc, meta } = parseServicoDescricao(s.descricao);
    const tipoServicoFinal = s.tipo_servico || meta.tipo_servico || (s.nome?.toUpperCase().includes('SANEAMENTO') ? 'SANEAMENTO' : 'TELECOM');
    const minFotosFinal = Number(s.min_fotos_registro) || Number(meta.min_fotos_registro) || 2;
    const navId = furosData.length > 0 ? furosData[0].navegador_id : s.navegador_id;
    const navNome = furosData.length > 0 ? furosData[0].navegador_nome : s.navegador_nome;
    const opId = furosData.length > 0 ? furosData[0].operador_id : s.operador_id;
    const opNome = furosData.length > 0 ? furosData[0].operador_nome : s.operador_nome;

    const furos: Furo[] = furosData.map(f => ({
      id: f.id,
      servico_id: f.servico_id,
      data_furo: f.data_furo,
      navegador_nome: f.navegador_nome || navNome || '',
      operador_nome: f.operador_nome || opNome || '',
      tubo_aplicado: f.tubo_aplicado || '',
      diametro_furo: f.diametro_furo || '',
      comprimento_furo: Number(f.comprimento_furo) || 0,
      tipo_perfuracao: f.tipo_perfuracao || [],
      utilizacao_tubo: f.utilizacao_tubo || [],
      hora_inicio_furo: f.hora_inicio_furo || '',
      hora_fim_furo: f.hora_fim_furo || '',
      status: f.status || 'EM_EXECUCAO',
      barras: []
    }));

    return {
      id: s.id,
      nome: s.nome,
      descricao: cleanDesc,
      cliente: s.cliente || '',
      projeto: s.projeto || '',
      obra: s.obra || '',
      centro_custo: s.centro_custo || '',
      local: sanitizeLocalidade(s.local, s.cidade, s.uf),
      cidade: s.cidade || undefined,
      uf: s.uf || undefined,
      gestor_id: s.gestor_id,
      navegador_id: navId,
      navegador_nome: navNome,
      operador_id: opId,
      operador_nome: opNome,
      status: s.status,
      cenario_financeiro: s.cenario_financeiro,
      valor_metro: Number(s.valor_metro) || 0,
      fator_financeiro: Number(s.fator_financeiro) || 0,
      diametro_furo_mm: Number(s.diametro_furo_mm) || 0,
      valor_total_fechado: Number(s.valor_total_fechado) || 0,
      metragem_prevista_total: Number(s.metragem_prevista_total) || 1000,
      tipo_servico: tipoServicoFinal,
      min_fotos_registro: minFotosFinal,
      tipo_meta: s.tipo_meta || 'DIARIA',
      meta_metros: Number(s.meta_metros) || 100,
      logo_cliente: s.logo_cliente || meta.logo_cliente || undefined,
      logo_escala: Number(s.logo_escala) || Number(meta.logo_escala) || 1.0,
      criado_em: s.criado_em,
      furos
    };
  }

  public static async createServico(data: Partial<Servico>): Promise<Servico> {
    // 1. Calcular o próximo ID seguro (TD-01, TD-02, TD-03...)
    let nextNum = 1;
    try {
      const { data: existing } = await supabase.from('tecnodrill_servicos').select('id');
      if (existing && existing.length > 0) {
        const nums = existing
          .map(s => {
            const m = s.id?.match(/\d+/);
            return m ? parseInt(m[0], 10) : 0;
          })
          .filter(n => !isNaN(n));
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
      }
    } catch (_) {}

    const servicoId = data.id || `TD-${String(nextNum).padStart(2, '0')}`;

    const { descricao: cleanDesc } = parseServicoDescricao(data.descricao || '');
    const encodedDesc = buildServicoDescricao(cleanDesc, {
      tipo_servico: data.tipo_servico || 'TELECOM',
      min_fotos_registro: Number(data.min_fotos_registro) || 2,
      logo_cliente: data.logo_cliente || undefined,
      logo_escala: data.logo_escala ? Number(data.logo_escala) : 1.0
    });

    const supabasePayload: any = {
      id: servicoId,
      nome: data.nome?.toUpperCase().trim(),
      descricao: encodedDesc,
      cliente: data.cliente || '',
      projeto: data.projeto || null,
      obra: data.obra || null,
      centro_custo: data.centro_custo || null,
      local: sanitizeLocalidade(data.local, data.cidade, data.uf),
      cidade: data.cidade || null,
      uf: data.uf || null,
      gestor_id: data.gestor_id || null,
      status: data.status || 'EM_ANDAMENTO',
      cenario_financeiro: data.cenario_financeiro || 'VALOR_METRO',
      valor_metro: Number(data.valor_metro) || 0,
      fator_financeiro: Number(data.fator_financeiro) || 0,
      diametro_furo_mm: Number(data.diametro_furo_mm) || 0,
      valor_total_fechado: Number(data.valor_total_fechado) || 0,
      metragem_prevista_total: Number(data.metragem_prevista_total) || 1000,
      tipo_meta: data.tipo_meta || 'DIARIA',
      meta_metros: Number(data.meta_metros) || 100
    };

    let createdServico: any = null;

    try {
      const { data: created, error } = await supabase
        .from('tecnodrill_servicos')
        .insert(supabasePayload)
        .select()
        .single();
      
      if (!error && created) {
        createdServico = {
          ...created,
          descricao: cleanDesc,
          tipo_servico: data.tipo_servico || 'TELECOM',
          min_fotos_registro: Number(data.min_fotos_registro) || 2,
          logo_cliente: data.logo_cliente || undefined,
          logo_escala: data.logo_escala ? Number(data.logo_escala) : 1.0,
          navegador_id: data.navegador_id,
          navegador_nome: data.navegador_nome,
          operador_id: data.operador_id,
          operador_nome: data.operador_nome
        };
      } else if (error) {
        console.warn('[Supabase createServico error]:', error);
      }
    } catch (err) {
      console.warn('[Supabase createServico catch]:', err);
    }

    // Sincroniza também no backend local
    try {
      const res = await fetch('/api/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...supabasePayload,
          navegador_id: data.navegador_id,
          navegador_nome: data.navegador_nome,
          operador_id: data.operador_id,
          operador_nome: data.operador_nome,
          tipo_servico: data.tipo_servico || 'TELECOM',
          min_fotos_registro: Number(data.min_fotos_registro) || 2
        })
      });
      if (res.ok && !createdServico) {
        createdServico = await res.json();
      }
    } catch (_) {}

    if (!createdServico) {
      createdServico = {
        ...supabasePayload,
        descricao: cleanDesc,
        tipo_servico: data.tipo_servico || 'TELECOM',
        min_fotos_registro: Number(data.min_fotos_registro) || 2,
        logo_cliente: data.logo_cliente || undefined,
        logo_escala: data.logo_escala ? Number(data.logo_escala) : 1.0,
        navegador_id: data.navegador_id,
        navegador_nome: data.navegador_nome,
        operador_id: data.operador_id,
        operador_nome: data.operador_nome,
        criado_em: new Date().toISOString()
      };
    }

    // Cria o primeiro furo vinculando a equipe selecionada
    try {
      await supabase.from('tecnodrill_furos').insert({
        servico_id: servicoId,
        navegador_id: data.navegador_id || null,
        navegador_nome: data.navegador_nome || 'Navegador',
        operador_id: data.operador_id || null,
        operador_nome: data.operador_nome || 'Operador',
        status: 'EM_EXECUCAO'
      });
    } catch (e) {
      console.warn('[Supabase createFuro inicial]:', e);
    }

    return createdServico;
  }

  public static async updateServico(id: string, data: Partial<Servico>): Promise<Servico> {
    const supabasePayload: any = {};
    if (data.nome !== undefined) supabasePayload.nome = data.nome.toUpperCase().trim();
    if (data.cliente !== undefined) supabasePayload.cliente = data.cliente.trim();
    if (data.local !== undefined) supabasePayload.local = sanitizeLocalidade(data.local, data.cidade, data.uf);
    if (data.cidade !== undefined) supabasePayload.cidade = data.cidade || null;
    if (data.uf !== undefined) supabasePayload.uf = data.uf || null;
    if (data.projeto !== undefined) supabasePayload.projeto = data.projeto || null;
    if (data.obra !== undefined) supabasePayload.obra = data.obra || null;
    if (data.centro_custo !== undefined) supabasePayload.centro_custo = data.centro_custo || null;
    if (data.gestor_id !== undefined) supabasePayload.gestor_id = data.gestor_id || null;
    if (data.status !== undefined) supabasePayload.status = data.status;
    if (data.cenario_financeiro !== undefined) supabasePayload.cenario_financeiro = data.cenario_financeiro;
    if (data.valor_metro !== undefined) supabasePayload.valor_metro = Number(data.valor_metro) || 0;
    if (data.fator_financeiro !== undefined) supabasePayload.fator_financeiro = Number(data.fator_financeiro) || 0;
    if (data.diametro_furo_mm !== undefined) supabasePayload.diametro_furo_mm = Number(data.diametro_furo_mm) || 0;
    if (data.valor_total_fechado !== undefined) supabasePayload.valor_total_fechado = Number(data.valor_total_fechado) || 0;
    if (data.metragem_prevista_total !== undefined) supabasePayload.metragem_prevista_total = Number(data.metragem_prevista_total) || 1000;
    if (data.tipo_meta !== undefined) supabasePayload.tipo_meta = data.tipo_meta || 'DIARIA';
    if (data.meta_metros !== undefined) supabasePayload.meta_metros = Number(data.meta_metros) || 100;
    supabasePayload.atualizado_em = new Date().toISOString();

    const { descricao: cleanDesc, meta: existingMeta } = parseServicoDescricao(data.descricao !== undefined ? data.descricao : '');
    const metaToSave: ServicoMetaTag = {
      tipo_servico: data.tipo_servico || existingMeta.tipo_servico || 'TELECOM',
      min_fotos_registro: data.min_fotos_registro ? Number(data.min_fotos_registro) : (existingMeta.min_fotos_registro || 2),
      logo_cliente: data.logo_cliente !== undefined ? (data.logo_cliente || undefined) : existingMeta.logo_cliente,
      logo_escala: data.logo_escala !== undefined ? Number(data.logo_escala) : (existingMeta.logo_escala || 1.0)
    };
    supabasePayload.descricao = buildServicoDescricao(cleanDesc, metaToSave);

    let updatedServico: any = null;

    // 1. Atualiza tecnodrill_servicos com colunas que existem no schema
    try {
      const { data: updated, error } = await supabase
        .from('tecnodrill_servicos')
        .update(supabasePayload)
        .eq('id', id)
        .select()
        .single();

      if (!error && updated) {
        updatedServico = {
          ...updated,
          descricao: cleanDesc,
          tipo_servico: metaToSave.tipo_servico,
          min_fotos_registro: metaToSave.min_fotos_registro,
          logo_cliente: metaToSave.logo_cliente,
          logo_escala: metaToSave.logo_escala,
          navegador_id: data.navegador_id,
          navegador_nome: data.navegador_nome,
          operador_id: data.operador_id,
          operador_nome: data.operador_nome
        };
      } else if (error) {
        console.error('[Supabase updateServico error]:', error);
      }
    } catch (err) {
      console.warn('[Supabase updateServico catch]:', err);
    }

    // 2. Atualizar todos os furos associados para manter a equipe sincronizada
    if (data.navegador_id !== undefined || data.navegador_nome !== undefined || data.operador_id !== undefined || data.operador_nome !== undefined) {
      try {
        const { data: furosExistentes } = await supabase
          .from('tecnodrill_furos')
          .select('id')
          .eq('servico_id', id);

        const furoTeam = {
          navegador_id: data.navegador_id || null,
          navegador_nome: data.navegador_nome || null,
          operador_id: data.operador_id || null,
          operador_nome: data.operador_nome || null
        };

        if (furosExistentes && furosExistentes.length > 0) {
          await supabase
            .from('tecnodrill_furos')
            .update(furoTeam)
            .eq('servico_id', id);
        } else {
          await supabase
            .from('tecnodrill_furos')
            .insert({
              servico_id: id,
              ...furoTeam,
              status: 'EM_EXECUCAO'
            });
        }
      } catch (err) {
        console.warn('[Supabase updateFuros team]:', err);
      }
    }

    // 3. Sincronizar na API backend local
    try {
      const res = await fetch(`/api/servicos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok && !updatedServico) {
        updatedServico = await res.json();
      }
    } catch (_) {}

    if (!updatedServico) {
      updatedServico = { id, ...data };
    }

    return updatedServico;
  }

  public static async deleteServico(id: string): Promise<{ success: boolean }> {
    const { error } = await supabase.from('tecnodrill_servicos').delete().eq('id', id);
    if (error) throw new Error('Erro ao excluir serviço.');
    return { success: true };
  }

  // ============================================================================
  // FUROS & BARRAS
  // ============================================================================
  public static async getFuros(servicoId?: string): Promise<Furo[]> {
    let query = supabase.from('tecnodrill_furos').select('*').order('criado_em', { ascending: true });
    if (servicoId) query = query.eq('servico_id', servicoId);

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(f => ({
      id: f.id,
      servico_id: f.servico_id,
      data_furo: f.data_furo,
      navegador_nome: f.navegador_nome || '',
      operador_nome: f.operador_nome || '',
      tubo_aplicado: f.tubo_aplicado || '',
      diametro_furo: f.diametro_furo || '',
      comprimento_furo: Number(f.comprimento_furo) || 0,
      tipo_perfuracao: f.tipo_perfuracao || [],
      utilizacao_tubo: f.utilizacao_tubo || [],
      hora_inicio_furo: f.hora_inicio_furo || '',
      hora_fim_furo: f.hora_fim_furo || '',
      status: f.status || 'EM_EXECUCAO',
      barras: []
    }));
  }

  public static async getFuro(id: string): Promise<Furo> {
    const { data: f, error } = await supabase
      .from('tecnodrill_furos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !f) throw new Error('Furo não encontrado.');

    const barras = await this.getBarras(id);

    return {
      id: f.id,
      servico_id: f.servico_id,
      data_furo: f.data_furo,
      navegador_nome: f.navegador_nome || '',
      operador_nome: f.operador_nome || '',
      tubo_aplicado: f.tubo_aplicado || '',
      diametro_furo: f.diametro_furo || '',
      comprimento_furo: Number(f.comprimento_furo) || 0,
      tipo_perfuracao: f.tipo_perfuracao || [],
      utilizacao_tubo: f.utilizacao_tubo || [],
      hora_inicio_furo: f.hora_inicio_furo || '',
      hora_fim_furo: f.hora_fim_furo || '',
      status: f.status || 'EM_EXECUCAO',
      barras
    };
  }

  public static async createFuro(data: Partial<Furo>): Promise<Furo> {
    const { data: created, error } = await supabase
      .from('tecnodrill_furos')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error('Erro ao criar registro de furo.');
    return created;
  }

  public static async updateFuro(id: string, data: Partial<Furo>): Promise<Furo> {
    const { data: updated, error } = await supabase
      .from('tecnodrill_furos')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error('Erro ao atualizar registro de furo.');
    return updated;
  }

  public static async getBarras(furoId: string): Promise<Barra[]> {
    const { data, error } = await supabase
      .from('tecnodrill_barras')
      .select('*')
      .eq('furo_id', furoId)
      .order('numero_barra', { ascending: true });

    if (error) return [];

    const rawBarras = data || [];
    let needsRecalculation = false;
    for (const b of rawBarras) {
      const { meta } = parseBarraObservacao(b.observacao);
      const isCaixa = b.tipo_registro === 'CAIXA' || meta.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro && !meta.diametro);
      if (isCaixa && (Number(b.metros) > 0 || b.metros === null || b.metros === undefined)) {
        needsRecalculation = true;
        break;
      }
    }

    if (needsRecalculation) {
      return await this.resequenceBarras(furoId);
    }

    return rawBarras.map(b => {
      const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);
      const allFotos = (b.fotos && b.fotos.length > 0)
        ? b.fotos
        : (meta.fotos && meta.fotos.length > 0 ? meta.fotos : (b.foto_url ? [b.foto_url] : []));
      const isCaixa = b.tipo_registro === 'CAIXA' || meta.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro && !meta.diametro);
      const metrosValor = isCaixa ? 0 : (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      return {
        id: b.id,
        furo_id: b.furo_id,
        numero_barra: b.numero_barra,
        tipo_registro: isCaixa ? 'CAIXA' : (b.tipo_registro || meta.tipo_registro || 'CANALIZACAO'),
        metros: metrosValor,
        metros_acumulados: Number(b.metros_acumulados) || 0,
        diametro: isCaixa ? '' : (b.diametro || meta.diametro || ''),
        numero_os: b.numero_os || meta.numero_os || '',
        tem_caixa: isCaixa || Boolean(b.tem_caixa),
        angulo_pitch: b.angulo_pitch || '',
        profundidade_cm: Number(b.profundidade_cm) || 0,
        distancia_pista_cm: Number(b.distancia_pista_cm) || 0,
        foto_url: b.foto_url || (allFotos.length > 0 ? allFotos[0] : ''),
        fotos: allFotos,
        latitude: b.latitude ? Number(b.latitude) : undefined,
        longitude: b.longitude ? Number(b.longitude) : undefined,
        endereco: b.endereco || undefined,
        observacao: cleanObs,
        horario_registro: b.horario_registro
      };
    });
  }

  public static async resequenceBarras(furoId: string): Promise<Barra[]> {
    const { data: existing, error } = await supabase
      .from('tecnodrill_barras')
      .select('*')
      .eq('furo_id', furoId)
      .order('horario_registro', { ascending: true });

    if (error || !existing) return [];

    let runningTotal = 0;
    const updatedList: Barra[] = [];

    for (let i = 0; i < existing.length; i++) {
      const b = existing[i];
      const newNum = i + 1;
      const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);
      const isCaixa = b.tipo_registro === 'CAIXA' || meta.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro && !meta.diametro);
      const m = isCaixa ? 0 : (b.metros !== undefined && b.metros !== null && !isNaN(Number(b.metros)) ? Number(b.metros) : 3);
      runningTotal += m;

      if (b.numero_barra !== newNum || Number(b.metros_acumulados) !== runningTotal || Number(b.metros) !== m) {
        b.numero_barra = newNum;
        b.metros = m;
        b.metros_acumulados = runningTotal;

        await supabase
          .from('tecnodrill_barras')
          .update({ numero_barra: newNum, metros: m, metros_acumulados: runningTotal })
          .eq('id', b.id);
      }

      const allFotos = (b.fotos && b.fotos.length > 0)
        ? b.fotos
        : (meta.fotos && meta.fotos.length > 0 ? meta.fotos : (b.foto_url ? [b.foto_url] : []));

      updatedList.push({
        id: b.id,
        furo_id: b.furo_id,
        numero_barra: newNum,
        tipo_registro: isCaixa ? 'CAIXA' : (b.tipo_registro || meta.tipo_registro || 'CANALIZACAO'),
        metros: m,
        metros_acumulados: runningTotal,
        diametro: isCaixa ? '' : (b.diametro || meta.diametro || ''),
        numero_os: b.numero_os || meta.numero_os || '',
        tem_caixa: isCaixa || Boolean(b.tem_caixa),
        angulo_pitch: b.angulo_pitch || '',
        profundidade_cm: Number(b.profundidade_cm) || 0,
        distancia_pista_cm: Number(b.distancia_pista_cm) || 0,
        foto_url: b.foto_url || (allFotos.length > 0 ? allFotos[0] : ''),
        fotos: allFotos,
        latitude: b.latitude ? Number(b.latitude) : undefined,
        longitude: b.longitude ? Number(b.longitude) : undefined,
        endereco: b.endereco || undefined,
        observacao: cleanObs,
        horario_registro: b.horario_registro
      });
    }

    // Atualizar comprimento total do furo
    await supabase.from('tecnodrill_furos').update({ comprimento_furo: runningTotal }).eq('id', furoId);

    return updatedList;
  }

  public static async addBarra(furoId: string, data: Partial<Barra>): Promise<{
    barra: Barra;
    celebrarMeta: boolean;
    mensagem: string;
  }> {
    const { data: existingList } = await supabase
      .from('tecnodrill_barras')
      .select('id, metros, metros_acumulados, horario_registro, tem_caixa, observacao, tipo_registro, diametro')
      .eq('furo_id', furoId)
      .order('horario_registro', { ascending: true });

    const currentBarras = existingList || [];
    const nextNum = currentBarras.length + 1;

    const isCaixaRegistro = data.tipo_registro === 'CAIXA' || Boolean(data.tem_caixa && !data.diametro);

    // Metros anteriores: desconsidera registros de caixa
    const metrosAnteriores = currentBarras.reduce((acc, b) => {
      const { meta } = parseBarraObservacao(b.observacao);
      const isCaixa = b.tipo_registro === 'CAIXA' || meta.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro && !meta.diametro);
      if (isCaixa) return acc;
      return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
    }, 0);

    const metrosDesteRegistro = isCaixaRegistro ? 0 : (data.metros !== undefined && data.metros !== null ? Number(data.metros) : 3);
    const metrosAcumulados = metrosAnteriores + metrosDesteRegistro;

    // 1. Upload das fotos para o Supabase Storage (se vierem em Base64)
    const rawFotos = Array.isArray(data.fotos) && data.fotos.length > 0
      ? data.fotos
      : (data.foto_url ? [data.foto_url] : []);

    const uploadedFotos: string[] = [];
    for (let i = 0; i < rawFotos.length; i++) {
      const f = rawFotos[i];
      if (f && f.startsWith('data:image')) {
        const url = await this.uploadFoto(f, furoId, `barra_${nextNum}_sub_${i}`);
        uploadedFotos.push(url);
      } else if (f) {
        uploadedFotos.push(f);
      }
    }

    let mainFotoUrl = data.foto_url || '';
    if (mainFotoUrl && mainFotoUrl.startsWith('data:image')) {
      mainFotoUrl = uploadedFotos.length > 0 ? uploadedFotos[0] : await this.uploadFoto(mainFotoUrl, furoId, `barra_${nextNum}`);
    } else if (!mainFotoUrl && uploadedFotos.length > 0) {
      mainFotoUrl = uploadedFotos[0];
    }

    const { observacao: cleanObs } = parseBarraObservacao(data.observacao || '');
    const encodedObs = buildBarraObservacao(cleanObs, {
      tipo_registro: isCaixaRegistro ? 'CAIXA' : (data.tipo_registro || 'CANALIZACAO'),
      diametro: isCaixaRegistro ? '' : (data.diametro || ''),
      numero_os: data.numero_os || '',
      fotos: uploadedFotos
    });

    const supabaseBarraPayload: any = {
      furo_id: furoId,
      numero_barra: nextNum,
      metros: metrosDesteRegistro,
      metros_acumulados: metrosAcumulados,
      tem_caixa: Boolean(data.tem_caixa || isCaixaRegistro),
      angulo_pitch: data.angulo_pitch || '',
      profundidade_cm: Number(data.profundidade_cm) || 0,
      distancia_pista_cm: Number(data.distancia_pista_cm) || 0,
      foto_url: mainFotoUrl || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      observacao: encodedObs
    };

    let created: any = null;
    const res1 = await supabase
      .from('tecnodrill_barras')
      .insert(supabaseBarraPayload)
      .select()
      .single();

    if (res1.error) {
      console.error('[Add Barra Error]:', res1.error);
      throw new Error('Erro ao salvar apontamento.');
    } else {
      created = res1.data;
    }

    // Atualizar comprimento total do furo
    await supabase.from('tecnodrill_furos').update({ comprimento_furo: metrosAcumulados }).eq('id', furoId);

    // Validação estrita e precisa de Meta Diária / Semanal
    let metaAtingidaAgora = false;
    try {
      const { data: furoData } = await supabase.from('tecnodrill_furos').select('servico_id').eq('id', furoId).single();
      if (furoData) {
        const { data: servicoData } = await supabase.from('tecnodrill_servicos').select('*').eq('id', furoData.servico_id).single();
        if (servicoData && Number(servicoData.meta_metros) > 0 && !isCaixaRegistro) {
          const metaValor = Number(servicoData.meta_metros);
          const tipoMeta = servicoData.tipo_meta || 'DIARIA';
          const hojeStr = new Date().toISOString().split('T')[0];
          const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          const { data: furosDoServico } = await supabase.from('tecnodrill_furos').select('id').eq('servico_id', servicoData.id);
          const fIds = (furosDoServico || []).map(f => f.id);

          let metrosPeriodoAntes = 0;
          if (fIds.length > 0) {
            const { data: todasBarras } = await supabase.from('tecnodrill_barras').select('id, metros, horario_registro, tem_caixa, observacao, tipo_registro, diametro').in('furo_id', fIds);
            for (const b of (todasBarras || [])) {
              if (b.id === created.id) continue;
              const { meta } = parseBarraObservacao(b.observacao);
              const isCaixa = b.tipo_registro === 'CAIXA' || meta.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro && !meta.diametro);
              if (isCaixa) continue;
              const m = Number(b.metros) || 3;
              const dtStr = b.horario_registro ? b.horario_registro.split('T')[0] : hojeStr;
              const dtObj = b.horario_registro ? new Date(b.horario_registro) : new Date();

              if (tipoMeta === 'DIARIA' && dtStr === hojeStr) {
                metrosPeriodoAntes += m;
              } else if (tipoMeta === 'SEMANAL' && dtObj >= seteDiasAtras) {
                metrosPeriodoAntes += m;
              }
            }
          }

          const metrosPeriodoDepois = metrosPeriodoAntes + metrosDesteRegistro;
          // Dispara celebração APENAS no momento exato em que a meta é atingida pela primeira vez
          if (metrosPeriodoAntes < metaValor && metrosPeriodoDepois >= metaValor) {
            metaAtingidaAgora = true;
          }
        }
      }
    } catch (_) {}

    const barra: Barra = {
      id: created.id,
      furo_id: created.furo_id,
      numero_barra: created.numero_barra,
      tipo_registro: isCaixaRegistro ? 'CAIXA' : (data.tipo_registro || 'CANALIZACAO'),
      metros: isCaixaRegistro ? 0 : (created.metros !== undefined && created.metros !== null ? Number(created.metros) : metrosDesteRegistro),
      metros_acumulados: Number(created.metros_acumulados) || metrosAcumulados,
      diametro: isCaixaRegistro ? '' : (data.diametro || ''),
      numero_os: data.numero_os || '',
      tem_caixa: Boolean(created.tem_caixa || isCaixaRegistro),
      angulo_pitch: created.angulo_pitch,
      profundidade_cm: Number(created.profundidade_cm) || 0,
      foto_url: created.foto_url || (uploadedFotos.length > 0 ? uploadedFotos[0] : ''),
      fotos: uploadedFotos,
      latitude: created.latitude ? Number(created.latitude) : undefined,
      longitude: created.longitude ? Number(created.longitude) : undefined,
      endereco: created.endereco || data.endereco || undefined,
      observacao: cleanObs,
      horario_registro: created.horario_registro
    };

    // Disparar evento para atualização em tempo real sem precisar de reload
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tecnodrill:barra_added', {
        detail: { barra, furoId }
      }));
    }

    return {
      barra,
      celebrarMeta: metaAtingidaAgora,
      mensagem: isCaixaRegistro
        ? `Instalação de Caixa #${nextNum} registrada com sucesso!`
        : `Registro ${nextNum} apontado com sucesso (+${metrosDesteRegistro}m)!`
    };
  }

  public static async deleteBarra(id: string): Promise<{ success: boolean; furoId?: string; remainingBarras?: Barra[] }> {
    let furoId = '';
    try {
      const { data } = await supabase.from('tecnodrill_barras').select('furo_id').eq('id', id).single();
      if (data) furoId = data.furo_id;
    } catch (_) {}

    const { error } = await supabase.from('tecnodrill_barras').delete().eq('id', id);
    if (error) throw new Error('Erro ao excluir registro.');

    let remainingBarras: Barra[] = [];
    if (furoId) {
      remainingBarras = await this.resequenceBarras(furoId);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tecnodrill:barra_deleted', {
        detail: { barraId: id, furoId, remainingBarras }
      }));
    }

    return { success: true, furoId, remainingBarras };
  }

  // ============================================================================
  // DASHBOARD GESTOR
  // ============================================================================
  public static async getDashboard(): Promise<DashboardGestorMetrics> {
    const servicos = await this.getServicos();
    const servicosAtivos = servicos.filter(s => s.status === 'EM_ANDAMENTO').length;
    const servicosConcluidos = servicos.filter(s => s.status === 'CONCLUIDO').length;

    let totalMetrosPerfurados = 0;
    let totalRetornoFinanceiro = 0;

    const metricasServicos: ResumoFinanceiroServico[] = [];

    servicos.forEach(s => {
      if (s.metricas) {
        totalMetrosPerfurados += s.metricas.metrosExecutados;
        totalRetornoFinanceiro += s.metricas.retornoFinanceiroCalculado;
        metricasServicos.push(s.metricas);
      }
    });

    return {
      totalMetrosPerfurados,
      totalRetornoFinanceiro,
      totalServicosAtivos: servicosAtivos,
      totalFurosFinalizados: servicosConcluidos,
      taxaAtingimentoMetas: servicosConcluidos > 0 ? 100 : 0,
      servicos: metricasServicos,
      evolucaoDiaria: []
    };
  }

  public static getExcelUrl(furoId: string): string {
    return `/api/relatorios/furo/${furoId}/excel`;
  }
}
