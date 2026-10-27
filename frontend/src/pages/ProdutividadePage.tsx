import { summarizeDiameterRevenue } from './produtividadeDiameters';
import { summarizeAuthorRevenue } from './produtividadeAuthors';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiService, parseBarraObservacao } from '../services/api';
import { Servico, Barra, TipoServico } from '../types';
import * as XLSX from 'xlsx';
import { 
  Eraser,
  TrendingUp, 
  Download, 
  HardHat, 
  Search, 
  Layers, 
  ChevronRight, 
  Filter, 
  BarChart3, 
  PieChart as PieIcon, 
  Coins,
  FileSpreadsheet,
  Calendar,
  Mail
} from 'lucide-react';
import { exportarRelatorioMedicaoServico, exportarRelatorioMedicaoConsolidado } from '../utils/relatorioMedicaoExcel';
import { ConfiguracaoEmailModal } from '../components/ConfiguracaoEmailModal';

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

export const ProdutividadePage: React.FC<ProdutividadePageProps> = ({ setHeaderInfo, onSelectServico }) => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barrasPorServico, setBarrasPorServico] = useState<Record<string, Barra[]>>({});
  const [loading, setLoading] = useState(true);

  // Datas de início e fim do mês atual (padrão executivo)
  const getInicioMesAtual = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getFimMesAtual = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  };

  const [dataInicio, setDataInicio] = useState<string>(getInicioMesAtual);
  const [dataFim, setDataFim] = useState<string>(getFimMesAtual);
  const [servicoExpandido, setServicoExpandido] = useState<string | null>(null);
  const [filtroTerceiro, setFiltroTerceiro] = useState('TODOS');
  const [filtroServico, setFiltroServico] = useState<string>('TODOS');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('TODOS');
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>('MES');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);

  // Controles de Gráficos (Estilo BI JLE)
  const [metricaEvolucao, setMetricaEvolucao] = useState<MetricaEvolucao>('FINANCEIRO');
  const [granularidade, setGranularidade] = useState<GranularidadeEvolucao>('MENSAL');
  const evolutionPlotRef = useRef<HTMLDivElement>(null);
  const [evolutionPlotWidth, setEvolutionPlotWidth] = useState(0);
  useEffect(() => {
    const plot = evolutionPlotRef.current;
    if (!plot) return;
    const observer = new ResizeObserver(([entry]) => setEvolutionPlotWidth(entry.contentRect.width));
    observer.observe(plot);
    return () => observer.disconnect();
  }, [loading]);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  useEffect(() => {
    setHeaderInfo('Painel de Produtividade & Custos', 'Dashboard Analítico de Produção e Performance Financeira');
  }, [setHeaderInfo]);

  // Carregar dados de forma rápida e paralelizada
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

  const terceirosDisponiveis = useMemo(() => {
    const autores = new Map<string, string>();
    Object.values(barrasPorServico).flat().forEach(b => {
      const id = b.registrado_por || 'SEM_AUTOR';
      const nome = b.registrado_por_nome || (id === 'SEM_AUTOR' ? 'Sem autor identificado' : `Técnico ${id.slice(0, 8)}`);
      if (!autores.has(id) || b.registrado_por_nome) autores.set(id, nome);
    });
    return [...autores].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [barrasPorServico]);
  const barrasSelecionadas = useMemo(() => Object.fromEntries(Object.entries(barrasPorServico).map(([id, barras]) => [id,
    barras.filter(b => filtroTerceiro === 'TODOS' || (b.registrado_por || 'SEM_AUTOR') === filtroTerceiro)
  ])), [barrasPorServico, filtroTerceiro]);

  // Anos disponíveis nos dados
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>();
    anos.add(currentYear);
    anos.add((Number(currentYear) - 1).toString());

    Object.values(barrasPorServico).forEach((barras: any) => {
      barras.forEach((b: any) => {
        let mesRef = b.mes_referencia;
        let dataRef = b.data_referencia;
        if (!mesRef && !dataRef && b.observacao) {
          const { meta } = parseBarraObservacao(b.observacao);
          mesRef = meta.mes_referencia;
          dataRef = meta.data_referencia;
        }

        if (mesRef) {
          const y = mesRef.split('-')[0];
          if (y && !isNaN(Number(y))) anos.add(y);
        } else if (dataRef) {
          const y = dataRef.split('-')[0];
          if (y && !isNaN(Number(y))) anos.add(y);
        } else {
          const rawDate = b.horario_registro || b.data_registro || b.created_at;
          if (rawDate) {
            const y = new Date(rawDate).getFullYear();
            if (!isNaN(y) && y > 2000 && y < 2100) {
              anos.add(y.toString());
            }
          }
        }
      });
    });

    return Array.from(anos).sort((a, b) => Number(b) - Number(a));
  }, [barrasPorServico, currentYear]);

  // Helper date extractor
  const getBarraDateInfo = (b: Barra): { year: string; month: number; day: number } | null => {
    let dataRef = b.data_referencia;
    let mesRef = b.mes_referencia;

    if (!dataRef && !mesRef && b.observacao) {
      const { meta } = parseBarraObservacao(b.observacao);
      if (meta.data_referencia) dataRef = meta.data_referencia;
      if (meta.mes_referencia) mesRef = meta.mes_referencia;
    }

    if (dataRef) {
      const parts = dataRef.split('-');
      if (parts.length === 3) {
        return {
          year: parts[0],
          month: Number(parts[1]),
          day: Number(parts[2])
        };
      }
    }
    if (mesRef) {
      const parts = mesRef.split('-');
      if (parts.length === 2) {
        return {
          year: parts[0],
          month: Number(parts[1]),
          day: 15
        };
      }
    }

    const raw = b.horario_registro || b.data_registro || b.created_at;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear().toString(),
      month: d.getMonth() + 1,
      day: d.getDate()
    };
  };

  // Datas de referência para períodos rápidos
  const now = useMemo(() => new Date(), []);
  
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  // Função para verificar se a barra pertence ao filtro ativo por intervalo de datas (Data Início e Fim)
  const isBarraInFilter = (b: Barra): boolean => {
    const dateInfo = getBarraDateInfo(b);
    if (!dateInfo) return !dataInicio && !dataFim;

    const bDateStr = `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`;

    if (dataInicio && bDateStr < dataInicio) {
      return false;
    }

    if (dataFim && bDateStr > dataFim) {
      return false;
    }

    return true;
  };

  // Limpa os filtros e retorna ao período padrão do mês atual.
  const limparFiltros = () => {
    setDataInicio(getInicioMesAtual());
    setDataFim(getFimMesAtual());
    setFiltroSegmento('TODOS');
    setFiltroServico('TODOS');
    setFiltroTerceiro('TODOS');
    setSearchTerm('');
    setPeriodoRapido('MES');
    setServicoExpandido(null);
    setHoveredMonthIdx(null);
  };

  // Cálculos consolidados por serviço
  const servicosCalculados = useMemo(() => {
    return servicos.map(s => {
      const allBarras = barrasSelecionadas[s.id] || [];
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
        const diamDefault = Number(s.diametro_furo_mm) || 150;
        const fator = Number(s.fator_financeiro) || 0.8;
        let somaRetorno = 0;
        let count = 0;
        for (const b of barrasPeriodo) {
          if (b.tipo_registro === 'CAIXA' || b.tem_caixa) continue;
          const m = Number(b.metros) || 3;
          const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
          somaRetorno += m * fator * numDiam;
          count++;
        }
        receitaPeriodo = count > 0 ? somaRetorno : (metrosPeriodo * fator * diamDefault);
      } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
        const valFechado = Number(s.valor_total_fechado) || 0;
        receitaPeriodo = totalPrevisto > 0 ? (metrosPeriodo / totalPrevisto) * valFechado : 0;
      }

      // Regra Oficial de Custo: Multiplicado sempre por 2 (rateio 50% Navegador e 50% Operador)
      const custoMetro = Number(s.custo_metro) || 0;
      const custoPeriodo = metrosPeriodo * custoMetro * 2; // Ex: 0.5 * 100m * 2 = R$ 100 (50 Navegador + 50 Operador)
      const custoNavegador = metrosPeriodo * custoMetro;
      const custoOperador = metrosPeriodo * custoMetro;
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
        custoNavegador,
        custoOperador,
        margemPeriodo,
        margemPercentual,
        qtdRegistrosPeriodo: barrasPeriodo.length,
        qtdCaixasPeriodo: barrasPeriodo.filter(b => b.tem_caixa || b.tipo_registro === 'CAIXA').length
      };
    });
  }, [servicos, barrasSelecionadas, dataInicio, dataFim]);

  // Filtragem por busca e por segmento
  const servicosFiltrados = useMemo(() => {
    return servicosCalculados.filter(s => {
      const matchTipo = filtroSegmento === 'TODOS' || s.tipo_servico === filtroSegmento;
      const matchSearch = searchTerm.trim() === '' || 
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.cidade && s.cidade.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchTipo && matchSearch && (filtroServico === 'TODOS' || s.id === filtroServico);
    });
  }, [servicosCalculados, filtroSegmento, searchTerm, filtroServico]);

  const receitaPorTerceiro = useMemo(() => {
    return summarizeAuthorRevenue(servicosFiltrados, barrasSelecionadas, isBarraInFilter, terceirosDisponiveis);
  }, [servicosFiltrados, barrasSelecionadas, terceirosDisponiveis, dataInicio, dataFim]);

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
    const targetYear = dataInicio ? dataInicio.split('-')[0] : currentYear;

    if (granularidade === 'MENSAL') {
      // 12 Meses do ano selecionado
      return Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        let metros = 0;
        let receita = 0;
        let custo = 0;

        servicosFiltrados.forEach(s => {
          const barras = barrasSelecionadas[s.id] || [];
          const diamDefault = Number(s.diametro_furo_mm) || 150;
          const fator = Number(s.fator_financeiro) || 0.8;
          const custoMetro = Number(s.custo_metro) || 0;

          barras.forEach(b => {
            const dateInfo = getBarraDateInfo(b);
            if (!dateInfo) return;

            if (dateInfo.year === targetYear && dateInfo.month === monthNum) {
              const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
              metros += m;

              let rec = 0;
              if (s.cenario_financeiro === 'VALOR_METRO') {
                rec = m * (Number(s.valor_metro) || 0);
              } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
                const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
                rec = m * fator * numDiam;
              } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
                const prev = Number(s.metragem_prevista_total) || 1000;
                rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
              }
              receita += rec;
              // Custo multiplicado por 2 (50% Navegador, 50% Operador)
              custo += m * custoMetro * 2;
            }
          });
        });

        const margem = receita - custo;

        return {
          idx: i,
          label: MESES_SHORT[i],
          nomeMes: MESES_LABEL[i],
          mesNum: monthNum,
          metros: Number(metros.toFixed(1)),
          receita: Number(receita.toFixed(2)),
          custo: Number(custo.toFixed(2)),
          margem: Number(margem.toFixed(2))
        };
      });
    }

    if (granularidade === 'SEMANAL') {
      const targetMonthNum = dataInicio ? Number(dataInicio.split('-')[1]) : Number(currentMonth);
      const semanas = [
        { label: 'Sem 1 (1-7)', min: 1, max: 7 },
        { label: 'Sem 2 (8-14)', min: 8, max: 14 },
        { label: 'Sem 3 (15-21)', min: 15, max: 21 },
        { label: 'Sem 4 (22-28)', min: 22, max: 28 },
        { label: 'Sem 5 (29-31)', min: 29, max: 31 }
      ];

      return semanas.map((sem, i) => {
        let metros = 0;
        let receita = 0;
        let custo = 0;

        servicosFiltrados.forEach(s => {
          const barras = barrasSelecionadas[s.id] || [];
          const diamDefault = Number(s.diametro_furo_mm) || 150;
          const fator = Number(s.fator_financeiro) || 0.8;
          const custoMetro = Number(s.custo_metro) || 0;

          barras.forEach(b => {
            const dateInfo = getBarraDateInfo(b);
            if (!dateInfo) return;

            if (dateInfo.year === targetYear && dateInfo.month === targetMonthNum && dateInfo.day >= sem.min && dateInfo.day <= sem.max) {
              const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
              metros += m;

              let rec = 0;
              if (s.cenario_financeiro === 'VALOR_METRO') {
                rec = m * (Number(s.valor_metro) || 0);
              } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
                const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
                rec = m * fator * numDiam;
              } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
                const prev = Number(s.metragem_prevista_total) || 1000;
                rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
              }
              receita += rec;
              custo += m * custoMetro * 2;
            }
          });
        });

        return {
          idx: i,
          label: sem.label,
          nomeMes: sem.label,
          mesNum: i + 1,
          metros: Number(metros.toFixed(1)),
          receita: Number(receita.toFixed(2)),
          custo: Number(custo.toFixed(2)),
          margem: Number((receita - custo).toFixed(2))
        };
      });
    }

    // Diário (dias 1 a 31)
    const targetMonthNum = dataInicio ? Number(dataInicio.split('-')[1]) : Number(currentMonth);
    const daysInMonth = new Date(Number(targetYear), targetMonthNum, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      let metros = 0;
      let receita = 0;
      let custo = 0;

      servicosFiltrados.forEach(s => {
        const barras = barrasSelecionadas[s.id] || [];
        const diamDefault = Number(s.diametro_furo_mm) || 150;
        const fator = Number(s.fator_financeiro) || 0.8;
        const custoMetro = Number(s.custo_metro) || 0;

        barras.forEach(b => {
          const dateInfo = getBarraDateInfo(b);
          if (!dateInfo) return;

          if (dateInfo.year === targetYear && dateInfo.month === targetMonthNum && dateInfo.day === day) {
            const m = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
            metros += m;

            let rec = 0;
            if (s.cenario_financeiro === 'VALOR_METRO') {
              rec = m * (Number(s.valor_metro) || 0);
            } else if (s.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
              const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
              rec = m * fator * numDiam;
            } else if (s.cenario_financeiro === 'VALOR_FECHADO') {
              const prev = Number(s.metragem_prevista_total) || 1000;
              rec = prev > 0 ? (m / prev) * (Number(s.valor_total_fechado) || 0) : 0;
            }
            receita += rec;
            custo += m * custoMetro * 2;
          }
        });
      });

      return {
        idx: i,
        label: `${day}`,
        nomeMes: `Dia ${day}`,
        mesNum: day,
        metros: Number(metros.toFixed(1)),
        receita: Number(receita.toFixed(2)),
        custo: Number(custo.toFixed(2)),
        margem: Number((receita - custo).toFixed(2))
      };
    });
  }, [servicosFiltrados, barrasSelecionadas, dataInicio, dataFim, granularidade, currentYear, currentMonth]);

  // Escala máxima do gráfico de evolução para desenhar as barras com precisão e espaço para rótulos de dados
  const maxEvolucaoVal = useMemo(() => {
    if (metricaEvolucao === 'FINANCEIRO') {
      const maxVal = Math.max(...dadosEvolucao.map(d => Math.max(d.receita, d.custo)), 1000);
      return maxVal * 1.28;
    }
    const maxMetros = Math.max(...dadosEvolucao.map(d => d.metros), 50);
    return maxMetros * 1.28;
  }, [dadosEvolucao, metricaEvolucao]);

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

    const totalValMetros = Object.values(tipos).reduce((acc, curr) => acc + curr.metros, 0);
    const totalValReceita = Object.values(tipos).reduce((acc, curr) => acc + curr.receita, 0);

    return Object.entries(tipos).map(([key, val]) => {
      return {
        key,
        name: val.nome,
        icon: val.icon,
        color: val.color,
        count: val.count,
        metros: Number(val.metros.toFixed(1)),
        receita: Number(val.receita.toFixed(2)),
        custo: Number(val.custo.toFixed(2)),
        pctReceita: totalValReceita > 0 ? val.receita / totalValReceita * 100 : 0,
        pctMetros: totalValMetros > 0 ? val.metros / totalValMetros * 100 : 0
      };
    });
  }, [servicosFiltrados]);

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
      'Registros / Barras': s.qtdRegistrosPeriodo,
      'Caixas Instaladas': s.qtdCaixasPeriodo
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const colWidths = [
      { wch: 10 }, { wch: 32 }, { wch: 22 }, { wch: 15 },
      { wch: 6 },  { wch: 20 }, { wch: 15 }, { wch: 20 },
      { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtividade TecnoDrill');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(receitaPorTerceiro.map(t => ({
      'Terceiro / Autor': t.nome, 'ID Autor': t.id, 'Receita Estimada (R$)': Number(t.receita.toFixed(2)), 'Metros': t.metros, 'Registros': t.registros, 'Serviços': t.servicos.size, 'Dias Trabalhados': t.diasTrabalhados, 'Média Diária (m/dia)': t.mediaDiaria === null ? '' : Number(t.mediaDiaria.toFixed(1)), 'Registros sem data': t.registrosSemData
    }))), 'Receita por Terceiro');

    const dataHojeFormatada = new Date().toISOString().split('T')[0];
    const periodoLabel = dataInicio && dataFim ? `${dataInicio}_a_${dataFim}` : (dataInicio || dataFim || 'Geral');
    const fileName = `Produtividade_TecnoDrill_${periodoLabel}_${dataHojeFormatada}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Formatador curto de moedas para o gráfico
  const formatShortValue = (val: number): string => {
    const a = Math.abs(val);
    if (a >= 1000000) return (a / 1000000).toFixed(1) + 'M';
    if (a >= 1000) return (a / 1000).toFixed(0) + 'k';
    return a.toFixed(0);
  };

  // Formatador de rótulos de dados (Data Labels) no topo das barras
  const formatDataLabel = (val: number, isMoney: boolean): string => {
    if (!val || val <= 0) return '';
    if (isMoney) {
      if (val >= 1000000) return `${(val / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
      if (val >= 1000) return `${(val / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
      return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
    }
    if (val >= 1000) return `${(val / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}km`;
    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m`;
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

  // Cálculos geométricos do SVG Donut
  const donutCircumference = 2 * Math.PI * 40; // r=40 -> ~251.32
  let accumulatedDonutPct = 0;

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
                Filtros Analíticos & Período
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Controle temporal consolidado para medição de produtividade e financeiro
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Botão Configurar E-mail Diário (Padrão BI JLE) */}
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              title="Configurações de envio automático de relatório diário por e-mail"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 15px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#F05A22';
                e.currentTarget.style.color = '#F05A22';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              <Mail size={15} color="#F05A22" />
              <span>E-mails Automáticos</span>
            </button>

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
        </div>

        {/* Inputs de Filtro no Topo (Período por Calendário) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'end' }}>
          
          {/* Filtro: Data Início */}
          <div>
            <label htmlFor="filtro-data-inicio" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              <Calendar size={13} style={{ color: 'var(--primary)' }} />
              Período: Início
            </label>
            <input
              id="filtro-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoRapido('CUSTOM');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                colorScheme: 'dark light',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Filtro: Data Fim */}
          <div>
            <label htmlFor="filtro-data-fim" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
              <Calendar size={13} style={{ color: 'var(--primary)' }} />
              Período: Fim
            </label>
            <input
              id="filtro-data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoRapido('CUSTOM');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-main)',
                colorScheme: 'dark light',
                cursor: 'pointer'
              }}
            />
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
                boxSizing: 'border-box',
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

          <div>
            <label htmlFor="produtividade-servico" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>Serviço / Obra</label>
            <select id="produtividade-servico" value={filtroServico} onChange={e => setFiltroServico(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              <option value="TODOS">Todos os Serviços</option>
              {servicos.map(s => <option key={s.id} value={s.id}>{s.id} — {s.nome}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="produtividade-terceiro" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>Terceiro / Autor da produção</label>
            <select id="produtividade-terceiro" value={filtroTerceiro} onChange={e => setFiltroTerceiro(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              <option value="TODOS">Todos os Terceiros</option>
              {terceirosDisponiveis.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div style={{ alignSelf: 'end' }}>
            <button type="button" onClick={limparFiltros} title="Limpar todos os filtros" aria-label="Limpar todos os filtros" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38, padding: '9px 14px', border: '1px solid var(--border-color)', borderRadius: 8, backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}>
              <Eraser size={18} aria-hidden="true" /> Limpar filtros
            </button>
          </div>

        </div>

        {/* Atalhos Rápidos de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px', letterSpacing: '0.3px' }}>
            Atalhos:
          </span>
          {[
            {
              label: 'Hoje',
              action: () => {
                const hoje = new Date().toISOString().split('T')[0];
                setDataInicio(hoje);
                setDataFim(hoje);
                setPeriodoRapido('HOJE');
              }
            },
            {
              label: 'Últimos 7 Dias',
              action: () => {
                const fim = new Date();
                const ini = new Date();
                ini.setDate(ini.getDate() - 7);
                setDataInicio(ini.toISOString().split('T')[0]);
                setDataFim(fim.toISOString().split('T')[0]);
                setPeriodoRapido('SEMANA');
              }
            },
            {
              label: 'Este Mês',
              action: () => {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                setDataInicio(`${y}-${m}-01`);
                setDataFim(`${y}-${m}-${lastDay}`);
                setPeriodoRapido('MES');
              }
            },
            {
              label: 'Mês Anterior',
              action: () => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                setDataInicio(`${y}-${m}-01`);
                setDataFim(`${y}-${m}-${lastDay}`);
                setPeriodoRapido('CUSTOM');
              }
            },
            {
              label: 'Ano Atual',
              action: () => {
                const y = new Date().getFullYear();
                setDataInicio(`${y}-01-01`);
                setDataFim(`${y}-12-31`);
                setPeriodoRapido('ANO');
              }
            },
            {
              label: 'Todo o Histórico',
              action: () => {
                setDataInicio('');
                setDataFim('');
                setPeriodoRapido('GERAL');
              }
            }
          ].map(shortcut => (
            <button
              key={shortcut.label}
              type="button"
              onClick={shortcut.action}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--text-main)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {shortcut.label}
            </button>
          ))}
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────
          2. CARDS DE KPI (PADRÃO BI JLE)
      ────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
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

        {/* Card 3: Metros Perfurados */}
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

      <section aria-labelledby="receita-autores" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24 }}>
        <h3 id="receita-autores" style={{ margin: '0 0 6px', color: 'var(--text-main)' }}>Receita por Terceiro — Autor da produção</h3>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 18px', fontSize: 13 }}>Receita estimada da produção registrada por cada autor, conforme o preço da obra e os filtros acima. Cada registro é contado uma vez. Dias trabalhados: datas distintas com registros, incluindo caixas. Média diária: metros ÷ dias trabalhados.</p>
        {receitaPorTerceiro.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Nenhuma produção encontrada para os filtros selecionados.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)', fontSize: 14 }}>
              <thead><tr>{['Terceiro / Autor', 'Receita estimada', 'Participação', 'Metros', 'Dias trabalhados', 'Média diária', 'Registros', 'Serviços'].map(label => <th key={label} scope="col" style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</th>)}</tr></thead>
              <tbody>{receitaPorTerceiro.map(t => {
                const pct = totais.totalReceita > 0 ? t.receita / totais.totalReceita * 100 : 0;
                return <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 12 }}><button onClick={() => setFiltroTerceiro(t.id)} style={{ border: 0, background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700, textAlign: 'left', padding: 0 }} title="Filtrar por este autor">{t.nome}</button></td>
                  <td style={{ padding: 12, color: '#2ECC71', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ padding: 12, minWidth: 100 }}>{pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%<div style={{ height: 5, background: 'var(--bg-app)', borderRadius: 5, marginTop: 6 }}><div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: '#2ECC71', borderRadius: 5 }} /></div></td>
                  <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{t.metros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m</td>
                  <td style={{ padding: 12 }} title={t.registrosSemData ? `${t.registrosSemData} registro(s) sem data completa; contagem parcial.` : 'Datas distintas com registros, incluindo caixas.'}>{t.diasTrabalhados}{t.registrosSemData > 0 ? '*' : ''}</td>
                  <td style={{ padding: 12, whiteSpace: 'nowrap' }} title="Metros divididos pelos dias distintos com registros">{t.mediaDiaria === null ? '—' : `${t.mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m/dia`}</td>
                  <td style={{ padding: 12 }}>{t.registros}</td><td style={{ padding: 12 }}>{t.servicos.size}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
        {receitaPorTerceiro.some(t => t.registrosSemData > 0) && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 0 }}>* Contagem parcial: existem registros sem data completa. A média fica indisponível até completar essas datas.</p>}
      </section>

      {/* ────────────────────────────────────────────────────────────────
          3. GRÁFICO 1: EVOLUÇÃO (LARGURA TOTAL / 100% EXTENSÃO LATERAL)
      ────────────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          width: '100%',
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '14px', 
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: 'var(--shadow-sm)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header do Gráfico */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="var(--primary)" />
              Evolução {granularidade === 'MENSAL' ? `Mensal (${dataInicio ? dataInicio.split('-')[0] : currentYear})` : granularidade === 'SEMANAL' ? 'Semanal' : 'Diária'}
            </h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {metricaEvolucao === 'FINANCEIRO' ? 'Comparativo de Receita e Custo Operacional por competência' : 'Volume de Perfuração Direcional em Metros'}
            </span>
          </div>

          {/* Controles do Gráfico (Padrão BI JLE) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Toggle Métrica */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setMetricaEvolucao('FINANCEIRO')}
                style={{
                  padding: '5px 12px',
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
                  padding: '5px 12px',
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
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: granularidade === 'MENSAL' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: granularidade === 'MENSAL' ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Mensal (12 Meses)
              </button>
              <button
                type="button"
                onClick={() => setGranularidade('SEMANAL')}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
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
                  padding: '5px 10px',
                  fontSize: '11px',
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

        {/* Legenda do Gráfico de Evolução */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '18px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {metricaEvolucao === 'FINANCEIRO' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#2ECC71' }} />
                <span>Receita</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#E74C3C' }} />
                <span>Custo Operacional</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--primary)' }} />
              <span>Metros Perfurados (m)</span>
            </div>
          )}
        </div>

        {/* Visualizador de Barras Analíticas com Largura Total (100% da Extensão Lateral) */}
        <div style={{ position: 'relative', width: '100%', minWidth: 0, height: '310px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Linhas de Grade de Fundo */}
          <div style={{ position: 'absolute', top: 0, left: '55px', right: 0, bottom: '34px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-55px', fontSize: '10.5px', color: '#8BA6B5', width: '50px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {metricaEvolucao === 'FINANCEIRO' 
                    ? `R$ ${formatShortValue(maxEvolucaoVal * ratio)}` 
                    : `${(maxEvolucaoVal * ratio).toFixed(0)}m`}
                </span>
                <div style={{ width: '100%', height: '1px', backgroundColor: '#1B3645' }} />
              </div>
            ))}
          </div>


          {/* Container das Colunas dos Meses com Espaçamento Amplo */}
          <div ref={evolutionPlotRef} style={{ marginLeft: '55px', minWidth: 0, flex: 1, display: 'grid', gridTemplateColumns: `repeat(${dadosEvolucao.length || 1}, minmax(0, 1fr))`, alignItems: 'end', gap: granularidade === 'DIARIO' ? '2px' : '6px', zIndex: 2, paddingBottom: '32px' }}>
            {dadosEvolucao.map((d, i) => {
              const cellWidth = evolutionPlotWidth / Math.max(1, dadosEvolucao.length);
              const tickStep = Math.max(1, Math.ceil(32 / Math.max(1, cellWidth)));
              const showTick = i === dadosEvolucao.length - 1 || (i % tickStep === 0 && (i === 0 || i <= dadosEvolucao.length - 1 - tickStep));
              const verticalLabels = cellWidth < (metricaEvolucao === 'FINANCEIRO' ? 85 : 45);
              const isHovered = hoveredMonthIdx === i;
              const anoAlvo = dataInicio ? dataInicio.split('-')[0] : currentYear;
              const mesInicioStr = `${anoAlvo}-${String(d.mesNum).padStart(2, '0')}-01`;
              const ultDia = new Date(Number(anoAlvo), d.mesNum, 0).getDate();
              const mesFimStr = `${anoAlvo}-${String(d.mesNum).padStart(2, '0')}-${String(ultDia).padStart(2, '0')}`;
              const isSelectedMonth = Boolean(dataInicio && dataFim && mesFimStr >= dataInicio && mesInicioStr <= dataFim);
              const receitaHeightPct = Math.min(100, (d.receita / maxEvolucaoVal) * 100);
              const custoHeightPct = Math.min(100, (d.custo / maxEvolucaoVal) * 100);
              const metrosHeightPct = Math.min(100, (d.metros / maxEvolucaoVal) * 100);

              return (
                <div
                  key={d.label}
                  onMouseEnter={() => setHoveredMonthIdx(i)}
                  onMouseLeave={() => setHoveredMonthIdx(null)}
                  onClick={() => {
                    if (granularidade === 'MENSAL') {
                      const y = dataInicio ? dataInicio.split('-')[0] : currentYear;
                      const m = String(d.mesNum).padStart(2, '0');
                      const lastDay = new Date(Number(y), d.mesNum, 0).getDate();
                      setDataInicio(`${y}-${m}-01`);
                      setDataFim(`${y}-${m}-${lastDay}`);
                      setPeriodoRapido('CUSTOM');
                    }
                  }}
                  style={{
                    minWidth: 0,
                    width: '100%',
                    boxSizing: 'border-box',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    backgroundColor: isHovered || isSelectedMonth ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    transition: 'background-color 0.2s ease',
                    padding: granularidade === 'DIARIO' ? '0 1px' : '0 4px'
                  }}
                >
                  {/* Tooltip Flutuante no Hover */}
                  {isHovered && (
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '105%',
                        left: i < dadosEvolucao.length / 2 ? 0 : 'auto',
                        right: i < dadosEvolucao.length / 2 ? 'auto' : 0,
                        backgroundColor: '#0D1C24',
                        border: '1px solid #1B3645',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.65)',
                        zIndex: 10,
                        pointerEvents: 'none',
                        minWidth: '150px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#FFFFFF', borderBottom: '1px solid #1B3645', paddingBottom: '4px', marginBottom: '2px' }}>
                        {d.nomeMes}
                      </span>
                      {metricaEvolucao === 'FINANCEIRO' ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: '#8BA6B5' }}>Receita:</span>
                            <span style={{ color: '#2ECC71', fontWeight: 700 }}>R$ {d.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: '#8BA6B5' }}>Custo:</span>
                            <span style={{ color: '#E74C3C', fontWeight: 700 }}>R$ {d.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                          <span style={{ color: '#8BA6B5' }}>Produção:</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{d.metros.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barras do Mês com Rótulos de Dados (Data Labels) */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: granularidade === 'DIARIO' ? '1px' : '4px', minWidth: 0 }}>
                    {metricaEvolucao === 'FINANCEIRO' ? (
                      <>
                        {/* Coluna Receita com Rótulo de Dados */}
                        <div
                          style={{
                            width: '46%',
                            minWidth: 0,
                            height: '100%',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}
                        >
                          {/* Rótulo de Dado da Receita */}
                          {d.receita > 0 && (
                            <span
                              style={{
                                fontWeight: 800,
                                color: '#2ECC71',
                                position: 'absolute',
                                bottom: `calc(${Math.max(receitaHeightPct, 2)}% + 6px)`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                writingMode: verticalLabels ? 'vertical-rl' : 'horizontal-tb',
                                textOrientation: 'mixed',
                                fontSize: verticalLabels ? '9px' : '10px',
                                fontFamily: 'var(--font-mono)',
                                marginBottom: '4px',
                                whiteSpace: 'nowrap',
                                letterSpacing: '-0.3px',
                                lineHeight: 1
                              }}
                            >
                              {formatDataLabel(d.receita, true)}
                            </span>
                          )}
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(receitaHeightPct, 2)}%`,
                              backgroundColor: '#2ECC71',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                              opacity: d.receita > 0 ? 1 : 0.2
                            }}
                          />
                        </div>

                        {/* Coluna Custo com Rótulo de Dados */}
                        <div
                          style={{
                            width: '46%',
                            minWidth: 0,
                            height: '100%',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}
                        >
                          {/* Rótulo de Dado do Custo */}
                          {d.custo > 0 && (
                            <span
                              style={{
                                fontWeight: 800,
                                color: '#E74C3C',
                                position: 'absolute',
                                bottom: `calc(${Math.max(custoHeightPct, 2)}% + 6px)`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                writingMode: verticalLabels ? 'vertical-rl' : 'horizontal-tb',
                                textOrientation: 'mixed',
                                fontSize: verticalLabels ? '9px' : '10px',
                                fontFamily: 'var(--font-mono)',
                                marginBottom: '4px',
                                whiteSpace: 'nowrap',
                                letterSpacing: '-0.3px',
                                lineHeight: 1
                              }}
                            >
                              {formatDataLabel(d.custo, true)}
                            </span>
                          )}
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(custoHeightPct, 2)}%`,
                              backgroundColor: '#E74C3C',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                              opacity: d.custo > 0 ? 1 : 0.2
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      /* Coluna Metros com Rótulo de Dados */
                      <div
                        style={{
                          width: '65%',
                          height: '100%',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center'
                        }}
                      >
                        {/* Rótulo de Dado dos Metros */}
                        {d.metros > 0 && (
                          <span
                            style={{
                              fontWeight: 800,
                              color: 'var(--primary)',
                                position: 'absolute',
                                bottom: `calc(${Math.max(metrosHeightPct, 2)}% + 6px)`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                writingMode: verticalLabels ? 'vertical-rl' : 'horizontal-tb',
                                textOrientation: 'mixed',
                                fontSize: verticalLabels ? '9px' : '10px',
                              fontFamily: 'var(--font-mono)',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.3px',
                              lineHeight: 1
                            }}
                          >
                            {formatDataLabel(d.metros, false)}
                          </span>
                        )}
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(metrosHeightPct, 2)}%`,
                            backgroundColor: 'var(--primary)',
                            borderRadius: '5px 5px 0 0',
                            transition: 'height 0.3s ease',
                            opacity: d.metros > 0 ? 1 : 0.2
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Rótulo do Eixo X (Mês) */}
                  <span 
                    style={{
                      position: 'absolute',
                      bottom: '-25px',
                      fontSize: granularidade === 'DIARIO' ? '10px' : '11.5px',
                      visibility: showTick ? 'visible' : 'hidden',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      fontWeight: isSelectedMonth ? 900 : isHovered ? 800 : 600,
                      color: isSelectedMonth ? 'var(--primary)' : isHovered ? '#FFFFFF' : '#8BA6B5',
                      textAlign: 'center'
                    }}
                  >
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────
          4. GRÁFICO 2: DISTRIBUIÇÃO POR SEGMENTO (ADAPTADO EM NOVO LOCAL)
      ────────────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          width: '100%',
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '14px', 
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: 'var(--shadow-sm)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header do Gráfico */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={20} color="var(--primary)" />
              Distribuição por Segmento
            </h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Participação consolidada entre Saneamento, Rodovia e Telecom • Toque no card para filtrar
            </span>
          </div>

        </div>

        {/* Layout Panorâmico: Donut SVG na Esquerda + Cards Interativos na Direita */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '28px',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', flex: '1 1 390px', minWidth: 0 }}>
            {(['RECEITA', 'METROS'] as const).map(metricaSegmento => (
              <React.Fragment key={metricaSegmento}>
                {/* Lado Esquerdo: Donut Ring Centralizado */}
                <div style={{ flex: '0 0 auto', width: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '210px', margin: '0 auto' }}>
                  <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}>
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#1B3645"
                      strokeWidth="11"
                    />
                    {/* Segments com offset calculado de forma segura e local */}
                    {(() => {
                      let runningPct = 0;
                      return dadosSegmentos.map((item) => {
                        const strokeDash = ((metricaSegmento === 'RECEITA' ? item.pctReceita : item.pctMetros) / 100) * donutCircumference;
                        const offset = -(runningPct / 100) * donutCircumference;
                        runningPct += (metricaSegmento === 'RECEITA' ? item.pctReceita : item.pctMetros);

                        if ((metricaSegmento === 'RECEITA' ? item.pctReceita : item.pctMetros) <= 0) return null;

                        return (
                          <circle
                            key={item.key}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="11"
                            strokeDasharray={`${strokeDash} ${donutCircumference}`}
                            strokeDashoffset={offset}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Rótulo Central do Donut */}
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      {metricaSegmento === 'RECEITA' ? 'Receita do período' : 'Metros do período'}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {metricaSegmento === 'RECEITA'
                        ? `R$ ${formatShortValue(totais.totalReceita)}`
                        : `${totais.totalMetros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}m`}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                      {servicosFiltrados.length} obra(s)
                    </span>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Lado Direito: Cards dos 3 Segmentos em Grid Lateral */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
              gap: '14px',
              flex: '3 1 660px', minWidth: 0
            }}
          >
            {dadosSegmentos.map(item => {
              const isFiltered = filtroSegmento === item.key;
              return (
                <div 
                  key={item.key}
                  onClick={() => setFiltroSegmento(prev => prev === item.key ? 'TODOS' : item.key)}
                  style={{
                    backgroundColor: isFiltered ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                    border: `1.5px solid ${isFiltered ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isFiltered ? '0 0 12px rgba(240, 90, 34, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isFiltered) e.currentTarget.style.borderColor = item.color;
                  }}
                  onMouseLeave={(e) => {
                    if (!isFiltered) e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{item.icon}</span>
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>{item.name}</strong>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.count} obra(s) ativa(s)</span>
                      </div>
                    </div>
                  </div>

                  {(['RECEITA', 'METROS'] as const).map(metrica => {
                    const receita = metrica === 'RECEITA';
                    const percentual = receita ? item.pctReceita : item.pctMetros;
                    return (
                      <div key={metrica} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '11.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{receita ? 'Receita:' : 'Metros:'}</span>
                          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                            {receita ? 'R$ ' + item.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.metros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: percentual + '%', backgroundColor: item.color, borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: item.color, minWidth: '38px', textAlign: 'right' }}>{percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
        {/* Header da Tabela com Busca e Contagem */}
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

          {/* Ações da Tabela e Campo de Busca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Botão Exportar Medições (.xlsx) consolidado */}
            <button
              type="button"
              onClick={() => {
                const nomePeriodo = dataInicio && dataFim
                  ? `${dataInicio.split('-').reverse().join('-')}_a_${dataFim.split('-').reverse().join('-')}`
                  : (dataInicio || dataFim || 'GERAL');
                const barrasFiltradasMap: Record<string, Barra[]> = {};
                servicosFiltrados.forEach(s => {
                  barrasFiltradasMap[s.id] = (barrasSelecionadas[s.id] || []).filter(isBarraInFilter);
                });
                exportarRelatorioMedicaoConsolidado(servicosFiltrados, barrasFiltradasMap, nomePeriodo);
              }}
              title="Exportar planilha consolidada de medições em Excel com abas mensais"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(46, 204, 113, 0.15)',
                border: '1px solid #2ECC71',
                color: '#2ECC71',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#2ECC71';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
                e.currentTarget.style.color = '#2ECC71';
              }}
            >
              <FileSpreadsheet size={15} />
              <span>Exportar Medições (.xlsx)</span>
            </button>

            {/* Campo de Busca */}
            <div style={{ position: 'relative', width: '260px' }}>
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
                <th style={{ padding: '12px', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {servicosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                servicosFiltrados.map((s) => {
                  const badgeColor = s.tipo_servico === 'SANEAMENTO' ? '#00B4D8' :
                    s.tipo_servico === 'RODOVIA' ? '#E67E22' : '#9B59B6';

                  const expandido = servicoExpandido === s.id;
                  const diametros = expandido ? summarizeDiameterRevenue(s, (barrasSelecionadas[s.id] || []).filter(isBarraInFilter)) : [];
                  const toggle = () => setServicoExpandido(atual => atual === s.id ? null : s.id);
                  return (
                    <React.Fragment key={s.id}>
                    <tr 
                      onClick={toggle}
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background-color 0.15s ease', cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Nome e Cliente */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button type="button" aria-expanded={expandido} aria-controls={`diametros-${s.id}`} onClick={e => { e.stopPropagation(); toggle(); }} style={{ border: 0, padding: 0, background: 'transparent', color: 'var(--text-main)', fontSize: 13, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>{expandido ? '▾' : '▸'} {s.nome}</button>
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
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            2x R$ {s.custoMetro.toFixed(2)}/m (Nav/Op)
                          </span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const barrasDaObra = (barrasSelecionadas[s.id] || []).filter(isBarraInFilter);
                              const nomePeriodo = dataInicio && dataFim
                                ? `${dataInicio.split('-').reverse().join('-')}_a_${dataFim.split('-').reverse().join('-')}`
                                : (dataInicio || dataFim || 'GERAL');
                              exportarRelatorioMedicaoServico(s, barrasDaObra, nomePeriodo);
                            }}
                            title={`Exportar Planilha de Medição Excel (${s.nome})`}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(46, 204, 113, 0.12)',
                              border: '1px solid rgba(46, 204, 113, 0.4)',
                              color: '#2ECC71',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#2ECC71';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.12)';
                              e.currentTarget.style.color = '#2ECC71';
                            }}
                          >
                            <FileSpreadsheet size={13} />
                            <span>Excel</span>
                          </button>

                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); toggle(); }}
                            aria-expanded={expandido}
                            aria-controls={`diametros-${s.id}`}
                            title="Detalhar produção por diâmetro"
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
                            <span>{expandido ? 'Fechar' : 'Diâmetros'}</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandido && <tr id={`diametros-${s.id}`}><td colSpan={7} style={{ padding: '16px 24px 24px', background: 'var(--bg-app)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div><strong style={{ color: 'var(--text-main)' }}>Produção por diâmetro — {s.nome}</strong><p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Valores do período e autor selecionados. Receita estimada conforme as regras financeiras da obra.</p></div>
                        {onSelectServico && <button type="button" className="btn btn-secondary" onClick={() => onSelectServico(s.id)}>Abrir obra <ChevronRight size={14} /></button>}
                      </div>
                      {diametros.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Nenhum registro neste serviço para os filtros selecionados.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)', fontSize: 13 }}>
                        <thead><tr>{['Diâmetro', 'Registros', 'Metros', 'Receita estimada', 'Custo operacional'].map(label => <th scope="col" key={label} style={{ padding: 10, color: 'var(--text-muted)' }}>{label}</th>)}</tr></thead>
                        <tbody>{diametros.map(d => <tr key={d.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: 10, fontWeight: 700 }}>{d.nome}</td><td style={{ padding: 10 }}>{d.registros}</td>
                          <td style={{ padding: 10 }}>{d.metros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m</td>
                          <td style={{ padding: 10, color: '#2ECC71' }}>{d.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td style={{ padding: 10, color: '#E74C3C' }}>{d.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>)}</tbody>
                        <tfoot><tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}><td style={{ padding: 10 }}>Total</td><td style={{ padding: 10 }}>{s.qtdRegistrosPeriodo}</td><td style={{ padding: 10 }}>{s.metrosPeriodo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m</td><td style={{ padding: 10 }}>{s.receitaPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style={{ padding: 10 }}>{s.custoPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr></tfoot>
                      </table>}
                    </td></tr>}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal de Configuração de E-mails Automáticos */}
      <ConfiguracaoEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />

    </div>
  );
};
