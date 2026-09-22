import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { Servico, Barra, TipoServico } from '../types';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Download, 
  HardHat, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  PieChart, 
  BarChart2, 
  Search, 
  Layers, 
  Droplet, 
  Milestone, 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface ProdutividadePageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
  onSelectServico?: (id: string) => void;
}

type PeriodoFiltro = 'HOJE' | 'SEMANA' | 'MES' | 'GERAL';
type MetricaGrafico = 'METROS' | 'RECEITA';

export const ProdutividadePage: React.FC<ProdutividadePageProps> = ({ setHeaderInfo, onSelectServico }) => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barrasPorServico, setBarrasPorServico] = useState<Record<string, Barra[]>>({});
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('GERAL');
  const [tipoFiltro, setTipoFiltro] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [metricaGrafico, setMetricaGrafico] = useState<MetricaGrafico>('METROS');

  useEffect(() => {
    setHeaderInfo('Painel de Produtividade & Custos', 'Gestão financeira e operacional por período');
  }, [setHeaderInfo]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const servs = await ApiService.getServicos();
        setServicos(servs);

        const barrasMap: Record<string, Barra[]> = {};
        for (const s of servs) {
          try {
            const furos = await ApiService.getFuros(s.id);
            const bList: Barra[] = [];
            for (const f of furos) {
              const b = await ApiService.getBarras(f.id);
              bList.push(...b);
            }
            barrasMap[s.id] = bList;
          } catch (_) {
            barrasMap[s.id] = [];
          }
        }
        setBarrasPorServico(barrasMap);
      } catch (err) {
        console.error('Erro ao carregar produtividade:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Datas de referência para filtro de período
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => now.toISOString().split('T')[0], [now]);
  
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }, [now]);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }, [now]);

  // Função para verificar se a barra pertence ao período selecionado
  const isBarraInPeriodo = (b: Barra, p: PeriodoFiltro): boolean => {
    if (p === 'GERAL') return true;
    const rawDate = b.created_at || b.data_registro || b.horario_registro;
    if (!rawDate) return false;

    if (p === 'HOJE') {
      return rawDate.startsWith(todayStr);
    }
    const bDate = new Date(rawDate);
    if (isNaN(bDate.getTime())) return false;

    if (p === 'SEMANA') {
      return bDate >= sevenDaysAgo;
    }
    if (p === 'MES') {
      return bDate >= thirtyDaysAgo;
    }
    return true;
  };


  // Cálculos consolidados por serviço
  const servicosCalculados = useMemo(() => {
    return servicos.map(s => {
      const allBarras = barrasPorServico[s.id] || [];
      const barrasPeriodo = allBarras.filter(b => isBarraInPeriodo(b, periodo));

      // Metros acumulados no período
      const metrosPeriodo = barrasPeriodo.reduce((acc, b) => {
        if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
        return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }, 0);

      // Metros totais acumulados de todo o histórico da obra
      const metrosTotais = allBarras.reduce((acc, b) => {
        if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
        return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }, 0);

      const totalPrevisto = Number(s.metragem_prevista_total) || 1000;
      const metaDiaria = Number(s.meta_metros) || 100;
      const percentualConcluido = totalPrevisto > 0 ? Math.min(100, Math.round((metrosTotais / totalPrevisto) * 100)) : 0;

      // Cálculo de Receita para o período
      let receitaPeriodo = 0;
      if (s.cenario_financeiro === 'VALOR_METRO') {
        receitaPeriodo = metrosPeriodo * (Number(s.valor_metro) || 0);
      } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
        const diam = Number(s.diametro_furo_mm) || 150;
        receitaPeriodo = metrosPeriodo * (Number(s.fator_financeiro) || 0) * diam;
      } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
        const valFechado = Number(s.valor_total_fechado) || 0;
        receitaPeriodo = totalPrevisto > 0 ? (metrosPeriodo / totalPrevisto) * valFechado : 0;
      }

      // Custo operacional baseado unicamente no valor por metro perfurado
      const custoMetro = Number(s.custo_metro) || 0;
      const custoPeriodo = metrosPeriodo * custoMetro;
      const margemPeriodo = receitaPeriodo - custoPeriodo;
      const margemPercentual = receitaPeriodo > 0 ? (margemPeriodo / receitaPeriodo) * 100 : 0;

      const tipo: TipoServico = s.tipo_servico || (s.nome?.toUpperCase().includes('SANEAMENTO') ? 'SANEAMENTO' : 'TELECOM');

      return {
        ...s,
        tipo_servico: tipo,
        metrosPeriodo,
        metrosTotais,
        totalPrevisto,
        percentualConcluido,
        receitaPeriodo,
        custoMetro,
        custoPeriodo,
        margemPeriodo,
        margemPercentual,
        qtdRegistrosPeriodo: barrasPeriodo.length,
        qtdCaixasPeriodo: barrasPeriodo.filter(b => b.tem_caixa || b.tipo_registro === 'CAIXA').length
      };
    });
  }, [servicos, barrasPorServico, periodo]);

  // Filtragem por busca e por tipo
  const servicosFiltrados = useMemo(() => {
    return servicosCalculados.filter(s => {
      const matchTipo = tipoFiltro === 'TODOS' || s.tipo_servico === tipoFiltro;
      const matchSearch = searchTerm.trim() === '' || 
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.cidade && s.cidade.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchTipo && matchSearch;
    });
  }, [servicosCalculados, tipoFiltro, searchTerm]);

  // Totais consolidados do painel
  const totais = useMemo(() => {
    const totalReceita = servicosFiltrados.reduce((acc, s) => acc + s.receitaPeriodo, 0);
    const totalCusto = servicosFiltrados.reduce((acc, s) => acc + s.custoPeriodo, 0);
    const totalMargem = totalReceita - totalCusto;
    const margemPercentualGeral = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;
    const totalMetros = servicosFiltrados.reduce((acc, s) => acc + s.metrosPeriodo, 0);
    const totalRegistros = servicosFiltrados.reduce((acc, s) => acc + s.qtdRegistrosPeriodo, 0);
    const totalCaixas = servicosFiltrados.reduce((acc, s) => acc + s.qtdCaixasPeriodo, 0);

    return {
      totalReceita,
      totalCusto,
      totalMargem,
      margemPercentualGeral,
      totalMetros,
      totalRegistros,
      totalCaixas
    };
  }, [servicosFiltrados]);

  // Distribuição por Tipo de Serviço (Saneamento, Rodovia, Telecom)
  const distribuicaoPorTipo = useMemo(() => {
    const tipos: Record<TipoServico, { metros: number; receita: number; custo: number; count: number }> = {
      SANEAMENTO: { metros: 0, receita: 0, custo: 0, count: 0 },
      RODOVIA: { metros: 0, receita: 0, custo: 0, count: 0 },
      TELECOM: { metros: 0, receita: 0, custo: 0, count: 0 },
    };

    servicosFiltrados.forEach(s => {
      const t = s.tipo_servico as TipoServico;
      if (tipos[t]) {
        tipos[t].metros += s.metrosPeriodo;
        tipos[t].receita += s.receitaPeriodo;
        tipos[t].custo += s.custoPeriodo;
        tipos[t].count += 1;
      }
    });

    const totalValMetros = Object.values(tipos).reduce((acc, curr) => acc + curr.metros, 0) || 1;
    const totalValReceita = Object.values(tipos).reduce((acc, curr) => acc + curr.receita, 0) || 1;

    return {
      saneamento: {
        ...tipos.SANEAMENTO,
        pctMetros: Math.round((tipos.SANEAMENTO.metros / totalValMetros) * 100),
        pctReceita: Math.round((tipos.SANEAMENTO.receita / totalValReceita) * 100)
      },
      rodovia: {
        ...tipos.RODOVIA,
        pctMetros: Math.round((tipos.RODOVIA.metros / totalValMetros) * 100),
        pctReceita: Math.round((tipos.RODOVIA.receita / totalValReceita) * 100)
      },
      telecom: {
        ...tipos.TELECOM,
        pctMetros: Math.round((tipos.TELECOM.metros / totalValMetros) * 100),
        pctReceita: Math.round((tipos.TELECOM.receita / totalValReceita) * 100)
      }
    };
  }, [servicosFiltrados]);

  // Exportação para Excel (.xlsx) sem fotos
  const handleExportExcel = () => {
    const dataToExport = servicosFiltrados.map(s => ({
      'Código': s.id,
      'Serviço': s.nome,
      'Cliente': s.cliente,
      'Tipo de Serviço': s.tipo_servico,
      'UF': s.uf || 'SP',
      'Cidade': s.cidade || '',
      'Status': s.status,
      'Metros Previstos (m)': s.totalPrevisto,
      'Metros Período (m)': Number(s.metrosPeriodo.toFixed(1)),
      'Metros Totais (m)': Number(s.metrosTotais.toFixed(1)),
      'Progresso (%)': `${s.percentualConcluido}%`,
      'Receita Estimada (R$)': Number(s.receitaPeriodo.toFixed(2)),
      'Custo / Metro (R$/m)': Number((s.custoMetro || 0).toFixed(2)),
      'Custo no Período (R$)': Number(s.custoPeriodo.toFixed(2)),
      'Margem Estimada (R$)': Number(s.margemPeriodo.toFixed(2)),
      'Margem (%)': `${s.margemPercentual.toFixed(1)}%`,
      'Registros no Período': s.qtdRegistrosPeriodo,
      'Caixas no Período': s.qtdCaixasPeriodo
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Ajustar largura automática das colunas
    const colWidths = [
      { wch: 10 }, // Código
      { wch: 30 }, // Serviço
      { wch: 22 }, // Cliente
      { wch: 14 }, // Tipo
      { wch: 6 },  // UF
      { wch: 18 }, // Cidade
      { wch: 14 }, // Status
      { wch: 18 }, // Metros Previstos
      { wch: 18 }, // Metros Período
      { wch: 16 }, // Metros Totais
      { wch: 14 }, // Progresso
      { wch: 20 }, // Receita
      { wch: 20 }, // Custo Diário
      { wch: 22 }, // Custo Projetado
      { wch: 20 }, // Margem
      { wch: 12 }, // Margem %
      { wch: 18 }, // Registros
      { wch: 16 }, // Caixas
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtividade');
    
    const periodoNome = periodo.toLowerCase();
    const dataStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Produtividade_TecnoDrill_${periodoNome}_${dataStr}.xlsx`);
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton" style={{ height: '70px', borderRadius: '12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '110px', borderRadius: '12px' }} />
        </div>
        <div className="skeleton" style={{ height: '220px', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* 1. TOPO: CONTROLES DE PERÍODO & BOTÃO EXCEL */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '14px',
        backgroundColor: 'var(--bg-card)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Toggle de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={13} color="var(--primary)" />
            Período:
          </span>
          {[
            { id: 'HOJE', label: 'Hoje (Diário)' },
            { id: 'SEMANA', label: 'Esta Semana' },
            { id: 'MES', label: 'Este Mês' },
            { id: 'GERAL', label: 'Geral (Acumulado)' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriodo(tab.id as PeriodoFiltro)}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: periodo === tab.id ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: periodo === tab.id ? 'rgba(240, 90, 34, 0.15)' : 'var(--bg-app)',
                color: periodo === tab.id ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Botão Exportar Excel */}
        <button
          type="button"
          onClick={handleExportExcel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#27AE60',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '12.5px',
            padding: '9px 18px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(39, 174, 96, 0.35)',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#219653'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27AE60'}
        >
          <Download size={15} />
          <span>Exportar Relatório Excel (.xlsx)</span>
        </button>
      </div>

      {/* 2. CARDS COM TOTAIS FINANCEIRO & OPERACIONAIS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '14px' 
      }}>
        
        {/* Card 1: Receita Estimada */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid rgba(46, 204, 113, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#2ECC71' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Receita no Período
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(46, 204, 113, 0.15)', color: '#2ECC71' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 900, color: '#2ECC71', fontFamily: 'var(--font-mono)' }}>
            R$ {totais.totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Faturamento baseado na produção
          </span>
        </div>

        {/* Card 2: Custo Projetado */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#E74C3C' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Custo Operacional
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(231, 76, 60, 0.15)', color: '#E74C3C' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 900, color: '#E74C3C', fontFamily: 'var(--font-mono)' }}>
            R$ {totais.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Equipe, diesel, máquina e outros
          </span>
        </div>

        {/* Card 3: Margem Líquida */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${totais.totalMargem >= 0 ? 'rgba(39, 174, 96, 0.4)' : 'rgba(231, 76, 60, 0.4)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: totais.totalMargem >= 0 ? 'var(--success)' : 'var(--danger)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Margem Líquida
            </span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              padding: '2px 8px', 
              borderRadius: '4px',
              backgroundColor: totais.totalMargem >= 0 ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
              color: totais.totalMargem >= 0 ? 'var(--success)' : 'var(--danger)'
            }}>
              {totais.margemPercentualGeral.toFixed(1)}%
            </span>
          </div>
          <strong style={{ 
            fontSize: '24px', 
            fontWeight: 900, 
            color: totais.totalMargem >= 0 ? 'var(--success)' : 'var(--danger)', 
            fontFamily: 'var(--font-mono)' 
          }}>
            R$ {totais.totalMargem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totais.totalMargem >= 0 ? 'Resultado positivo (lucro estimado)' : 'Alerta: Custo supera receita no período'}
          </span>
        </div>

        {/* Card 4: Metros Perfurados */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid rgba(240, 90, 34, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Metros Perfurados
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
              <Milestone size={16} />
            </div>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            {totais.totalMetros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
          </strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totais.totalRegistros} apontamentos • {totais.totalCaixas} caixas
          </span>
        </div>

      </div>

      {/* 3. GRÁFICO / DISTRIBUIÇÃO POR TIPO DE SERVIÇO (Saneamento, Rodovia, Telecom) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} color="var(--primary)" />
              Distribuição por Tipo de Serviço
            </h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Comparativo de produtividade e faturamento entre segmentos
            </span>
          </div>

          {/* Toggle Metros vs Receita */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setMetricaGrafico('METROS')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: metricaGrafico === 'METROS' ? 'var(--primary)' : 'transparent',
                color: metricaGrafico === 'METROS' ? '#FFFFFF' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Por Metros (m)
            </button>
            <button
              type="button"
              onClick={() => setMetricaGrafico('RECEITA')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: metricaGrafico === 'RECEITA' ? 'var(--primary)' : 'transparent',
                color: metricaGrafico === 'RECEITA' ? '#FFFFFF' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Por Receita (R$)
            </button>
          </div>
        </div>

        {/* Barras de Distribuição Visuais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Segmento 1: SANEAMENTO */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#3498DB', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Droplet size={14} />
                Saneamento
              </span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {distribuicaoPorTipo.saneamento.count} serviço(s)
                </span>
                <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  {metricaGrafico === 'METROS' 
                    ? `${distribuicaoPorTipo.saneamento.metros.toFixed(1)} m (${distribuicaoPorTipo.saneamento.pctMetros}%)`
                    : `R$ ${distribuicaoPorTipo.saneamento.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${distribuicaoPorTipo.saneamento.pctReceita}%)`}
                </strong>
              </div>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${metricaGrafico === 'METROS' ? distribuicaoPorTipo.saneamento.pctMetros : distribuicaoPorTipo.saneamento.pctReceita}%`,
                  background: 'linear-gradient(90deg, #2980B9, #3498DB)',
                  borderRadius: '5px',
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>
          </div>

          {/* Segmento 2: RODOVIA */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#E67E22', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Milestone size={14} />
                Rodovia
              </span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {distribuicaoPorTipo.rodovia.count} serviço(s)
                </span>
                <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  {metricaGrafico === 'METROS' 
                    ? `${distribuicaoPorTipo.rodovia.metros.toFixed(1)} m (${distribuicaoPorTipo.rodovia.pctMetros}%)`
                    : `R$ ${distribuicaoPorTipo.rodovia.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${distribuicaoPorTipo.rodovia.pctReceita}%)`}
                </strong>
              </div>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${metricaGrafico === 'METROS' ? distribuicaoPorTipo.rodovia.pctMetros : distribuicaoPorTipo.rodovia.pctReceita}%`,
                  background: 'linear-gradient(90deg, #D35400, #E67E22)',
                  borderRadius: '5px',
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>
          </div>

          {/* Segmento 3: TELECOM */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#9B59B6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} />
                Telecom
              </span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {distribuicaoPorTipo.telecom.count} serviço(s)
                </span>
                <strong style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  {metricaGrafico === 'METROS' 
                    ? `${distribuicaoPorTipo.telecom.metros.toFixed(1)} m (${distribuicaoPorTipo.telecom.pctMetros}%)`
                    : `R$ ${distribuicaoPorTipo.telecom.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${distribuicaoPorTipo.telecom.pctReceita}%)`}
                </strong>
              </div>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${metricaGrafico === 'METROS' ? distribuicaoPorTipo.telecom.pctMetros : distribuicaoPorTipo.telecom.pctReceita}%`,
                  background: 'linear-gradient(90deg, #8E44AD, #9B59B6)',
                  borderRadius: '5px',
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>
          </div>

        </div>
      </div>

      {/* 4. FILTROS & TABELA DE PRODUTIVIDADE POR SERVIÇO */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        {/* Barra de Filtros da Tabela */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} color="var(--primary)" />
              Detalhamento Operacional & Financeiro por Serviço
            </h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {servicosFiltrados.length} serviço(s) exibido(s)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Campo de Busca */}
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar serviço ou cliente..."
                style={{
                  width: '100%',
                  fontSize: '12px',
                  padding: '7px 10px 7px 30px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Filtro por Tipo */}
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '7px 12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px'
              }}
            >
              <option value="TODOS">Todos os Segmentos</option>
              <option value="SANEAMENTO">💧 Saneamento</option>
              <option value="RODOVIA">🛣️ Rodovia</option>
              <option value="TELECOM">📡 Telecom</option>
            </select>
          </div>
        </div>

        {/* Tabela Responsiva */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '10px 12px' }}>Serviço / Cliente</th>
                <th style={{ padding: '10px 12px' }}>Segmento</th>
                <th style={{ padding: '10px 12px' }}>Progresso da Obra</th>
                <th style={{ padding: '10px 12px' }}>Metros (Período)</th>
                <th style={{ padding: '10px 12px' }}>Receita (R$)</th>
                <th style={{ padding: '10px 12px' }}>Custo (R$)</th>
                <th style={{ padding: '10px 12px' }}>Margem (R$ / %)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {servicosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                servicosFiltrados.map(s => {
                  const badgeColor = 
                    s.tipo_servico === 'SANEAMENTO' ? '#3498DB' :
                    s.tipo_servico === 'RODOVIA' ? '#E67E22' : '#9B59B6';

                  return (
                    <tr 
                      key={s.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Nome e Cliente */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#FFFFFF', fontSize: '13px' }}>
                            {s.nome}
                          </strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {s.cliente} • {s.cidade || 'Brasil'} - {s.uf || 'SP'}
                          </span>
                        </div>
                      </td>

                      {/* Segmento */}
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: `${badgeColor}22`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}44`
                        }}>
                          {s.tipo_servico}
                        </span>
                      </td>

                      {/* Progresso Total */}
                      <td style={{ padding: '12px', minWidth: '130px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{s.metrosTotais.toFixed(0)}m</span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{s.percentualConcluido}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                height: '100%', 
                                width: `${s.percentualConcluido}%`, 
                                backgroundColor: s.percentualConcluido >= 100 ? 'var(--success)' : 'var(--primary)',
                                borderRadius: '3px' 
                              }} 
                            />
                          </div>
                        </div>
                      </td>

                      {/* Metros no Período */}
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {s.metrosPeriodo.toFixed(1)} m
                      </td>

                      {/* Receita no Período */}
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2ECC71' }}>
                        R$ {s.receitaPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Custo no Período */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E74C3C' }}>
                            R$ {s.custoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            R$ {s.custoMetro.toFixed(2)}/m
                          </span>
                        </div>
                      </td>

                      {/* Margem no Período */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontWeight: 800, 
                            color: s.margemPeriodo >= 0 ? 'var(--success)' : 'var(--danger)' 
                          }}>
                            R$ {s.margemPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            ({s.margemPercentual.toFixed(1)}%)
                          </span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onSelectServico && onSelectServico(s.id)}
                          title="Ver detalhes da obra"
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Ver</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
