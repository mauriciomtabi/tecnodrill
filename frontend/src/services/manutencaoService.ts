import { supabase } from './supabaseClient';
import { ApiService } from './api';
import {
  Veiculo,
  PlanoPreventiva,
  VeiculoPreventiva,
  ManutencaoHistorico,
  VeiculoLeitura,
  StatusPreventiva,
  TipoVeiculo,
  ItemPlanoPreventiva,
} from '../types';

export interface PreventivaCalculada extends VeiculoPreventiva {
  status: StatusPreventiva;
  restante: number;
  percentualUso: number;
}

export interface AlertaVeiculo {
  veiculo: Veiculo;
  statusGeral: StatusPreventiva;
  vencidas: PreventivaCalculada[];
  proximas: PreventivaCalculada[];
}

export function getHojeBrasilia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function calcularStatusPreventiva(
  preventiva: VeiculoPreventiva,
  leituraAtual: number
): PreventivaCalculada {
  const proxima = Number(preventiva.proxima_leitura ?? (Number(preventiva.ultima_leitura_realizada || 0) + Number(preventiva.intervalo || 0)));
  const atual = Number(leituraAtual || 0);
  const restante = Number((proxima - atual).toFixed(2));
  const antecedencia = Number(preventiva.alerta_antecedencia || 0);
  const intervalo = Math.max(Number(preventiva.intervalo || 1), 1);
  const consumido = atual - Number(preventiva.ultima_leitura_realizada || 0);
  const percentualUso = Math.max(0, Math.min(100, Math.round((consumido / intervalo) * 100)));

  let status: StatusPreventiva = 'EM_DIA';
  if (restante <= 0) {
    status = 'VENCIDO';
  } else if (restante <= antecedencia) {
    status = 'PROXIMO';
  }

  return {
    ...preventiva,
    proxima_leitura: proxima,
    status,
    restante,
    percentualUso,
  };
}

export class ManutencaoService {
  /**
   * Faz upload de foto (base64 DataURL) ou documento (File/Blob) para o bucket tecnodrill-fotos.
   */
  public static async uploadArquivoFrota(
    arquivo: string | File,
    pasta: string,
    prefix = 'frota'
  ): Promise<string> {
    if (typeof arquivo === 'string') {
      if (!arquivo.startsWith('data:image')) return arquivo;
      return ApiService.uploadFoto(arquivo, `frota_${pasta}`, prefix);
    }

    const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin';
    const userId = ApiService.getUsuarioAtual()?.id || 'sistema';
    const fileName = `${userId}/frota_${pasta}/${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error } = await supabase.storage
      .from('tecnodrill-fotos')
      .upload(fileName, arquivo, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      throw new Error(`Erro ao enviar arquivo: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('tecnodrill-fotos')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  // ==========================================================================
  // VEÍCULOS (PERFURATRIZES E CAMINHÕES)
  // ==========================================================================

  public static async getVeiculos(incluirInativos = false): Promise<Veiculo[]> {
    let query = supabase
      .from('tecnodrill_veiculos')
      .select(`
        *,
        tecnodrill_servicos ( id, nome ),
        tecnodrill_veiculo_preventivas ( * )
      `)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true });

    if (!incluirInativos) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      ...row,
      leitura_atual: Number(row.leitura_atual || 0),
      fotos: Array.isArray(row.fotos) ? row.fotos : [],
      documentos: Array.isArray(row.documentos) ? row.documentos : [],
      especificacoes: row.especificacoes && typeof row.especificacoes === 'object' ? row.especificacoes : {},
      servico_nome: row.tecnodrill_servicos?.nome || null,
      preventivas: (Array.isArray(row.tecnodrill_veiculo_preventivas) ? row.tecnodrill_veiculo_preventivas : [])
        .filter((p: VeiculoPreventiva) => p.ativo)
        .map((p: VeiculoPreventiva) => ({
          ...p,
          intervalo: Number(p.intervalo),
          alerta_antecedencia: Number(p.alerta_antecedencia),
          ultima_leitura_realizada: Number(p.ultima_leitura_realizada),
          proxima_leitura: Number(p.proxima_leitura),
        })),
    }));
  }

  public static async getVeiculosDaObra(servicoId: string): Promise<Veiculo[]> {
    const { data, error } = await supabase
      .from('tecnodrill_veiculos')
      .select(`
        *,
        tecnodrill_veiculo_preventivas ( * )
      `)
      .eq('servico_id', servicoId)
      .eq('ativo', true)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      ...row,
      leitura_atual: Number(row.leitura_atual || 0),
      fotos: Array.isArray(row.fotos) ? row.fotos : [],
      documentos: Array.isArray(row.documentos) ? row.documentos : [],
      especificacoes: row.especificacoes && typeof row.especificacoes === 'object' ? row.especificacoes : {},
      preventivas: (Array.isArray(row.tecnodrill_veiculo_preventivas) ? row.tecnodrill_veiculo_preventivas : [])
        .filter((p: VeiculoPreventiva) => p.ativo),
    }));
  }

  public static async saveVeiculo(
    payload: Partial<Veiculo> & { id?: string }
  ): Promise<Veiculo> {
    const folderId = payload.id || `novo_${Date.now()}`;

    let fotoPrincipal = payload.foto_principal_url || '';
    if (fotoPrincipal.startsWith('data:image')) {
      fotoPrincipal = await this.uploadArquivoFrota(fotoPrincipal, folderId, 'capa');
    }

    const fotosInput = Array.isArray(payload.fotos) ? payload.fotos : [];
    const fotosUploaded: string[] = [];
    for (let i = 0; i < fotosInput.length; i++) {
      const f = fotosInput[i];
      if (!f) continue;
      if (f.startsWith('data:image')) {
        fotosUploaded.push(await this.uploadArquivoFrota(f, folderId, `galeria_${i + 1}`));
      } else {
        fotosUploaded.push(f);
      }
    }

    if (!fotoPrincipal && fotosUploaded.length > 0) {
      fotoPrincipal = fotosUploaded[0];
    }

    const tipo: TipoVeiculo = payload.tipo || 'PERFURATRIZ';
    const unidade_medida = tipo === 'PERFURATRIZ' ? 'HORAS' : 'KM';

    const dbData = {
      nome: (payload.nome || '').trim(),
      codigo_interno: payload.codigo_interno?.trim() || null,
      tipo,
      marca: payload.marca?.trim() || null,
      modelo: payload.modelo?.trim() || null,
      ano: payload.ano ? Number(payload.ano) : null,
      placa: payload.placa?.trim().toUpperCase() || null,
      numero_serie: payload.numero_serie?.trim() || null,
      unidade_medida,
      leitura_atual: Number(payload.leitura_atual || 0),
      servico_id: payload.servico_id || null,
      foto_principal_url: fotoPrincipal || null,
      fotos: fotosUploaded,
      documentos: Array.isArray(payload.documentos) ? payload.documentos : [],
      especificacoes: payload.especificacoes || {},
      observacoes: payload.observacoes?.trim() || null,
      ativo: payload.ativo !== undefined ? payload.ativo : true,
      atualizado_em: new Date().toISOString(),
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from('tecnodrill_veiculos')
        .update(dbData)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Veiculo;
    } else {
      const { data, error } = await supabase
        .from('tecnodrill_veiculos')
        .insert(dbData)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Veiculo;
    }
  }

  public static async inativarVeiculo(id: string): Promise<void> {
    const { error } = await supabase
      .from('tecnodrill_veiculos')
      .update({ ativo: false, servico_id: null, atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ==========================================================================
  // PLANOS PADRÃO & PREVENTIVAS DO VEÍCULO
  // ==========================================================================

  public static async getPlanosPreventiva(): Promise<PlanoPreventiva[]> {
    const { data, error } = await supabase
      .from('tecnodrill_planos_preventiva')
      .select('*')
      .eq('ativo', true)
      .order('tipo_veiculo', { ascending: true })
      .order('nome', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map((p: any) => ({
      ...p,
      itens: Array.isArray(p.itens) ? p.itens : [],
    }));
  }

  public static async savePlanoPreventiva(
    plano: Partial<PlanoPreventiva> & { id?: string }
  ): Promise<PlanoPreventiva> {
    const dbData = {
      nome: (plano.nome || '').trim(),
      tipo_veiculo: plano.tipo_veiculo || 'PERFURATRIZ',
      descricao: plano.descricao?.trim() || null,
      itens: Array.isArray(plano.itens) ? plano.itens : [],
      ativo: true,
    };

    if (plano.id) {
      const { data, error } = await supabase
        .from('tecnodrill_planos_preventiva')
        .update(dbData)
        .eq('id', plano.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as PlanoPreventiva;
    }

    const { data, error } = await supabase
      .from('tecnodrill_planos_preventiva')
      .insert(dbData)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PlanoPreventiva;
  }

  public static async aplicarPlanoAoVeiculo(
    veiculoId: string,
    itens: ItemPlanoPreventiva[],
    leituraBase: number
  ): Promise<void> {
    if (!itens.length) return;
    const rows = itens.map((item) => ({
      veiculo_id: veiculoId,
      nome: item.nome.trim(),
      categoria: item.categoria?.trim() || null,
      descricao: item.descricao?.trim() || null,
      intervalo: Number(item.intervalo),
      alerta_antecedencia: Number(item.alerta_antecedencia || 0),
      ultima_leitura_realizada: Number(leituraBase || 0),
      ativo: true,
    }));

    const { error } = await supabase.from('tecnodrill_veiculo_preventivas').insert(rows);
    if (error) throw new Error(error.message);
  }

  public static async savePreventivaVeiculo(
    item: Partial<VeiculoPreventiva> & { veiculo_id: string }
  ): Promise<VeiculoPreventiva> {
    const dbData = {
      veiculo_id: item.veiculo_id,
      nome: (item.nome || '').trim(),
      categoria: item.categoria?.trim() || null,
      descricao: item.descricao?.trim() || null,
      intervalo: Number(item.intervalo),
      alerta_antecedencia: Number(item.alerta_antecedencia || 0),
      ultima_leitura_realizada: Number(item.ultima_leitura_realizada || 0),
      ativo: item.ativo !== undefined ? item.ativo : true,
    };

    if (item.id) {
      const { data, error } = await supabase
        .from('tecnodrill_veiculo_preventivas')
        .update(dbData)
        .eq('id', item.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as VeiculoPreventiva;
    }

    const { data, error } = await supabase
      .from('tecnodrill_veiculo_preventivas')
      .insert(dbData)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as VeiculoPreventiva;
  }

  public static async deletePreventivaVeiculo(id: string): Promise<void> {
    const { error } = await supabase
      .from('tecnodrill_veiculo_preventivas')
      .update({ ativo: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ==========================================================================
  // BAIXA DE PREVENTIVA & HISTÓRICO
  // ==========================================================================

  public static async registrarBaixaPreventiva(params: {
    veiculo: Veiculo;
    preventiva: VeiculoPreventiva;
    leitura_realizada: number;
    executado_por_nome?: string;
    observacoes?: string;
    fotos?: string[];
  }): Promise<void> {
    const user = ApiService.getUsuarioAtual();
    const { veiculo, preventiva, leitura_realizada, executado_por_nome, observacoes, fotos = [] } = params;

    const fotosUploaded: string[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      if (!f) continue;
      if (f.startsWith('data:image')) {
        fotosUploaded.push(await this.uploadArquivoFrota(f, veiculo.id, `prev_${i + 1}`));
      } else {
        fotosUploaded.push(f);
      }
    }

    const agora = new Date().toISOString();

    const { error: histErr } = await supabase.from('tecnodrill_manutencoes_historico').insert({
      veiculo_id: veiculo.id,
      preventiva_id: preventiva.id,
      servico_id: veiculo.servico_id || null,
      titulo: preventiva.nome,
      leitura_realizada: Number(leitura_realizada),
      data_realizacao: agora,
      executado_por_nome: executado_por_nome?.trim() || null,
      registrado_por: user?.id || null,
      registrado_por_nome: user?.nome || 'Gestor',
      observacoes: observacoes?.trim() || null,
      fotos: fotosUploaded,
    });
    if (histErr) throw new Error(histErr.message);

    const { error: prevErr } = await supabase
      .from('tecnodrill_veiculo_preventivas')
      .update({
        ultima_leitura_realizada: Number(leitura_realizada),
        data_ultima_realizacao: agora,
      })
      .eq('id', preventiva.id);
    if (prevErr) throw new Error(prevErr.message);

    if (Number(leitura_realizada) > Number(veiculo.leitura_atual || 0)) {
      await supabase.from('tecnodrill_veiculo_leituras').insert({
        veiculo_id: veiculo.id,
        servico_id: veiculo.servico_id || null,
        usuario_id: user?.id || null,
        usuario_nome: user?.nome || 'Gestor',
        data_referencia: getHojeBrasilia(),
        leitura_anterior: Number(veiculo.leitura_atual || 0),
        leitura_informada: Number(leitura_realizada),
        unidade_medida: veiculo.unidade_medida,
        origem: 'PREVENTIVA',
        observacao: `Atualizado na baixa: ${preventiva.nome}`,
      });
    }
  }

  public static async getHistoricoVeiculo(veiculoId: string): Promise<ManutencaoHistorico[]> {
    const { data, error } = await supabase
      .from('tecnodrill_manutencoes_historico')
      .select('*')
      .eq('veiculo_id', veiculoId)
      .order('data_realizacao', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (data || []) as ManutencaoHistorico[];
  }

  // ==========================================================================
  // LEITURAS DIÁRIAS & TRAVA DO 1º REGISTRO DO DIA
  // ==========================================================================

  public static async getLeiturasVeiculo(veiculoId: string): Promise<VeiculoLeitura[]> {
    const { data, error } = await supabase
      .from('tecnodrill_veiculo_leituras')
      .select('*')
      .eq('veiculo_id', veiculoId)
      .order('criado_em', { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);
    return (data || []) as VeiculoLeitura[];
  }

  /**
   * Verifica se há veículos vinculados à obra que ainda não tiveram leitura registrada hoje.
   */
  public static async getVeiculosPendentesLeituraHoje(servicoId: string): Promise<Veiculo[]> {
    if (!servicoId) return [];
    const veiculos = await this.getVeiculosDaObra(servicoId);
    if (veiculos.length === 0) return [];

    const hoje = getHojeBrasilia();
    const ids = veiculos.map((v) => v.id);

    const { data: leiturasHoje, error } = await supabase
      .from('tecnodrill_veiculo_leituras')
      .select('veiculo_id')
      .in('veiculo_id', ids)
      .eq('data_referencia', hoje);

    if (error) {
      console.warn('[ManutencaoService] Falha ao checar leituras de hoje:', error.message);
      return [];
    }

    const jaRegistrados = new Set((leiturasHoje || []).map((l: any) => l.veiculo_id));
    return veiculos.filter((v) => !jaRegistrados.has(v.id));
  }

  public static async registrarLeituras(
    entradas: Array<{
      veiculo: Veiculo;
      leitura_informada: number;
      observacao?: string;
    }>,
    origem: 'PRIMEIRO_REGISTRO_DIA' | 'MANUAL' = 'PRIMEIRO_REGISTRO_DIA'
  ): Promise<void> {
    if (!entradas.length) return;
    const user = ApiService.getUsuarioAtual();
    const hoje = getHojeBrasilia();

    const rows = entradas.map(({ veiculo, leitura_informada, observacao }) => ({
      veiculo_id: veiculo.id,
      servico_id: veiculo.servico_id || null,
      usuario_id: user?.id || null,
      usuario_nome: user?.nome || 'Usuário',
      data_referencia: hoje,
      leitura_anterior: Number(veiculo.leitura_atual || 0),
      leitura_informada: Number(leitura_informada),
      unidade_medida: veiculo.unidade_medida,
      origem,
      observacao: observacao?.trim() || null,
    }));

    const { error } = await supabase.from('tecnodrill_veiculo_leituras').insert(rows);
    if (error) throw new Error(error.message);
  }

  // ==========================================================================
  // ALERTAS & SEMÁFORO DA FROTA
  // ==========================================================================

  public static avaliarAlertasVeiculos(veiculos: Veiculo[]): AlertaVeiculo[] {
    return veiculos.map((veiculo) => {
      const calculadas = (veiculo.preventivas || []).map((p) =>
        calcularStatusPreventiva(p, veiculo.leitura_atual)
      );
      const vencidas = calculadas.filter((p) => p.status === 'VENCIDO');
      const proximas = calculadas.filter((p) => p.status === 'PROXIMO');
      const statusGeral: StatusPreventiva =
        vencidas.length > 0 ? 'VENCIDO' : proximas.length > 0 ? 'PROXIMO' : 'EM_DIA';
      return { veiculo, statusGeral, vencidas, proximas };
    });
  }

  public static async enviarAlertaFrotaTelegram(veiculos: Veiculo[]): Promise<{ ok: boolean; message: string }> {
    const alertas = this.avaliarAlertasVeiculos(veiculos).filter(
      (a) => a.vencidas.length > 0 || a.proximas.length > 0
    );

    if (alertas.length === 0) {
      return { ok: true, message: 'Toda a frota está em dia. Nenhum alerta pendente.' };
    }

    const linhas = alertas.map((a) => {
      const unit = a.veiculo.unidade_medida === 'HORAS' ? 'h' : 'km';
      const icon = a.statusGeral === 'VENCIDO' ? '🔴' : '🟡';
      const itens = [...a.vencidas, ...a.proximas]
        .map((p) => `  • ${p.nome}: ${p.restante <= 0 ? `VENCIDA (${Math.abs(p.restante)}${unit})` : `faltam ${p.restante}${unit}`}`)
        .join('\n');
      return `${icon} *${a.veiculo.nome}* (${a.veiculo.leitura_atual}${unit})\n${itens}`;
    });

    const texto = `🔧 *ALERTA DE MANUTENÇÃO PREVENTIVA - FROTA TECNODRILL*\n\n${linhas.join('\n\n')}`;

    const res = await fetch('/api/relatorios/frota-alerta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('tecnodrill_token') || ''}`,
      },
      body: JSON.stringify({ texto, alertasCount: alertas.length }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Não foi possível enviar o alerta.');
    }

    return res.json();
  }
}
