import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { Servico, Barra, TipoServico } from '../types';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Download, 
  HardHat, 
  Scale,
  Search, 
  Layers, 
  Droplet, 
  Milestone, 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  RefreshCw,
  Coins
} from 'lucide-react';

interface ProdutividadePageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
  onSelectServico?: (id: string) => void;
}

type PeriodoRapido = 'HOJE' | 'SEMANA' | 'MES' | 'ANO' | 'GERAL' | 'CUSTOM';
type MetricaEvolucao = 'FINANCEIRO' | 'METROS';
type GranularidadeEvolucao = 'MENSAL' | 'SEMANAL' | 'DIARIO';

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const CORES_SEGMENTO: Record<string, string> = {
  SANEAMENTO: '#00B4D8',
  RODOVIA: '#F39C12',
  TELECOM: '#9B59B6'
};

export const ProdutividadePage: React.FC<ProdutividadePageProps> = ({ setHeaderInfo, onSelectServico }) => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barrasPorServico, setBarrasPorServico] = useState<Record<string, Barra[]>>({});
  const [loading, setLoading] = useState(true);

  // Filtros no topo (Estilo BI JLE)
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();

  const [filtroAno, setFiltroAno] = useState<string>(currentYear);
  const [filtroMes, setFiltroMes] = useState<string>('TODOS');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('TODOS');
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>('ANO');
  const [searchTerm, setSearchTerm] = useState('');

  // Controles de Gráficos (Estilo BI JLE)
  const [metricaEvolucao, setMetricaEvolucao] = useState<MetricaEvolucao>('FINANCEIRO');
  const [granularidade, setGranularidade] = useState<GranularidadeEvolucao>('MENSAL');
  const [metricaSegmento, setMetricaSegmento] = useState<'RECEITA' | 'METROS'>('RECEITA');

  useEffect(() => {
    setHeaderInfo('Painel de Produtividade & Custos', 'Dashboard Analítico de Produção e Performance Financeira');
  }, [setHeaderInfo]);

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      const servs = await ApiService.getServicos();
      setServicos(servs);

      const barrasMap: Record<string, Barra[]> = {};
      await Promise.all(
        servs.map(async (s) => {
          try {
            const furos = await ApiService.getFuros(s.id);
            const bArrays = await Promise.all(
              furos.map(async (f) => {
                const b = await ApiService.getBarras(f.id);
                return b.map(item => ({
                  ...item,
                  data_registro: item.data_registro || item.horario_registro || f.data_furo || ''
                }));
              })
            );
            barrasMap[s.id] = bArrays.flat();
          } catch (_) {
            barrasMap[s.id] = [];
          }
        })
      );
      setBarrasPorServico(barrasMap);
    } catch (err) {
      console.error('Erro ao carregar produtividade:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Anos disponíveis nos dados
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>();
    anos.add(currentYear);
    anos.add((Number(currentYear) - 1).toString());

    Object.values(barrasPorServico).forEach(barras => {
      barras.forEach(b => {
        const rawDate = b.horario_registro || b.data_registro || b.created_at;
        if (rawDate) {
          const y = new Date(rawDate).getFullYear();
          if (!isNaN(y) && y > 2000 && y < 2100) {
            anos.add(y.toString());
          }
        }
      });
    });

    return Array.from(anos).sort((a, b) => Number(b) - Number(a));
  }, [barrasPorServico, currentYear]);

  // Datas de referência para períodos rápidos
  const now = useMemo(() => new Date(), []);
  
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  // Função para verificar se a barra pertence ao filtro ativo
  const isBarraInFilter = (b: Barra): boolean => {
    const rawDate = b.horario_registro || b.data_registro || b.created_at;
    if (!rawDate) return periodoRapido === 'GERAL';

    const bDate = new Date(rawDate);
    if (isNaN(bDate.getTime())) return periodoRapido === 'GERAL';

    // Filtro por Período Rápido
    if (periodoRapido === 'HOJE') {
      return (
        bDate.getFullYear() === now.getFullYear() &&
        bDate.getMonth() === now.getMonth() &&
        bDate.getDate() === now.getDate()
      );
    }
    if (periodoRapido === 'SEMANA') {
      return bDate >= sevenDaysAgo;
    }
    if (periodoRapido === 'GERAL') {
      return true;
    }

    // Filtro por Ano e Mês selecionados
    const bYear = bDate.getFullYear().toString();
    const bMonth = (bDate.getMonth() + 1).toString();

    if (filtroAno !== 'TODOS' && bYear !== filtroAno) {
      return false;
    }

    if (filtroMes !== 'TODOS' && bMonth !== filtroMes) {
      return false;
    }

    return true;
  };

  // Manipuladores de Filtros Rápidos (Estilo BI JLE)
  const handleSelectPeriodoRapido = (p: PeriodoRapido) => {
    setPeriodoRapido(p);
    if (p === 'HOJE') {
      setFiltroAno(currentYear);
      setFiltroMes(currentMonth);
    } else if (p === 'SEMANA') {
      setFiltroAno(currentYear);
      setFiltroMes('TODOS');
    } else if (p === 'MES') {
      setFiltroAno(currentYear);
      setFiltroMes(currentMonth);
    } else if (p === 'ANO') {
      setFiltroAno(currentYear);
      setFiltroMes('TODOS');
    } else if (p === 'GERAL') {
      setFiltroAno('TODOS');
      setFiltroMes('TODOS');
    }
  };

  // Cálculos consolidados por serviço
  const servicosCalculados = useMemo(() => {
    return servicos.map(s => {
      const allBarras = barrasPorServico[s.id] || [];
      const barrasPeriodo = allBarras.filter(b => isBarraInFilter(b));

      // Metros acumulados no período filtrado
      const metrosPeriodo = barrasPeriodo.reduce((acc, b) => {
        if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
        return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }, 0);

      // Metros totais acumulados de toda a história da obra
      const metrosTotais = allBarras.reduce((acc, b) => {
        if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
        return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }, 0);

      const totalPrevisto = Number(s.metragem_prevista_total) || 1000;
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
  }, [servicos, barrasPorServico, periodoRapido, filtroAno, filtroMes, todayStr, sevenDaysAgo]);

  // Filtragem por busca e por segmento
  const servicosFiltrados = useMemo(() => {
    return servicosCalculados.filter(s => {
      const matchTipo = filtroSegmento === 'TODOS' || s.tipo_servico === filtroSegmento;
      const matchSearch = searchTerm.trim() === '' || 
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.cidade && s.cidade.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchTipo && matchSearch;
    });
  }, [servicosCalculados, filtroSegmento, searchTerm]);

  // Totais consolidados dos KPIs
  const totais = useMemo(() => {
    const totalReceita = servicosFiltrados.reduce((acc, s) => acc + s.receitaPeriodo, 0);
    const totalCusto = servicosFiltrados.reduce((acc, s) => acc + s.custoPeriodo, 0);
    const totalMargem = totalReceita - totalCusto;
    const margemPercentualGeral = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;
    const totalMetros = servicosFiltrados.reduce((acc, s) => acc + s.metrosPeriodo, 0);
    const totalRegistros = servicosFiltrados.reduce((acc, s) => acc + s.qtdRegistrosPeriodo, 0);
    const totalCaixas = servicosFiltrados.reduce((acc, s) => acc + s.qtdCaixasPeriodo, 0);
    const custoMedioPorMetro = totalMetros > 0 ? totalCusto / totalMetros : 0;

    return {
      totalReceita,
      totalCusto,
      totalMargem,
      margemPercentualGeral,
      totalMetros,
      totalRegistros,
      totalCaixas,
      custoMedioPorMetro
    };
  }, [servicosFiltrados]);

  // Dados para o Gráfico de Evolução (12 meses do ano ou granularidade selecionada)
  const dadosEvolucao = useMemo(() => {
    const targetYear = filtroAno !== 'TODOS' ? filtroAno : currentYear;

    if (granularidade === 'MENSAL') {
      // 12 Meses do ano selecionado
      const mesesData = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        let metros = 0;
        let receita = 0;
        let custo = 0;

        servicosFiltrados.forEach(s => {
          const barras = barrasPorServico[s.id] || [];
          barras.forEach(b => {
            const raw = b.horario_registro || b.data_registro || b.created_at;
            if (!raw) return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;

            const bYear = d.getFullYear().toString();
            const bMonth = d.getMonth() + 1;

            if (bYear === targetYear && bMonth === monthNum) {
              const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
              metros += m;

              // Receita
              let rec = 0;
              if (s.cenario_financeiro === 'VALOR_METRO') {
                rec = m * (Number(s.valor_metro) || 0);
              } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
                rec = m * (Number(s.fator_financeiro) || 0) * (Number(s.diametro_furo_mm) || 150);
              } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
                const prev = Number(s.metragem_prevista_total) || 1000;
                rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
              }
              receita += rec;
              custo += m * (Number(s.custo_metro) || 0);
            }
          });
        });

        const margem = receita - custo;

        return {
          label: MESES_SHORT[i],
          nomeMes: MESES_LABEL[i],
          mesNum,
          metros: Number(metros.toFixed(1)),
          receita: Number(receita.toFixed(2)),
          custo: Number(custo.toFixed(2)),
          margem: Number(margem.toFixed(2))
        };
      });

      return mesesData;
    }

    if (granularidade === 'SEMANAL') {
      // 5 Semanas do mês selecionado
      const targetMonthNum = filtroMes !== 'TODOS' ? Number(filtroMes) : Number(currentMonth);
      const semanas = [
        { label: 'Sem 1 (1-7)', min: 1, max: 7 },
        { label: 'Sem 2 (8-14)', min: 8, max: 14 },
        { label: 'Sem 3 (15-21)', min: 15, max: 21 },
        { label: 'Sem 4 (22-28)', min: 22, max: 28 },
        { label: 'Sem 5 (29-31)', min: 29, max: 31 }
      ];

      return semanas.map(sem => {
        let metros = 0;
        let receita = 0;
        let custo = 0;

        servicosFiltrados.forEach(s => {
          const barras = barrasPorServico[s.id] || [];
          barras.forEach(b => {
            const raw = b.horario_registro || b.data_registro || b.created_at;
            if (!raw) return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;

            const bYear = d.getFullYear().toString();
            const bMonth = d.getMonth() + 1;
            const bDay = d.getDate();

            if (bYear === targetYear && bMonth === targetMonthNum && bDay >= sem.min && bDay <= sem.max) {
              const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
              metros += m;
              let rec = 0;
              if (s.cenario_financeiro === 'VALOR_METRO') {
                rec = m * (Number(s.valor_metro) || 0);
              } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
                rec = m * (Number(s.fator_financeiro) || 0) * (Number(s.diametro_furo_mm) || 150);
              } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
                const prev = Number(s.metragem_prevista_total) || 1000;
                rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
              }
              receita += rec;
              custo += m * (Number(s.custo_metro) || 0);
            }
          });
        });

        return {
          label: sem.label,
          metros: Number(metros.toFixed(1)),
          receita: Number(receita.toFixed(2)),
          custo: Number(custo.toFixed(2)),
          margem: Number((receita - custo).toFixed(2))
        };
      });
    }

    // Diário (dias 1 a 31)
    const targetMonthNum = filtroMes !== 'TODOS' ? Number(filtroMes) : Number(currentMonth);
    const daysInMonth = new Date(Number(targetYear), targetMonthNum, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      let metros = 0;
      let receita = 0;
      let custo = 0;

      servicosFiltrados.forEach(s => {
        const barras = barrasPorServico[s.id] || [];
        barras.forEach(b => {
          const raw = b.horario_registro || b.data_registro || b.created_at;
          if (!raw) return;
          const d = new Date(raw);
          if (isNaN(d.getTime())) return;

          const bYear = d.getFullYear().toString();
          const bMonth = d.getMonth() + 1;
          const bDay = d.getDate();

          if (bYear === targetYear && bMonth === targetMonthNum && bDay === day) {
            const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
            metros += m;
            let rec = 0;
            if (s.cenario_financeiro === 'VALOR_METRO') {
              rec = m * (Number(s.valor_metro) || 0);
            } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
              rec = m * (Number(s.fator_financeiro) || 0) * (Number(s.diametro_furo_mm) || 150);
            } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
              const prev = Number(s.metragem_prevista_total) || 1000;
              rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
            }
            receita += rec;
            custo += m * (Number(s.custo_metro) || 0);
          }
        });
      });

      return {
        label: `${day}`,
        metros: Number(metros.toFixed(1)),
        receita: Number(receita.toFixed(2)),
        custo: Number(custo.toFixed(2)),
        margem: Number((receita - custo).toFixed(2))
      };
    });
  }, [servicosFiltrados, barrasPorServico, filtroAno, filtroMes, granularidade, currentYear, currentMonth]);

  // Dados para o Gráfico de Distribuição por Segmento (Donut)
  const dadosSegmentos = useMemo(() => {
    const tipos = {
      SANEAMENTO: { nome: 'Saneamento', icon: '💧', color: '#00B4D8', metros: 0, receita: 0, custo: 0, count: 0 },
      RODOVIA: { nome: 'Rodovia', icon: '🛣️', color: '#F39C12', metros: 0, receita: 0, custo: 0, count: 0 },
      TELECOM: { nome: 'Telecom', icon: '📡', color: '#9B59B6', metros: 0, receita: 0, custo: 0, count: 0 },
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

    return Object.entries(tipos).map(([key, val]) => ({
      key,
      name: val.nome,
      icon: val.icon,
      color: val.color,
      count: val.count,
      metros: Number(val.metros.toFixed(1)),
      receita: Number(val.receita.toFixed(2)),
      custo: Number(val.custo.toFixed(2)),
      value: metricaSegmento === 'RECEITA' ? val.receita : val.metros,
      pct: Math.round(
        metricaSegmento === 'RECEITA'
          ? (val.receita / totalValReceita) * 100
          : (val.metros / totalValMetros) * 100
      )
    }));
  }, [servicosFiltrados, metricaSegmento]);

  // Exportação para Excel (.xlsx) no padrão executivo BI JLE
  const handleExportExcel = () => {
    const dataToExport = servicosFiltrados.map(s => ({
      'Código': s.id,
      'Serviço': s.nome,
      'Cliente': s.cliente,
      'Segmento': s.tipo_servico,
      'UF': s.uf || 'SP',
      'Cidade': s.cidade || '',
      'Status': s.status,
      'Metros Previstos Total (m)': s.totalPrevisto,
      'Metros Executados Período (m)': Number(s.metrosPeriodo.toFixed(1)),
      'Metros Totais Obra (m)': Number(s.metrosTotais.toFixed(1)),
      'Progresso Geral (%)': `${s.percentualConcluido}%`,
      'Receita Estimada (R$)': Number(s.receitaPeriodo.toFixed(2)),
      'Custo por Metro (R$/m)': Number((s.custoMetro || 0).toFixed(2)),
      'Custo Operacional Período (R$)': Number(s.custoPeriodo.toFixed(2)),
      'Margem Líquida (R$)': Number(s.margemPeriodo.toFixed(2)),
      'Margem (%)': `${s.margemPercentual.toFixed(1)}%`,
      'Registros / Barras': s.qtdRegistrosPeriodo,
      'Caixas Instaladas': s.qtdCaixasPeriodo
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const colWidths = [
      { wch: 10 }, // Código
      { wch: 32 }, // Serviço
      { wch: 22 }, // Cliente
      { wch: 15 }, // Segmento
      { wch: 6 },  // UF
      { wch: 20 }, // Cidade
      { wch: 15 }, // Status
      { wch: 20 }, // Metros Previstos
      { wch: 22 }, // Metros Período
      { wch: 20 }, // Metros Totais
      { wch: 16 }, // Progresso %
      { wch: 18 }, // Receita R$
      { wch: 18 }, // Custo/m
      { wch: 22 }, // Custo Período
      { wch: 18 }, // Margem R$
      { wch: 12 }, // Margem %
      { wch: 16 }, // Registros
      { wch: 16 }  // Caixas
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtividade TecnoDrill');

    const dataHojeFormatada = new Date().toISOString().split('T')[0];
    const fileName = `Produtividade_TecnoDrill_${filtroAno}_${filtroMes !== 'TODOS' ? `Mes${filtroMes}` : 'AnoInteiro'}_${dataHojeFormatada}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Formatador curto de moedas para o gráfico
  const formatShortValue = (val: number): string => {
    const a = Math.abs(val);
    if (a >= 1000000) return (a / 1000000).toFixed(1) + 'M';
    if (a >= 1000) return (a / 1000).toFixed(0) + 'k';
    return a.toFixed(0);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
          Carregando indicadores analíticos da TecnoDrill...
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

      {/* ────────────────────────────────────────────────────────────────
          1. BARRA DE FILTROS SUPERIOR (PADRÃO BI JLE FILTER-BAR)
      ────────────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(240, 90, 34, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Filter size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Filtros Analíticos & Competência
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Controle temporal consolidado para medição de produtividade e financeiro
              </span>
            </div>
          </div>

          {/* Botão Exportar Relatório Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#1E7E34',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 126, 52, 0.25)',
              transition: 'var(--transition)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#155D27'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1E7E34'}
          >
            <Download size={15} />
            <span>Exportar Relatório Excel (.xlsx)</span>
          </button>
        </div>

        {/* Dropdowns de Filtro no Topo (Estilo BI JLE) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          
          {/* Filtro de Ano */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              Ano
            </label>
            <select
              value={filtroAno}
              onChange={(e) => {
                setFiltroAno(e.target.value);
                setPeriodoRapido('CUSTOM');
              }}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="TODOS">Todos os Anos</option>
              {anosDisponiveis.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Mês */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              Competência / Mês
            </label>
            <select
              value={filtroMes}
              onChange={(e) => {
                setFiltroMes(e.target.value);
                setPeriodoRapido('CUSTOM');
              }}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="TODOS">Todos os Meses</option>
              {MESES_LABEL.map((nome, idx) => (
                <option key={idx + 1} value={(idx + 1).toString()}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Segmento */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              Segmento
            </label>
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <option value="TODOS">Todos os Segmentos</option>
              <option value="SANEAMENTO">💧 Saneamento</option>
              <option value="RODOVIA">🛣️ Rodovia</option>
              <option value="TELECOM">📡 Telecom</option>
            </select>
          </div>

          {/* Atalhos de Período Rápido (Pills BI JLE) */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              Atalhos Rápidos
            </label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { key: 'HOJE', label: 'Hoje' },
                { key: 'SEMANA', label: 'Semana' },
                { key: 'MES', label: 'Este Mês' },
                { key: 'ANO', label: 'Ano Inteiro' },
                { key: 'GERAL', label: 'Geral' }
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectPeriodoRapido(item.key as PeriodoRapido)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: periodoRapido === item.key ? 800 : 500,
                    backgroundColor: periodoRapido === item.key ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                    color: periodoRapido === item.key ? '#FFFFFF' : 'var(--text-muted)',
                    border: periodoRapido === item.key ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────
          2. CARDS DE KPI (PADRÃO BI JLE)
      ────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Receita no Período */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#2ECC71' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Receita no Período
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#2ECC71', margin: '8px 0 4px 0', fontFamily: 'var(--font-mono)' }}>
                R$ {totais.totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Faturamento baseado na produção
              </span>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(46, 204, 113, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2ECC71' }}>
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        {/* Card 2: Custo Operacional */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#E74C3C' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Custo Operacional
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#E74C3C', margin: '8px 0 4px 0', fontFamily: 'var(--font-mono)' }}>
                R$ {totais.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Custo médio: R$ {totais.custoMedioPorMetro.toFixed(2)}/m
              </span>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(231, 76, 60, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E74C3C' }}>
              <Coins size={20} />
            </div>
          </div>
        </div>

        {/* Card 3: Margem Líquida */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: totais.totalMargem >= 0 ? '#10B981' : '#E74C3C' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Margem Líquida
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  padding: '2px 7px', 
                  borderRadius: '10px', 
                  backgroundColor: totais.totalMargem >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                  color: totais.totalMargem >= 0 ? '#10B981' : '#E74C3C' 
                }}>
                  {totais.margemPercentualGeral.toFixed(1)}%
                </span>
              </div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: 900, 
                color: totais.totalMargem >= 0 ? '#10B981' : '#E74C3C', 
                margin: '8px 0 4px 0', 
                fontFamily: 'var(--font-mono)' 
              }}>
                R$ {totais.totalMargem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {totais.totalMargem >= 0 ? 'Resultado positivo (Lucro estimado)' : 'Resultado em atenção (Custo superou faturamento)'}
              </span>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: totais.totalMargem >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(231, 76, 60, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: totais.totalMargem >= 0 ? '#10B981' : '#E74C3C' }}>
              <Scale size={20} />
            </div>
          </div>
        </div>

        {/* Card 4: Metros Perfurados */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Metros Perfurados
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', margin: '8px 0 4px 0', fontFamily: 'var(--font-mono)' }}>
                {totais.totalMetros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
              </h2>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {totais.totalRegistros} apontamentos • {totais.totalCaixas} caixas
              </span>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(240, 90, 34, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <HardHat size={20} />
            </div>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────
          3. GRÁFICOS ANALÍTICOS (ESTILO BI JLE)
      ────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        
        {/* GRÁFICO 1: EVOLUÇÃO (MENSAL, SEMANAL OU DIÁRIO COM TODOS OS MESES DO ANO) */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
            minHeight: '400px'
          }}
        >
          {/* Header do Gráfico */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="var(--primary)" />
                Evolução {granularidade === 'MENSAL' ? `Mensal de ${filtroAno !== 'TODOS' ? filtroAno : currentYear}` : granularidade === 'SEMANAL' ? 'Semanal' : 'Diária'}
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {metricaEvolucao === 'FINANCEIRO' ? 'Comparativo de Receita, Custo e Margem' : 'Volume de Perfuração em Metros'}
              </span>
            </div>

            {/* Controles do Gráfico (Padrão BI JLE) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              
              {/* Toggle Métrica */}
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setMetricaEvolucao('FINANCEIRO')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: metricaEvolucao === 'FINANCEIRO' ? 'var(--primary)' : 'transparent',
                    color: metricaEvolucao === 'FINANCEIRO' ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Receita × Custo (R$)
                </button>
                <button
                  type="button"
                  onClick={() => setMetricaEvolucao('METROS')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: metricaEvolucao === 'METROS' ? 'var(--primary)' : 'transparent',
                    color: metricaEvolucao === 'METROS' ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Metros (m)
                </button>
              </div>

              {/* Toggle Granularidade */}
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setGranularidade('MENSAL')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: granularidade === 'MENSAL' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: granularidade === 'MENSAL' ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setGranularidade('SEMANAL')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: granularidade === 'SEMANAL' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: granularidade === 'SEMANAL' ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setGranularidade('DIARIO')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: granularidade === 'DIARIO' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: granularidade === 'DIARIO' ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Diário
                </button>
              </div>

            </div>
          </div>

          {/* Gráfico Recharts */}
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {metricaEvolucao === 'FINANCEIRO' ? (
                <ComposedChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#1B3645" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: '#8BA6B5', fontSize: 11 }} 
                    axisLine={{ stroke: '#1B3645' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#8BA6B5', fontSize: 11 }} 
                    axisLine={{ stroke: '#1B3645' }}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${formatShortValue(v)}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0D1C24', 
                      borderColor: '#1B3645', 
                      borderRadius: '8px', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      fontSize: '12px',
                      color: '#FFFFFF'
                    }}
                    formatter={(val: any, name: string) => {
                      const num = Number(val) || 0;
                      return [`R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} 
                  />
                  <Bar dataKey="receita" name="Receita" fill="#2ECC71" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="custo" name="Custo" fill="#E74C3C" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line type="monotone" dataKey="margem" name="Margem Líquida" stroke="#F05A22" strokeWidth={2.5} dot={{ fill: '#F05A22', r: 3 }} />
                </ComposedChart>
              ) : (
                <BarChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#1B3645" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: '#8BA6B5', fontSize: 11 }} 
                    axisLine={{ stroke: '#1B3645' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#8BA6B5', fontSize: 11 }} 
                    axisLine={{ stroke: '#1B3645' }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}m`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0D1C24', 
                      borderColor: '#1B3645', 
                      borderRadius: '8px', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      fontSize: '12px',
                      color: '#FFFFFF'
                    }}
                    formatter={(val: any) => [`${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} metros`, 'Produção']}
                  />
                  <Bar dataKey="metros" name="Metros Perfurados" fill="#F05A22" radius={[4, 4, 0, 0]} maxBarSize={35} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: DISTRIBUIÇÃO POR TIPO DE SERVIÇO (DONUT BI JLE) */}
        <div 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
            minHeight: '400px'
          }}
        >
          {/* Header do Gráfico */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieIcon size={18} color="var(--primary)" />
                Distribuição por Segmento
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Participação de Saneamento, Rodovia e Telecom
              </span>
            </div>

            {/* Toggle Métrica */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setMetricaSegmento('RECEITA')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: metricaSegmento === 'RECEITA' ? 'var(--primary)' : 'transparent',
                  color: metricaSegmento === 'RECEITA' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Por Receita (R$)
              </button>
              <button
                type="button"
                onClick={() => setMetricaSegmento('METROS')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: metricaSegmento === 'METROS' ? 'var(--primary)' : 'transparent',
                  color: metricaSegmento === 'METROS' ? '#FFFFFF' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Por Metros (m)
              </button>
            </div>
          </div>

          {/* Gráfico Donut Recharts + Legenda Lateral */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center', flex: 1 }}>
            
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={dadosSegmentos}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {dadosSegmentos.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0D1C24', 
                      borderColor: '#1B3645', 
                      borderRadius: '8px', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      fontSize: '12px',
                      color: '#FFFFFF'
                    }}
                    formatter={(val: any, name: string) => {
                      const num = Number(val) || 0;
                      return [
                        metricaSegmento === 'RECEITA'
                          ? `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${num.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} metros`,
                        name
                      ];
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda Detalhada dos Segmentos (Padrão BI JLE) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dadosSegmentos.map(item => (
                <div 
                  key={item.key}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>{item.icon}</span>
                      <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{item.name}</strong>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: item.color }}>
                      {item.pct}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>{item.count} obra(s)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>
                      {metricaSegmento === 'RECEITA' 
                        ? `R$ ${item.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : `${item.metros.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────
          4. TABELA DE DETALHAMENTO OPERACIONAL & FINANCEIRO (BI JLE)
      ────────────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Header da Tabela com Busca e Filtro */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--primary)" />
              Detalhamento Operacional & Financeiro por Serviço
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {servicosFiltrados.length} serviço(s) exibido(s) no período
            </span>
          </div>

          {/* Campo de Busca */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Buscar serviço ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 12px 9px 34px',
                fontSize: '12.5px',
                color: 'var(--text-main)'
              }}
            />
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Container da Tabela com Scroll Horizontal Responsivo */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px' }}>Serviço / Cliente</th>
                <th style={{ padding: '12px' }}>Segmento</th>
                <th style={{ padding: '12px' }}>Progresso da Obra</th>
                <th style={{ padding: '12px' }}>Metros (Período)</th>
                <th style={{ padding: '12px' }}>Receita (R$)</th>
                <th style={{ padding: '12px' }}>Custo (R$)</th>
                <th style={{ padding: '12px' }}>Margem (R$ / %)</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {servicosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                servicosFiltrados.map((s) => {
                  const badgeColor = s.tipo_servico === 'SANEAMENTO' ? '#00B4D8' :
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
                            color: s.margemPeriodo >= 0 ? '#10B981' : '#E74C3C' 
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
                            gap: '4px',
                            transition: 'var(--transition)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
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
