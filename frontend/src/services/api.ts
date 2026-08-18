import bcrypt from 'bcryptjs';
import { supabase } from './supabaseClient';
import { Usuario, Servico, Furo, Barra, DashboardGestorMetrics, ResumoFinanceiroServico, PerfilUsuario } from '../types';

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

    for (const s of servicosData) {
      let furos: any[] = [];
      try {
        const { data: furosData } = await supabase
          .from('tecnodrill_furos')
          .select('*')
          .eq('servico_id', s.id);
        furos = furosData || [];
      } catch (_) {}

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

      if (furos && furos.length > 0) {
        const furoIds = furos.map(f => f.id);
        try {
          const { data: barras } = await supabase
            .from('tecnodrill_barras')
            .select('metros, metros_acumulados')
            .in('furo_id', furoIds)
            .order('numero_barra', { ascending: false });

          if (barras && barras.length > 0) {
            metrosExecutados = barras[0].metros_acumulados || 0;
          }
        } catch (_) {}
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

      result.push({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao || '',
        cliente: s.cliente || '',
        projeto: s.projeto || '',
        obra: s.obra || '',
        centro_custo: s.centro_custo || '',
        local: s.local || '',
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
        tipo_meta: s.tipo_meta || 'DIARIA',
        meta_metros: Number(s.meta_metros) || 100,
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

    const furos: Furo[] = furosData.map(f => ({
      id: f.id,
      servico_id: f.servico_id,
      data_furo: f.data_furo,
      navegador_nome: f.navegador_nome || s.navegador_nome || '',
      operador_nome: f.operador_nome || s.operador_nome || '',
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
      descricao: s.descricao || '',
      cliente: s.cliente || '',
      projeto: s.projeto || '',
      obra: s.obra || '',
      centro_custo: s.centro_custo || '',
      local: s.local || '',
      gestor_id: s.gestor_id,
      navegador_id: s.navegador_id,
      navegador_nome: s.navegador_nome,
      operador_id: s.operador_id,
      operador_nome: s.operador_nome,
      status: s.status,
      cenario_financeiro: s.cenario_financeiro,
      valor_metro: Number(s.valor_metro) || 0,
      fator_financeiro: Number(s.fator_financeiro) || 0,
      diametro_furo_mm: Number(s.diametro_furo_mm) || 0,
      valor_total_fechado: Number(s.valor_total_fechado) || 0,
      metragem_prevista_total: Number(s.metragem_prevista_total) || 1000,
      tipo_meta: s.tipo_meta || 'DIARIA',
      meta_metros: Number(s.meta_metros) || 100,
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

    const fullPayload: any = {
      id: servicoId,
      nome: data.nome?.toUpperCase().trim(),
      descricao: data.descricao || null,
      cliente: data.cliente || '',
      projeto: data.projeto || null,
      obra: data.obra || null,
      centro_custo: data.centro_custo || null,
      local: data.local || '',
      gestor_id: data.gestor_id || null,
      navegador_id: data.navegador_id || null,
      navegador_nome: data.navegador_nome || null,
      operador_id: data.operador_id || null,
      operador_nome: data.operador_nome || null,
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

    // Tenta inserir com o payload completo
    try {
      const { data: created, error } = await supabase
        .from('tecnodrill_servicos')
        .insert(fullPayload)
        .select()
        .single();
      
      if (!error && created) {
        createdServico = created;
      } else if (error) {
        console.warn('[Supabase createServico fallback, trying base columns]:', error);
        const { navegador_id, navegador_nome, operador_id, operador_nome, ...basePayload } = fullPayload;
        const { data: baseCreated, error: baseErr } = await supabase
          .from('tecnodrill_servicos')
          .insert(basePayload)
          .select()
          .single();
        if (!baseErr && baseCreated) {
          createdServico = { ...baseCreated, navegador_id, navegador_nome, operador_id, operador_nome };
        }
      }
    } catch (err) {
      console.warn('[Supabase createServico error]:', err);
    }

    // Sincroniza também no backend local
    try {
      const res = await fetch('/api/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload)
      });
      if (res.ok && !createdServico) {
        createdServico = await res.json();
      }
    } catch (_) {}

    if (!createdServico) {
      createdServico = {
        ...fullPayload,
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
    const payload: any = { ...data };
    delete payload.id;
    delete payload.metricas;
    delete payload.furos;

    let updatedServico: any = null;

    // 1. Tenta atualizar tecnodrill_servicos com payload completo
    try {
      const { data: updated, error } = await supabase
        .from('tecnodrill_servicos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && updated) {
        updatedServico = updated;
      } else {
        // Fallback caso a tabela tecnodrill_servicos não tenha colunas de equipe
        const { navegador_id, navegador_nome, operador_id, operador_nome, ...basePayload } = payload;
        const { data: baseUpdated, error: baseErr } = await supabase
          .from('tecnodrill_servicos')
          .update(basePayload)
          .eq('id', id)
          .select()
          .single();
        if (!baseErr && baseUpdated) {
          updatedServico = { ...baseUpdated, navegador_id, navegador_nome, operador_id, operador_nome };
        }
      }
    } catch (err) {
      console.warn('[Supabase updateServico fallback]:', err);
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
    return (data || []).map(b => ({
      id: b.id,
      furo_id: b.furo_id,
      numero_barra: b.numero_barra,
      metros: Number(b.metros) || 3,
      metros_acumulados: Number(b.metros_acumulados) || 0,
      tem_caixa: Boolean(b.tem_caixa),
      angulo_pitch: b.angulo_pitch || '',
      profundidade_cm: Number(b.profundidade_cm) || 0,
      foto_url: b.foto_url || '',
      latitude: b.latitude ? Number(b.latitude) : undefined,
      longitude: b.longitude ? Number(b.longitude) : undefined,
      observacao: b.observacao || '',
      horario_registro: b.horario_registro
    }));
  }

  public static async addBarra(furoId: string, data: Partial<Barra>): Promise<{
    barra: Barra;
    celebrarMeta: boolean;
    mensagem: string;
  }> {
    const { data: existing } = await supabase
      .from('tecnodrill_barras')
      .select('numero_barra, metros_acumulados')
      .eq('furo_id', furoId)
      .order('numero_barra', { ascending: false })
      .limit(1);

    const nextNum = existing && existing.length > 0 ? existing[0].numero_barra + 1 : 1;
    const metrosAnteriores = existing && existing.length > 0 ? Number(existing[0].metros_acumulados) : 0;
    const metrosDesteRegistro = Number(data.metros) || 3;
    const metrosAcumulados = metrosAnteriores + metrosDesteRegistro;

    const payload = {
      furo_id: furoId,
      numero_barra: nextNum,
      metros: metrosDesteRegistro,
      metros_acumulados: metrosAcumulados,
      tem_caixa: Boolean(data.tem_caixa),
      angulo_pitch: data.angulo_pitch || '',
      profundidade_cm: Number(data.profundidade_cm) || 0,
      foto_url: data.foto_url || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      observacao: data.observacao || null
    };

    const { data: created, error } = await supabase
      .from('tecnodrill_barras')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[Add Barra Error]:', error);
      throw new Error('Erro ao salvar apontamento.');
    }

    const barra: Barra = {
      id: created.id,
      furo_id: created.furo_id,
      numero_barra: created.numero_barra,
      metros: Number(created.metros) || 3,
      metros_acumulados: Number(created.metros_acumulados) || metrosAcumulados,
      tem_caixa: Boolean(created.tem_caixa),
      angulo_pitch: created.angulo_pitch,
      profundidade_cm: Number(created.profundidade_cm) || 0,
      foto_url: created.foto_url,
      latitude: created.latitude ? Number(created.latitude) : undefined,
      longitude: created.longitude ? Number(created.longitude) : undefined,
      observacao: created.observacao,
      horario_registro: created.horario_registro
    };

    return {
      barra,
      celebrarMeta: false,
      mensagem: `Registro ${nextNum} apontado com sucesso (+${metrosDesteRegistro}m)!`
    };
  }

  public static async deleteBarra(id: string): Promise<{ success: boolean }> {
    const { error } = await supabase.from('tecnodrill_barras').delete().eq('id', id);
    if (error) throw new Error('Erro ao excluir registro.');
    return { success: true };
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
