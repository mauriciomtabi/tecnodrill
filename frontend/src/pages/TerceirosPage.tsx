import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, DollarSign, TrendingUp, Calendar, Filter, Search, 
  Plus, Download, FileSpreadsheet, FileText, CheckCircle2, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Layers, ShieldAlert,
  Building, CreditCard, ChevronRight, Trash2, X, RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, ComposedChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../services/api';
import { TerceiroLancamento, Usuario, Servico, Barra } from '../types';

interface Props {
  setHeaderInfo: (title: string, subtitle: string) => void;
  user: Usuario | null;
}

const CORES_PALETA = [
  '#00D26A', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', 
  '#10B981', '#06B6D4', '#6366F1', '#F97316', '#14B8A6'
];

export const TerceirosPage: React.FC<Props> = ({ setHeaderInfo, user }) => {
  const [lancamentos, setLancamentos] = useState<TerceiroLancamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barras, setBarras] = useState<Barra[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroMes, setFiltroMes] = useState<string>('TODOS');
  const [filtroAno, setFiltroAno] = useState<string>('2026');
  const [filtroTerceiro, setFiltroTerceiro] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Novo Lançamento
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoItem, setNovoItem] = useState({
    terceiro_nome: '',
    descricao: '',
    data: new Date().toISOString().split('T')[0],
    mes_referencia: new Date().toISOString().slice(0, 7),
    valor: '',
    categoria: 'Terceiros',
    tipo_transacao: 'PIX',
    metros_executados: '',
    obra_relacionada: 'SANEAMENTO DOM PEDRITO (TD-01)',
    status: 'PAGO' as const
  });

  const isGestor = user?.perfil === 'GESTOR' || user?.perfil === 'ADMIN';

  useEffect(() => {
    setHeaderInfo(
      'Gestão de Terceiros & Subcontratados',
      'Controle Executivo de Custos Operacionais, Prestadores de Serviços e Produtividade'
    );
  }, [setHeaderInfo]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tercData, servs] = await Promise.all([
        ApiService.getTerceirosLancamentos(),
        ApiService.getServicos()
      ]);
      setLancamentos(tercData);
      setServicos(servs);

      // Carregar todas as barras do serviço principal para cruzar produtividade MND
      if (servs.length > 0) {
        try {
          const furos = await ApiService.getFuros(servs[0].id);
          if (furos.length > 0) {
            const bList = await ApiService.getBarras(furos[0].id);
            setBarras(bList);
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('Erro ao carregar dados de Terceiros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lista única de Terceiros
  const terceirosUnicos = useMemo(() => {
    const s = new Set<string>();
    lancamentos.forEach(l => {
      if (l.terceiro_nome) s.add(l.terceiro_nome.trim());
    });
    return Array.from(s).sort();
  }, [lancamentos]);

  // Lista única de Meses de Referência
  const mesesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    lancamentos.forEach(l => {
      if (l.mes_referencia) s.add(l.mes_referencia);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [lancamentos]);

  // Filtragem dos lançamentos
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtroAno !== 'TODOS') {
        const itemYear = l.mes_referencia ? l.mes_referencia.split('-')[0] : l.data?.split('-')[0];
        if (itemYear !== filtroAno) return false;
      }
      if (filtroMes !== 'TODOS' && l.mes_referencia !== filtroMes) {
        return false;
      }
      if (filtroTerceiro !== 'TODOS' && l.terceiro_nome.trim() !== filtroTerceiro.trim()) {
        return false;
      }
      if (filtroCategoria !== 'TODOS' && l.categoria !== filtroCategoria) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchNome = l.terceiro_nome?.toLowerCase().includes(term);
        const matchDesc = l.descricao?.toLowerCase().includes(term);
        const matchObra = l.obra_relacionada?.toLowerCase().includes(term);
        const matchVal = l.valor?.toString().includes(term);
        if (!matchNome && !matchDesc && !matchObra && !matchVal) return false;
      }
      return true;
    });
  }, [lancamentos, filtroAno, filtroMes, filtroTerceiro, filtroCategoria, searchTerm]);

  // Métricas Consolidadas (KPIs)
  const metricas = useMemo(() => {
    const totalGasto = lancamentosFiltrados.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);
    const qtdLancamentos = lancamentosFiltrados.length;
    
    // Metros totais perfurados por terceiros / barras no período correspondente
    let metrosMND = 0;
    barras.forEach(b => {
      if (b.tipo_registro === 'CAIXA' || b.tem_caixa) return;
      const bMes = b.mes_referencia || b.data_referencia?.slice(0, 7) || b.horario_registro?.slice(0, 7);
      if (filtroAno !== 'TODOS' && bMes && !bMes.startsWith(filtroAno)) return;
      if (filtroMes !== 'TODOS' && bMes !== filtroMes) return;
      metrosMND += Number(b.metros) || 0;
    });

    const terceirosAtivosCount = new Set(lancamentosFiltrados.map(l => l.terceiro_nome)).size;
    const custoPorMetro = metrosMND > 0 ? (totalGasto / metrosMND) : 0;

    return {
      totalGasto,
      qtdLancamentos,
      metrosMND,
      terceirosAtivosCount,
      custoPorMetro
    };
  }, [lancamentosFiltrados, barras, filtroAno, filtroMes]);

  // Dados para o Gráfico de Evolução Mensal (Custos de Terceiros e Metros MND)
  const dadosEvolucaoMensal = useMemo(() => {
    const mesesMap: Record<string, { mes: string; custo: number; metros: number; terceiros: Set<string> }> = {
      '2026-03': { mes: 'Mar/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-04': { mes: 'Abr/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-05': { mes: 'Mai/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-06': { mes: 'Jun/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-07': { mes: 'Jul/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-08': { mes: 'Ago/26', custo: 0, metros: 0, terceiros: new Set() },
      '2026-09': { mes: 'Set/26', custo: 0, metros: 0, terceiros: new Set() }
    };

    // Adiciona custos de terceiros
    lancamentos.forEach(l => {
      const m = l.mes_referencia;
      if (m && mesesMap[m]) {
        mesesMap[m].custo += Number(l.valor) || 0;
        mesesMap[m].terceiros.add(l.terceiro_nome);
      }
    });

    // Adiciona metros executados da produção
    barras.forEach(b => {
      if (b.tipo_registro === 'CAIXA' || b.tem_caixa) return;
      const bMes = b.mes_referencia || b.data_referencia?.slice(0, 7);
      if (bMes && mesesMap[bMes]) {
        mesesMap[bMes].metros += Number(b.metros) || 0;
      }
    });

    return Object.entries(mesesMap).map(([key, item]) => ({
      key,
      mes: item.mes,
      custo: Math.round(item.custo),
      metros: Math.round(item.metros),
      qtdTerceiros: item.terceiros.size
    }));
  }, [lancamentos, barras]);

  // Distribuição por Terceiro (Top Prestadores)
  const dadosTopTerceiros = useMemo(() => {
    const mapa: Record<string, number> = {};
    lancamentosFiltrados.forEach(l => {
      const nome = l.terceiro_nome || 'Outros';
      mapa[nome] = (mapa[nome] || 0) + (Number(l.valor) || 0);
    });

    const arr = Object.entries(mapa).map(([nome, valor]) => ({
      nome,
      valor: Math.round(valor)
    }));

    arr.sort((a, b) => b.valor - a.valor);
    return arr.slice(0, 8); // Top 8 terceiros
  }, [lancamentosFiltrados]);

  // Exclusão de Lançamento
  const handleDeleteLancamento = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento de "${nome}"?`)) return;
    const ok = await ApiService.deleteTerceiroLancamento(id);
    if (ok) {
      setLancamentos(prev => prev.filter(l => l.id !== id));
    }
  };

  // Criação de Novo Lançamento
  const handleCriarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoItem.terceiro_nome.trim() || !novoItem.valor) {
      alert('Preencha o nome do terceiro e o valor.');
      return;
    }

    setSalvando(true);
    try {
      const criado = await ApiService.createTerceiroLancamento({
        terceiro_nome: novoItem.terceiro_nome.trim(),
        descricao: novoItem.descricao.trim() || `Prestação de Serviços - ${novoItem.terceiro_nome}`,
        data: novoItem.data,
        mes_referencia: novoItem.mes_referencia,
        valor: parseFloat(novoItem.valor.replace(',', '.')),
        categoria: novoItem.categoria,
        tipo_transacao: novoItem.tipo_transacao,
        metros_executados: novoItem.metros_executados ? parseFloat(novoItem.metros_executados.replace(',', '.')) : undefined,
        obra_relacionada: novoItem.obra_relacionada,
        status: novoItem.status
      });

      setLancamentos(prev => [criado, ...prev]);
      setShowNovoModal(false);
      setNovoItem({
        terceiro_nome: '',
        descricao: '',
        data: new Date().toISOString().split('T')[0],
        mes_referencia: new Date().toISOString().slice(0, 7),
        valor: '',
        categoria: 'Terceiros',
        tipo_transacao: 'PIX',
        metros_executados: '',
        obra_relacionada: 'SANEAMENTO DOM PEDRITO (TD-01)',
        status: 'PAGO'
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao criar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  // Exportação Excel
  const handleExportExcel = () => {
    const dataToExport = lancamentosFiltrados.map(l => ({
      'ID Lançamento': l.id,
      'Data': l.data,
      'Mês Referência': l.mes_referencia,
      'Terceiro / Prestador': l.terceiro_nome,
      'Descrição': l.descricao,
      'Categoria': l.categoria,
      'Forma Pagamento': l.tipo_transacao,
      'Valor (R$)': Number(l.valor) || 0,
      'Metros MND (m)': l.metros_executados || '',
      'Obra / Destino': l.obra_relacionada || '',
      'Status': l.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Terceiros_Tecnodrill');
    XLSX.writeFile(wb, `Tecnodrill_Terceiros_${filtroMes !== 'TODOS' ? filtroMes : 'Consolidado'}.xlsx`);
  };

  // Exportação PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('TECNODRILL - Relatório Gerencial de Custos com Terceiros', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${filtroMes !== 'TODOS' ? filtroMes : 'Ano ' + filtroAno} | Total Registros: ${lancamentosFiltrados.length} | Custo Total: R$ ${metricas.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 22);

    const tableBody = lancamentosFiltrados.map(l => [
      l.data,
      l.mes_referencia,
      l.terceiro_nome,
      l.descricao,
      l.categoria,
      l.tipo_transacao,
      `R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      l.status
    ]);

    autoTable(doc, {
      head: [['Data', 'Mês Ref', 'Terceiro', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Status']],
      body: tableBody,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [14, 116, 144] }
    });

    doc.save(`Tecnodrill_Relatorio_Terceiros_${filtroMes}.pdf`);
  };

  if (!isGestor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900/60 rounded-2xl border border-red-500/20 backdrop-blur-md">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito à Gestão</h2>
        <p className="text-slate-400 max-w-md">
          O módulo de controle financeiro e gestão de produtividade com terceiros é confidencial e exclusivo para Gestores e Administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner de Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 p-5 rounded-2xl border border-cyan-800/30 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Gestão Executiva de Terceiros
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Somente Gestão
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Controle analítico de produtividade, adiantamentos, destratos e pagamentos de equipes terceirizadas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNovoModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 font-medium text-sm transition-all"
            title="Exportar para Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 font-medium text-sm transition-all"
            title="Exportar para PDF"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* 4 CARDS DE KPI (Executive Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Custo Total */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pago a Terceiros</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {metricas.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span className="text-cyan-400 font-semibold">{metricas.qtdLancamentos}</span> lançamentos contabilizados
          </div>
        </div>

        {/* Card 2: Metros MND */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Produção MND no Período</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {metricas.metrosMND.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span>{(metricas.metrosMND / 1000).toFixed(2)} km</span> perfurados no sistema
          </div>
        </div>

        {/* Card 3: Custo por Metro */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custo Terceiro / Metro MND</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            R$ {metricas.custoPorMetro.toFixed(2)} /m
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            Relação direta de custo por metro executado
          </div>
        </div>

        {/* Card 4: Terceiros Ativos */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Terceiros & Prestadores</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-400 tracking-tight">
            {metricas.terceirosAtivosCount} prestadores
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            Equipes com lançamentos ativos
          </div>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mês de Referência */}
          <div className="flex items-center gap-2 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Competência:</span>
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900">Todos os Meses</option>
              {mesesDisponiveis.map(m => (
                <option key={m} value={m} className="bg-slate-900">{m}</option>
              ))}
            </select>
          </div>

          {/* Terceiro / Prestador */}
          <div className="flex items-center gap-2 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Prestador:</span>
            <select
              value={filtroTerceiro}
              onChange={e => setFiltroTerceiro(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="TODOS" className="bg-slate-900">Todos os Prestadores</option>
              {terceirosUnicos.map(t => (
                <option key={t} value={t} className="bg-slate-900">{t}</option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div className="flex items-center gap-2 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Categoria:</span>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900">Todas as Categorias</option>
              <option value="Terceiros" className="bg-slate-900">Terceiros</option>
              <option value="Prestadores de Serviços" className="bg-slate-900">Prestadores de Serviços</option>
            </select>
          </div>
        </div>

        {/* Input de Busca */}
        <div className="relative min-w-[240px] flex-1 md:flex-initial">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar terceiro, descrição ou valor..."
            className="w-full bg-slate-800/70 text-white placeholder-slate-500 pl-9 pr-4 py-1.5 rounded-xl border border-slate-700/60 text-xs focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>
      </div>

      {/* GRÁFICOS VISUAIS DE BI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Evolução Mensal dos Custos com Terceiros */}
        <div className="lg:col-span-2 bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Evolução Mensal de Custos e Produtividade (2026)
              </h2>
              <p className="text-xs text-slate-400">Comparativo mês a mês entre custos pagos a terceiros (R$) e metros perfurados (m)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block" /> Custo Terceiros (R$)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Metros MND (m)
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosEvolucaoMensal} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis yAxisId="custo" stroke="#38BDF8" fontSize={11} tickLine={false} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="metros" orientation="right" stroke="#10B981" fontSize={11} tickLine={false} tickFormatter={v => `${v}m`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'custo') return [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Custo Terceiros'];
                    if (name === 'metros') return [`${Number(value).toLocaleString('pt-BR')} m`, 'Metros MND'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="custo" dataKey="custo" fill="#38BDF8" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Line yAxisId="metros" type="monotone" dataKey="metros" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top Prestadores por Volume Financeiro */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-emerald-400" />
              Top Prestadores & Terceiros
            </h2>
            <p className="text-xs text-slate-400 mb-4">Concentração de custos no período filtrado</p>

            <div className="h-[210px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosTopTerceiros}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="valor"
                  >
                    {dadosTopTerceiros.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CORES_PALETA[index % CORES_PALETA.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Total Pago']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400 font-medium">Top 8</span>
                <span className="text-sm font-bold text-white">Prestadores</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-[90px] overflow-y-auto pr-1">
            {dadosTopTerceiros.slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CORES_PALETA[idx % CORES_PALETA.length] }} />
                <span className="truncate">{item.nome}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABELA DETALHADA DE LANÇAMENTOS */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Histórico Detalhado de Lançamentos ({lancamentosFiltrados.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Total exibido: <strong className="text-cyan-400 font-semibold">R$ {metricas.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Data / Ref</th>
                <th className="py-3 px-4">Terceiro / Prestador</th>
                <th className="py-3 px-4">Descrição do Lançamento</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Forma</th>
                <th className="py-3 px-4 text-right">Valor (R$)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lancamentosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-white">{item.data}</div>
                      <div className="text-[10px] text-cyan-400">Ref: {item.mes_referencia}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                          {item.terceiro_nome ? item.terceiro_nome.charAt(0).toUpperCase() : 'T'}
                        </span>
                        {item.terceiro_nome}
                      </div>
                      {item.obra_relacionada && (
                        <div className="text-[10px] text-slate-500 pl-8">{item.obra_relacionada}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="truncate text-slate-200" title={item.descricao}>
                        {item.descricao}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-400">{item.tipo_transacao}</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-bold text-red-400">
                        R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteLancamento(item.id, item.terceiro_nome)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir Lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NOVO LANÇAMENTO DE TERCEIRO */}
      {showNovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Novo Lançamento com Terceiro</h3>
              </div>
              <button 
                onClick={() => setShowNovoModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarLancamento} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nome do Terceiro / Prestador *</label>
                  <input
                    type="text"
                    required
                    value={novoItem.terceiro_nome}
                    onChange={e => setNovoItem({ ...novoItem, terceiro_nome: e.target.value })}
                    placeholder="Ex: Alan Terceiro, Denilson HDD..."
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Valor do Custo (R$) *</label>
                  <input
                    type="text"
                    required
                    value={novoItem.valor}
                    onChange={e => setNovoItem({ ...novoItem, valor: e.target.value })}
                    placeholder="Ex: 5000,00"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data do Pagamento *</label>
                  <input
                    type="date"
                    required
                    value={novoItem.data}
                    onChange={e => setNovoItem({ ...novoItem, data: e.target.value, mes_referencia: e.target.value.slice(0, 7) })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Mês de Competência *</label>
                  <input
                    type="month"
                    required
                    value={novoItem.mes_referencia}
                    onChange={e => setNovoItem({ ...novoItem, mes_referencia: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição / Finalidade do Pagamento</label>
                <input
                  type="text"
                  value={novoItem.descricao}
                  onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })}
                  placeholder="Ex: Pagamento produção mês, Adiantamento, Mão de obra..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Categoria</label>
                  <select
                    value={novoItem.categoria}
                    onChange={e => setNovoItem({ ...novoItem, categoria: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Terceiros">Terceiros</option>
                    <option value="Prestadores de Serviços">Prestadores de Serviços</option>
                    <option value="Mão de Obra Terceirizada">Mão de Obra Terceirizada</option>
                    <option value="Locação de Equipamentos">Locação de Equipamentos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Forma de Pagamento</label>
                  <select
                    value={novoItem.tipo_transacao}
                    onChange={e => setNovoItem({ ...novoItem, tipo_transacao: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Transferência Bancária">Transferência Bancária (TED/DOC)</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Metros Executados (opcional)</label>
                  <input
                    type="text"
                    value={novoItem.metros_executados}
                    onChange={e => setNovoItem({ ...novoItem, metros_executados: e.target.value })}
                    placeholder="Ex: 150.0"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Obra / Destino</label>
                  <input
                    type="text"
                    value={novoItem.obra_relacionada}
                    onChange={e => setNovoItem({ ...novoItem, obra_relacionada: e.target.value })}
                    placeholder="Ex: SANEAMENTO DOM PEDRITO"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
                >
                  {salvando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Lançamento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
