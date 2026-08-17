import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { Servico, Furo, Barra } from '../types';
import { 
  Trophy, 
  Target, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  HardHat, 
  Box, 
  Camera, 
  Sparkles,
  Flame,
  Award
} from 'lucide-react';

interface PerformancePageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ setHeaderInfo }) => {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barras, setBarras] = useState<Barra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHeaderInfo('Performance & Metas', 'Acompanhamento diário e semanal de produção');
  }, [setHeaderInfo]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const servs = await ApiService.getServicos();
        setServicos(servs);

        // Carregar barras de todas as obras ativas
        const allBarras: Barra[] = [];
        for (const s of servs) {
          const furos = await ApiService.getFuros(s.id);
          for (const f of furos) {
            const b = await ApiService.getBarras(f.id);
            allBarras.push(...b);
          }
        }
        setBarras(allBarras);
      } catch (err) {
        console.error('Erro ao carregar dados de performance:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton" style={{ height: '140px', borderRadius: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  // Cálculos de Produção
  const totalMetros = barras.reduce((acc, b) => acc + (b.metros || 3), 0);
  const totalRegistros = barras.length;
  const totalCaixas = barras.filter(b => b.tem_caixa).length;
  const totalCanalizacao = totalRegistros - totalCaixas;

  // Filtrar produção de Hoje
  const todayStr = new Date().toISOString().split('T')[0];
  const barrasHoje = barras.filter(b => {
    const d = b.created_at || b.data_registro || b.horario_registro;
    return d && d.startsWith(todayStr);
  });
  const metrosHoje = barrasHoje.reduce((acc, b) => acc + (b.metros || 3), 0);

  // Meta diária consolidada das obras ativas (ou padrão 100m)
  const metaDiariaConsolidada = servicos.reduce((acc, s) => acc + (s.meta_metros || 100), 0) || 100;
  const percentualHoje = Math.min(150, Math.round((metrosHoje / metaDiariaConsolidada) * 100));
  const metaBatidaHoje = metrosHoje >= metaDiariaConsolidada;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '30px' }}>
      
      {/* 1. HERO CARD: META DO DIA COM ANIMAÇÃO & STATUS */}
      <div 
        style={{
          background: metaBatidaHoje 
            ? 'linear-gradient(135deg, rgba(39, 174, 96, 0.25) 0%, rgba(13, 28, 36, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(240, 90, 34, 0.2) 0%, rgba(13, 28, 36, 0.95) 100%)',
          border: `1.5px solid ${metaBatidaHoje ? 'var(--success)' : 'var(--primary)'}`,
          borderRadius: '20px',
          padding: '22px 20px',
          boxShadow: metaBatidaHoje 
            ? '0 10px 30px rgba(39, 174, 96, 0.25)'
            : '0 10px 30px rgba(240, 90, 34, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: metaBatidaHoje ? 'rgba(39, 174, 96, 0.2)' : 'rgba(240, 90, 34, 0.15)',
                border: `1px solid ${metaBatidaHoje ? 'var(--success)' : 'var(--primary)'}`,
                color: metaBatidaHoje ? 'var(--success)' : 'var(--primary)',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}
            >
              {metaBatidaHoje ? <Sparkles size={13} /> : <Flame size={13} />}
              <span>{metaBatidaHoje ? 'Meta Diária Conquistada! 🎯' : 'Produção Diária em Andamento'}</span>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              {metrosHoje}m <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>/ meta de {metaDiariaConsolidada}m</span>
            </h2>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              {barrasHoje.length} apontamentos realizados hoje
            </span>
          </div>

          <div 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: metaBatidaHoje ? 'rgba(39, 174, 96, 0.2)' : 'rgba(240, 90, 34, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: metaBatidaHoje ? '#FFD700' : 'var(--primary)'
            }}
          >
            <Trophy size={30} />
          </div>
        </div>

        {/* Barra de Progresso Diária */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Progresso Hoje</span>
            <span style={{ color: metaBatidaHoje ? 'var(--success)' : 'var(--primary)' }}>
              {percentualHoje}%
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: '4px', overflow: 'hidden' }}>
            <div 
              style={{
                width: `${Math.min(100, percentualHoje)}%`,
                height: '100%',
                backgroundColor: metaBatidaHoje ? 'var(--success)' : 'var(--primary)',
                transition: 'width 0.5s ease',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. STATS CARDS GRID */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Total Metros */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <TrendingUp size={16} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Metros Totais
            </span>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', display: 'block' }}>
            {totalMetros}m
          </strong>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            acumulado nas obras
          </span>
        </div>

        {/* Caixas Instaladas */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '4px' }}>
            <Box size={16} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Caixas
            </span>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', display: 'block' }}>
            {totalCaixas}
          </strong>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {totalCanalizacao} canalizações
          </span>
        </div>

        {/* Total Registros */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2A8ACC', marginBottom: '4px' }}>
            <Camera size={16} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Apontamentos
            </span>
          </div>
          <strong style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', display: 'block' }}>
            {totalRegistros}
          </strong>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            fotos georreferenciadas
          </span>
        </div>
      </div>

      {/* 3. LISTA DE OBRAS ATIVAS E PROGRESSO OPERACIONAL */}
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <HardHat size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Metas por Frente de Trabalho
          </h3>
        </div>

        {servicos.length === 0 ? (
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
            Nenhum serviço em andamento no momento.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {servicos.map((s) => {
              const barrasDaObra = barras.filter(b => b.furo_id && s.id);
              const metrosObra = s.metragem_prevista_total || 1000;
              const metaDia = s.meta_metros || 100;

              return (
                <div 
                  key={s.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '13.5px', color: '#FFFFFF', display: 'block' }}>
                        {s.nome}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {s.cliente} • {s.local}
                      </span>
                    </div>

                    <span 
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(240, 90, 34, 0.15)',
                        color: 'var(--primary)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      META: {metaDia}m/dia
                    </span>
                  </div>

                  {/* Equipe Responsável */}
                  {(s.navegador_nome || s.operador_nome) && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {s.navegador_nome && (
                        <span>Nav: <strong style={{ color: '#FFFFFF' }}>{s.navegador_nome}</strong></span>
                      )}
                      {s.operador_nome && (
                        <span>Op: <strong style={{ color: '#FFFFFF' }}>{s.operador_nome}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default PerformancePage;
