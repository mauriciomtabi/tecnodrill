import { DBManager, TecnodrillServico, TecnodrillFuro, TecnodrillBarra } from '../database/db';

export interface ResumoFinanceiroServico {
  servicoId: string;
  nome: string;
  cliente: string;
  cenarioFinanceiro: 'VALOR_METRO' | 'FATOR_DIAMETRO_METRO' | 'VALOR_FECHADO';
  metrosExecutados: number;
  metragemPrevistaTotal: number;
  percentualConcluido: number;
  retornoFinanceiroCalculado: number;
  detalhesCalculo: {
    formula: string;
    parametros: Record<string, any>;
  };
  meta: {
    tipo: 'DIARIA' | 'SEMANAL';
    valorMetaMetros: number;
    metrosPeriodoAtual: number;
    percentualMetaPeriodo: number;
    metaAtingida: boolean;
  };
}

export interface DashboardGestorMetrics {
  totalMetrosPerfurados: number;
  totalRetornoFinanceiro: number;
  totalServicosAtivos: number;
  totalFurosFinalizados: number;
  taxaAtingimentoMetas: number;
  servicos: ResumoFinanceiroServico[];
  evolucaoDiaria: Array<{ data: string; metros: number; retorno: number }>;
}

export class FinanceiroService {
  /**
   * Calcula o retorno financeiro de um serviço com base nas regras de negócio da Tecnodrill
   */
  public static calcularRetornoServico(servico: TecnodrillServico, totalMetros: number): { retorno: number; formula: string; params: any } {
    let retorno = 0;
    let formula = '';
    let params: any = {};

    switch (servico.cenario_financeiro) {
      case 'VALOR_METRO': {
        const vMetro = Number(servico.valor_metro) || 0;
        retorno = totalMetros * vMetro;
        formula = `${totalMetros.toFixed(1)}m × R$ ${vMetro.toFixed(2)}/m`;
        params = { valorMetro: vMetro, metros: totalMetros };
        break;
      }
      case 'FATOR_DIAMETRO_METRO': {
        const fator = Number(servico.fator_financeiro) || 0;
        const diametro = Number(servico.diametro_furo_mm) || 0;
        // Fórmula: (Fator x Diâmetro) x Metros
        const precoPorMetro = fator * diametro;
        retorno = precoPorMetro * totalMetros;
        formula = `(${fator} × ${diametro}mm) × ${totalMetros.toFixed(1)}m = R$ ${precoPorMetro.toFixed(2)}/m`;
        params = { fator, diametroMm: diametro, precoPorMetro, metros: totalMetros };
        break;
      }
      case 'VALOR_FECHADO': {
        const valorFechado = Number(servico.valor_total_fechado) || 0;
        const metaTotal = Number(servico.metragem_prevista_total) || 1;
        const progresso = Math.min(1, totalMetros / metaTotal);
        retorno = progresso * valorFechado;
        formula = `(${totalMetros.toFixed(1)}m / ${metaTotal.toFixed(1)}m [${(progresso * 100).toFixed(1)}%]) × R$ ${valorFechado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        params = { valorFechado, metaTotal, progressoPercentual: progresso * 100, metros: totalMetros };
        break;
      }
      default:
        retorno = 0;
        formula = 'Cenário não configurado';
    }

    return { retorno, formula, params };
  }

  /**
   * Consolida métricas de todos os serviços para o Dashboard do Gestor (Eduardo e Carlos)
   */
  public static async getDashboardMetrics(): Promise<DashboardGestorMetrics> {
    const servicos = await DBManager.getServicos();
    const todosFuros = await DBManager.getFuros();
    
    // Buscar todas as barras
    const barrasPorFuro: Record<string, TecnodrillBarra[]> = {};
    for (const f of todosFuros) {
      barrasPorFuro[f.id] = await DBManager.getBarras(f.id);
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let totalMetrosGeral = 0;
    let totalRetornoGeral = 0;
    let totalMetasAvaliadas = 0;
    let totalMetasBatidas = 0;

    const servicosResumo: ResumoFinanceiroServico[] = [];
    const diarioMap: Record<string, { metros: number; retorno: number }> = {};

    for (const s of servicos) {
      const furosDoServico = todosFuros.filter(f => f.servico_id === s.id);
      let metrosServico = 0;
      let metrosPeriodoAtual = 0;

      for (const furo of furosDoServico) {
        const barras = barrasPorFuro[furo.id] || [];
        for (const b of barras) {
          const m = Number(b.metros) || 3;
          metrosServico += m;
          totalMetrosGeral += m;

          const dataBarra = b.horario_registro ? b.horario_registro.split('T')[0] : hojeStr;
          const dataBarraObj = b.horario_registro ? new Date(b.horario_registro) : new Date();

          // Contagem do período de metas
          if (s.tipo_meta === 'DIARIA' && dataBarra === hojeStr) {
            metrosPeriodoAtual += m;
          } else if (s.tipo_meta === 'SEMANAL' && dataBarraObj >= seteDiasAtras) {
            metrosPeriodoAtual += m;
          }

          // Agrupamento diário
          if (!diarioMap[dataBarra]) {
            diarioMap[dataBarra] = { metros: 0, retorno: 0 };
          }
          diarioMap[dataBarra].metros += m;
        }
      }

      const calc = this.calcularRetornoServico(s, metrosServico);
      totalRetornoGeral += calc.retorno;

      const metaValor = Number(s.meta_metros) || 54;
      const percentualMeta = metaValor > 0 ? (metrosPeriodoAtual / metaValor) * 100 : 0;
      const metaBatida = metrosPeriodoAtual >= metaValor && metaValor > 0;

      if (metaValor > 0) {
        totalMetasAvaliadas++;
        if (metaBatida) totalMetasBatidas++;
      }

      const prevTotal = Number(s.metragem_prevista_total) || 1;
      const pctConcluido = Math.min(100, (metrosServico / prevTotal) * 100);

      servicosResumo.push({
        servicoId: s.id,
        nome: s.nome,
        cliente: s.cliente,
        cenarioFinanceiro: s.cenario_financeiro,
        metrosExecutados: metrosServico,
        metragemPrevistaTotal: Number(s.metragem_prevista_total) || 0,
        percentualConcluido: pctConcluido,
        retornoFinanceiroCalculado: calc.retorno,
        detalhesCalculo: {
          formula: calc.formula,
          parametros: calc.params
        },
        meta: {
          tipo: s.tipo_meta,
          valorMetaMetros: metaValor,
          metrosPeriodoAtual,
          percentualMetaPeriodo: Math.min(100, percentualMeta),
          metaAtingida: metaBatida
        }
      });
    }

    // Gerar evolução diária ordenada
    const evolucaoDiaria = Object.keys(diarioMap)
      .sort()
      .slice(-14) // últimos 14 dias
      .map(dt => {
        const item = diarioMap[dt];
        return {
          data: dt,
          metros: item.metros,
          retorno: item.metros * 120 // média ponderada para o gráfico diário
        };
      });

    return {
      totalMetrosPerfurados: totalMetrosGeral,
      totalRetornoFinanceiro: totalRetornoGeral,
      totalServicosAtivos: servicos.filter(s => s.status === 'EM_ANDAMENTO').length,
      totalFurosFinalizados: todosFuros.filter(f => f.status === 'FINALIZADO').length,
      taxaAtingimentoMetas: totalMetasAvaliadas > 0 ? Math.round((totalMetasBatidas / totalMetasAvaliadas) * 100) : 100,
      servicos: servicosResumo,
      evolucaoDiaria
    };
  }
}
