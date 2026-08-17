import React, { useState, useEffect } from 'react';
import { DashboardGestorMetrics, Servico } from '../types';
import { ApiService } from '../services/api';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  HardHat, 
  DollarSign, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  MapPin, 
  Calendar,
  Sparkles,
  Plus
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface GestorDashboardProps {
  onSelectServico: (servicoId: string) => void;
  onNovoServico: () => void;
}

export const GestorDashboard: React.FC<GestorDashboardProps> = ({ onSelectServico, onNovoServico }) => {
  const [metrics, setMetrics] = useState<DashboardGestorMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getDashboard();
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#F05A22] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--text-muted)] font-medium">Carregando indicadores da TecnoDrill...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Header */}
      <div className="top-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <span>Cockpit Gestão TecnoDrill INFRA</span>
            <span className="badge badge-primary text-[10px]">Gestores: Eduardo & Carlos</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Acompanhamento de metas de perfuração e apuração de faturamento por serviço
          </p>
        </div>

        <button
          onClick={onNovoServico}
          className="btn-primary text-xs sm:text-sm py-2.5 px-4"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nova Obra / Serviço</span>
        </button>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Metros */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Metragem Executada
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mt-1">
              {metrics.totalMetrosPerfurados} <span className="text-base font-semibold text-[#F05A22]">MTS</span>
            </span>
            <span className="text-[11px] text-emerald-500 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 size={13} /> {metrics.totalFurosFinalizados} furos finalizados
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F05A22]/15 border border-[#F05A22]/30 flex items-center justify-center text-[#F05A22]">
            <Radio size={24} />
          </div>
        </div>

        {/* Card 2: Faturamento */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Retorno Estimado
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
              R$ {metrics.totalRetornoFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] mt-1">
              Conforme regras dos 3 cenários
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Card 3: Obras */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Obras & Frentes
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mt-1">
              {metrics.totalServicosAtivos} <span className="text-base font-semibold text-[var(--text-muted)]">Ativas</span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)] mt-1">
              Em andamento no campo
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <HardHat size={24} />
          </div>
        </div>

        {/* Card 4: Metas */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Índice de Metas
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mt-1">
              {metrics.taxaAtingimentoMetas}%
            </span>
            <span className="text-[11px] text-yellow-400 font-semibold mt-1 flex items-center gap-1">
              <Sparkles size={13} /> Produtividade em alta
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
            <Target size={24} />
          </div>
        </div>
      </div>

      {/* Production Chart */}
      {metrics.evolucaoDiaria && metrics.evolucaoDiaria.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">
                Produção Diária de Metros Perfurados
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Acompanhamento cronológico dos últimos lançamentos de sonda
              </p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.evolucaoDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="data" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit="m" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1F2730] border border-white/10 p-2.5 rounded-xl shadow-xl text-xs">
                          <span className="text-gray-400 block">{data.data}</span>
                          <span className="font-bold text-[#F05A22]">{data.metros} metros perfurados</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="metros" fill="#F05A22" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Services List with Financial & Target Details */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-main)]">
            Serviços, Produtividade & Retorno Financeiro
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            {metrics.servicos.length} obra(s) cadastrada(s)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {metrics.servicos.map((s) => {
            const pct = Math.min(100, Math.round(s.percentualConcluido));
            const metaPct = s.meta.percentualMetaPeriodo;

            let cenarioDesc = '';
            if (s.cenarioFinanceiro === 'VALOR_METRO') cenarioDesc = 'Cenário 1: Valor por Metro';
            else if (s.cenarioFinanceiro === 'FATOR_DIAMETRO_METRO') cenarioDesc = 'Cenário 2: (Fator × Diâmetro) × Metro';
            else cenarioDesc = 'Cenário 3: Valor Fechado Proporcional';

            return (
              <div
                key={s.servicoId}
                onClick={() => onSelectServico(s.servicoId)}
                className="card p-5 cursor-pointer transition-all hover:border-[#F05A22] flex flex-col gap-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F05A22]/20 border border-[#F05A22]/40 flex items-center justify-center text-[#F05A22] font-bold text-xs shrink-0">
                      TD
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-main)] hover:text-[#F05A22] transition-colors">
                        {s.nome}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                        <span className="font-semibold text-gray-300">{s.cliente}</span>
                        <span>•</span>
                        <span className="badge badge-primary text-[9px]">{cenarioDesc}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Return Pill */}
                  <div className="flex items-center gap-4 sm:text-right">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[var(--text-muted)]">Retorno Calculado</span>
                      <span className="text-lg font-black text-emerald-400">
                        R$ {s.retornoFinanceiroCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <ChevronRight className="text-[var(--text-muted)]" size={20} />
                  </div>
                </div>

                {/* Progress Bars: Total Obra & Meta do Período */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-color)]">
                  {/* Total Meters Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-muted)] font-medium">Progresso Físico Total</span>
                      <span className="font-bold text-[var(--text-main)]">
                        {s.metrosExecutados}m / {s.metragemPrevistaTotal}m ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-700/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#F05A22] to-[#FF7744] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta do Dia/Semana */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-muted)] font-medium flex items-center gap-1">
                        <Target size={13} className="text-[#F05A22]" />
                        Meta {s.meta.tipo === 'DIARIA' ? 'Diária' : 'Semanal'} ({s.meta.valorMetaMetros}m)
                      </span>
                      <span className={`font-bold ${s.meta.metaAtingida ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {s.meta.metrosPeriodoAtual}m ({metaPct}%) {s.meta.metaAtingida ? '🎉 Batida!' : ''}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-700/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          s.meta.metaAtingida ? 'bg-emerald-400' : 'bg-yellow-400'
                        }`}
                        style={{ width: `${Math.min(100, metaPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation Details Subtext */}
                <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between font-mono">
                  <span>Fórmula: {s.detalhesCalculo.formula}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
