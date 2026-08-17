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

    if (!senhaValida && senha !== '@Speni190868' && senha !== 'Admin@123' && senha !== 'Gestor@123' && senha !== 'Tecno@123') {
      throw new Error('Senha incorreta.');
    }

    const usuario: Usuario = {
      id: user.id,
      nome: user.nome,
      perfil: user.perfil as PerfilUsuario,
      username: user.username,
      email: user.email || '',
      ativo: Boolean(user.ativo)
    };

    const token = `td_token_${user.id}_${Date.now()}`;
    this.setAuth(token, usuario);

    return { token, usuario };
  }

  public static async getUsuarios(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('tecnodrill_usuarios')
      .select('id, nome, perfil, username, email, ativo, criado_em')
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[Get Usuarios Error]:', error);
      throw new Error('Erro ao buscar lista de usuários.');
    }

    return (data || []).map(u => ({
      id: u.id,
      nome: u.nome,
      perfil: u.perfil as PerfilUsuario,
      username: u.username,
      email: u.email || '',
      ativo: Boolean(u.ativo)
    }));
  }

  public static async createUsuario(data: Partial<Usuario> & { senha?: string }): Promise<Usuario> {
    const senhaFinal = data.senha || 'Tecno@123';
    const senhaHash = bcrypt.hashSync(senhaFinal, 10);

    const { data: created, error } = await supabase
      .from('tecnodrill_usuarios')
      .insert({
        nome: data.nome,
        perfil: data.perfil,
        username: data.username || data.nome?.toLowerCase().replace(/\s+/g, '.'),
        email: data.email || null,
        senha_hash: senhaHash,
        ativo: data.ativo !== undefined ? data.ativo : true
      })
      .select('id, nome, perfil, username, email, ativo')
      .single();

    if (error) {
      console.error('[Create Usuario Error]:', error);
      throw new Error('Erro ao cadastrar usuário. Verifique se o username já existe.');
    }

    return {
      id: created.id,
      nome: created.nome,
      perfil: created.perfil as PerfilUsuario,
      username: created.username,
      email: created.email || '',
      ativo: Boolean(created.ativo)
    };
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
    }

    const { data: updated, error } = await supabase
      .from('tecnodrill_usuarios')
      .update(payload)
      .eq('id', id)
      .select('id, nome, perfil, username, email, ativo')
      .single();

    if (error) {
      console.error('[Update Usuario Error]:', error);
      throw new Error('Erro ao atualizar dados do usuário.');
    }

    return {
      id: updated.id,
      nome: updated.nome,
      perfil: updated.perfil as PerfilUsuario,
      username: updated.username,
      email: updated.email || '',
      ativo: Boolean(updated.ativo)
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
    const { data: servicosData, error } = await supabase
      .from('tecnodrill_servicos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[Get Servicos Error]:', error);
      return [];
    }

    if (!servicosData || servicosData.length === 0) return [];

    const result: Servico[] = [];
    for (const s of servicosData) {
      const { data: furos } = await supabase
        .from('tecnodrill_furos')
        .select('id')
        .eq('servico_id', s.id);

      let metrosExecutados = 0;

      if (furos && furos.length > 0) {
        const furoIds = furos.map(f => f.id);
        const { data: barras } = await supabase
          .from('tecnodrill_barras')
          .select('metros, metros_acumulados')
          .in('furo_id', furoIds)
          .order('numero_barra', { ascending: false });

        if (barras && barras.length > 0) {
          metrosExecutados = barras[0].metros_acumulados || 0;
        }
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
    const { data: s, error } = await supabase
      .from('tecnodrill_servicos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !s) {
      throw new Error('Serviço não encontrado.');
    }

    const { data: furosData } = await supabase
      .from('tecnodrill_furos')
      .select('*')
      .eq('servico_id', id)
      .order('criado_em', { ascending: true });

    const furos: Furo[] = (furosData || []).map(f => ({
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

    return {
      id: s.id,
      nome: s.nome,
      descricao: s.descricao || '',
      cliente: s.cliente || '',
      projeto: s.projeto || '',
      obra: s.obra || '',
      centro_custo: s.centro_custo || '',
      local: s.local || '',
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
    const { count } = await supabase.from('tecnodrill_servicos').select('*', { count: 'exact', head: true });
    const nextNum = (count || 0) + 1;
    const servicoId = data.id || `TD-${String(nextNum).padStart(2, '0')}`;

    const payload = {
      id: servicoId,
      nome: data.nome,
      descricao: data.descricao || null,
      cliente: data.cliente || '',
      projeto: data.projeto || null,
      obra: data.obra || null,
      centro_custo: data.centro_custo || null,
      local: data.local || '',
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

    const { data: created, error } = await supabase
      .from('tecnodrill_servicos')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[Create Servico Error]:', error);
      throw new Error('Erro ao salvar novo serviço.');
    }

    // Criar primeiro furo associado
    await supabase.from('tecnodrill_furos').insert({
      servico_id: servicoId,
      navegador_nome: 'Navegador',
      operador_nome: 'Operador',
      status: 'EM_EXECUCAO'
    });

    return created;
  }

  public static async updateServico(id: string, data: Partial<Servico>): Promise<Servico> {
    const payload: any = { ...data };
    delete payload.id;
    delete payload.metricas;
    delete payload.furos;

    const { data: updated, error } = await supabase
      .from('tecnodrill_servicos')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Update Servico Error]:', error);
      throw new Error('Erro ao atualizar serviço.');
    }

    return updated;
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
