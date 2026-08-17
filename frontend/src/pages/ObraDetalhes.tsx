import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Servico, Furo, Barra } from '../types';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RodEntryModal } from '../components/RodEntryModal';
import { MetaCelebration } from '../components/MetaCelebration';
import { MapView } from '../components/MapView';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NovoServicoModal } from '../components/NovoServicoModal';
import { 
  ArrowLeft, 
  Trash2, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Box, 
  ArrowUpDown, 
  X,
  Clock,
  Map as MapIcon,
  Image as ImageIcon,
  Edit
} from 'lucide-react';

interface ObraDetalhesProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
  servicoId: string;
  onBack: () => void;
  onVerFichaOficial?: () => void;
}

export const ObraDetalhes: React.FC<ObraDetalhesProps> = ({
  setHeaderInfo,
  servicoId,
  onBack
}) => {
  const { user, showToast } = useAuth();
  const [servico, setServico] = useState<Servico | null>(null);
  const [furo, setFuro] = useState<Furo | null>(null);
  const [barras, setBarras] = useState<Barra[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs & Filters (Identical to JLE: Fotos | Mapa)
  const [activeTab, setActiveTab] = useState<'fotos' | 'mapa'>('fotos');
  const [filterType, setFilterType] = useState<'TODOS' | 'COM_CAIXA' | 'SEM_CAIXA'>('TODOS');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingBarra, setSavingBarra] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Modal Editar Serviço
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEditServico, setSavingEditServico] = useState(false);

  // Confirm Dialogs (Custom UI, never native browser alerts)
  const [confirmDeleteServicoOpen, setConfirmDeleteServicoOpen] = useState(false);
  const [confirmDeleteBarraId, setConfirmDeleteBarraId] = useState<string | null>(null);

  // Meta Celebration
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    metaMetros: number;
    metrosAtingidos: number;
    tipoMeta: 'DIARIA' | 'SEMANAL';
  }>({ metaMetros: 54, metrosAtingidos: 54, tipoMeta: 'DIARIA' });

  const isGestor = user?.perfil === 'GESTOR' || user?.perfil === 'ADMIN';

  const fetchDados = async () => {
    setLoading(true);
    try {
      const s = await ApiService.getServico(servicoId);
      setServico(s);
      setHeaderInfo(s.nome, `OS: ${s.id} · ${s.cliente} (${s.local})`);

      const furos = await ApiService.getFuros(servicoId);
      if (furos.length > 0) {
        setFuro(furos[0]);
        const b = await ApiService.getBarras(furos[0].id);
        setBarras(b);
      } else {
        const novoFuro = await ApiService.createFuro({
          servico_id: servicoId,
          navegador_nome: user?.nome || 'Navegador',
          operador_nome: 'Operador',
          status: 'EM_EXECUCAO'
        });
        setFuro(novoFuro);
        setBarras([]);
      }
    } catch (err) {
      console.error('Erro ao carregar obra:', err);
      showToast('Erro ao carregar detalhes do serviço.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [servicoId]);

  const handleAddBarra = async (barraData: Partial<Barra>) => {
    if (!furo) return;
    setSavingBarra(true);

    try {
      const res = await ApiService.addBarra(furo.id, barraData);
      setBarras(prev => [...prev, res.barra]);
      setShowAddModal(false);
      showToast(res.mensagem, 'success');

      const metaTotal = servico?.meta_metros || 100;
      const totalApos = res.barra.metros_acumulados;
      if (res.celebrarMeta || totalApos >= metaTotal) {
        setCelebrationData({
          metaMetros: metaTotal,
          metrosAtingidos: totalApos,
          tipoMeta: 'DIARIA'
        });
        setCelebrationOpen(true);
      }
      fetchDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar progresso.', 'error');
    } finally {
      setSavingBarra(false);
    }
  };

  const handleUpdateServico = async (servicoData: Partial<Servico>) => {
    if (!servico) return;
    setSavingEditServico(true);
    try {
      const updated = await ApiService.updateServico(servico.id, servicoData);
      setServico(updated);
      showToast('Serviço atualizado com sucesso!', 'success');
      setShowEditModal(false);
      fetchDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar serviço.', 'error');
    } finally {
      setSavingEditServico(false);
    }
  };

  const handleConfirmDeleteBarra = async () => {
    if (!confirmDeleteBarraId) return;
    try {
      await ApiService.deleteBarra(confirmDeleteBarraId);
      setBarras(prev => prev.filter(b => b.id !== confirmDeleteBarraId));
      showToast('Registro de campo excluído com sucesso.', 'info');
      setConfirmDeleteBarraId(null);
      fetchDados();
    } catch (err) {
      showToast('Erro ao excluir registro.', 'error');
    }
  };

  const handleConfirmDeleteServico = () => {
    showToast(`Serviço ${servico?.nome} excluído.`, 'info');
    setConfirmDeleteServicoOpen(false);
    onBack();
  };

  const handleConcluirServico = async () => {
    if (!servico) return;
    try {
      await ApiService.updateServico(servico.id, { status: 'CONCLUIDO' });
      showToast('Serviço alterado para Concluído com sucesso!', 'success');
      fetchDados();
    } catch (err) {
      showToast('Erro ao concluir serviço.', 'error');
    }
  };

  if (loading || !servico) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="skeleton" style={{ width: '100%', height: '260px', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  // Cálculos de Métricas
  const metrosExec = barras.length > 0 ? (barras[barras.length - 1]?.metros_acumulados || 0) : 0;
  const metrosTotalPrevisto = servico.metragem_prevista_total || 1000;
  const percentualConcluido = metrosTotalPrevisto > 0 
    ? Math.min(100, Math.round((metrosExec / metrosTotalPrevisto) * 100))
    : 0;

  const totalComCaixa = barras.filter(b => b.tem_caixa).length;
  const totalSemCaixa = barras.filter(b => !b.tem_caixa).length;
  const retornoCalculado = servico.metricas?.retornoFinanceiroCalculado || 0;

  // Filtragem de fotos e registros
  const filteredBarras = barras
    .filter(b => {
      if (filterType === 'COM_CAIXA') return b.tem_caixa;
      if (filterType === 'SEM_CAIXA') return !b.tem_caixa;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'DESC') return b.numero_barra - a.numero_barra;
      return a.numero_barra - b.numero_barra;
    });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. UPPER HEADER (Padrão de todas as telas) */}
      <div className="upper-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={15} />
            <span>Voltar</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="header-title" style={{ margin: 0, textTransform: 'uppercase' }}>
                {servico.nome}
              </h1>
              <span 
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(240, 90, 34, 0.15)',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                OS: {servico.id}
              </span>
            </div>

            <p className="header-subtitle" style={{ margin: '3px 0 0 0' }}>
              {servico.cliente} • {servico.local}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isGestor && (
            <>
              {/* Botão Editar Serviço */}
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary"
                style={{
                  padding: '8px 13px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Edit size={14} />
                <span>Editar</span>
              </button>

              {/* Botão Excluir Serviço */}
              <button
                onClick={() => setConfirmDeleteServicoOpen(true)}
                style={{
                  backgroundColor: 'rgba(231, 76, 60, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  padding: '8px 13px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            </>
          )}

          {/* Botão Novo Registro */}
          <button
            onClick={() => setShowAddModal(true)}
            className="header-action-btn"
          >
            <Camera size={16} />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>

      {/* 2. ALERT BANNER (REVISÃO PENDENTE / CONCLUÍDO) */}
      {percentualConcluido >= 100 && servico.status !== 'CONCLUIDO' && (
        <div 
          style={{
            backgroundColor: 'rgba(240, 90, 34, 0.08)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                Serviço 100% Concluído - Revisão Pendente
              </strong>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Todos os {metrosTotalPrevisto} metros previstos foram executados. Avalie os registros antes de concluir.
              </p>
            </div>
          </div>

          <button
            onClick={handleConcluirServico}
            style={{
              backgroundColor: 'var(--success)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <CheckCircle2 size={15} />
            <span>Alterar para Concluída</span>
          </button>
        </div>
      )}

      {/* 3. OVERVIEW CARDS ROW (4 CARDS LADO A LADO - PADRÃO JLE) */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: Progresso */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Progresso do Serviço
          </span>
          <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', display: 'block', margin: '4px 0' }}>
            {percentualConcluido}%
          </strong>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ width: `${percentualConcluido}%`, height: '100%', backgroundColor: percentualConcluido >= 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Card 2: Metros Realizados */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Metros Realizados
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '4px 0' }}>
            <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
              {metrosExec}
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              / {metrosTotalPrevisto}m
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {barras.length} registros apontados
          </span>
        </div>

        {/* Card 3: Caixas Instaladas */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Possui Caixa
          </span>
          <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', display: 'block', margin: '4px 0' }}>
            {totalComCaixa}
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {totalSemCaixa} sem caixa
          </span>
        </div>

        {/* Card 4: Retorno Financeiro */}
        <div 
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Retorno Financeiro
          </span>
          <strong style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)', display: 'block', margin: '4px 0' }}>
            R$ {retornoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {servico.cenario_financeiro === 'VALOR_METRO' && `R$ ${servico.valor_metro}/m`}
            {servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO' && `Fator ${servico.fator_financeiro} × ${servico.diametro_furo_mm}mm`}
            {servico.cenario_financeiro === 'VALOR_FECHADO' && `Valor Fechado`}
          </span>
        </div>
      </div>

      {/* 4. SUBHEADER TABS: FOTOS | MAPA (PADRÃO JLE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
          <button
            onClick={() => setActiveTab('fotos')}
            style={{
              padding: '8px 4px',
              fontSize: '13.5px',
              fontWeight: 700,
              color: activeTab === 'fotos' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === 'fotos' ? 'var(--primary)' : 'transparent'}`,
              backgroundColor: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ImageIcon size={16} />
            <span>Fotos ({barras.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mapa')}
            style={{
              padding: '8px 4px',
              fontSize: '13.5px',
              fontWeight: 700,
              color: activeTab === 'mapa' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === 'mapa' ? 'var(--primary)' : 'transparent'}`,
              backgroundColor: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <MapIcon size={16} />
            <span>Mapa</span>
          </button>
        </div>

        {/* Visualização de Fotos */}
        {activeTab === 'fotos' && (
          <>
            {/* Filter Pills and Sort Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {/* Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterType('TODOS')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: filterType === 'TODOS' ? 'var(--primary)' : 'var(--bg-card)',
                    color: filterType === 'TODOS' ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${filterType === 'TODOS' ? 'var(--primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer'
                  }}
                >
                  TODOS ({barras.length})
                </button>

                <button
                  onClick={() => setFilterType('COM_CAIXA')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: filterType === 'COM_CAIXA' ? 'var(--primary)' : 'var(--bg-card)',
                    color: filterType === 'COM_CAIXA' ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${filterType === 'COM_CAIXA' ? 'var(--primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer'
                  }}
                >
                  POSSUI CAIXA ({totalComCaixa})
                </button>

                <button
                  onClick={() => setFilterType('SEM_CAIXA')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: filterType === 'SEM_CAIXA' ? 'var(--primary)' : 'var(--bg-card)',
                    color: filterType === 'SEM_CAIXA' ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${filterType === 'SEM_CAIXA' ? 'var(--primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer'
                  }}
                >
                  SEM CAIXA ({totalSemCaixa})
                </button>
              </div>

              {/* Right: Count and Sort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  {filteredBarras.length} fotos
                </span>

                <button
                  onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowUpDown size={12} />
                  <span>{sortOrder === 'DESC' ? 'MAIS RECENTES (NOVO → ANTIGO)' : 'MAIS ANTIGOS (ANTIGO → NOVO)'}</span>
                </button>
              </div>
            </div>

            {/* Photo Cards Grid */}
            {filteredBarras.length === 0 ? (
              <div 
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  padding: '48px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <Camera size={44} style={{ marginBottom: '12px', color: 'var(--border-color)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Nenhum registro fotográfico encontrado</h3>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Clique no botão "+ Novo Registro" para apontar a metragem e capturar a foto do local.
                </p>
              </div>
            ) : (
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '14px'
                }}
              >
                {filteredBarras.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Photo Area */}
                    <div 
                      onClick={() => b.foto_url && setPreviewPhotoUrl(b.foto_url)}
                      style={{
                        width: '100%',
                        height: '160px',
                        backgroundColor: '#0D1C24',
                        position: 'relative',
                        cursor: b.foto_url ? 'pointer' : 'default',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {b.foto_url ? (
                        <img 
                          src={b.foto_url} 
                          alt={`Registro ${b.numero_barra}`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', gap: '6px' }}>
                          <Camera size={24} />
                          <span style={{ fontSize: '11px' }}>Sem foto anexada</span>
                        </div>
                      )}

                      {/* Meter Tag Top Right */}
                      <div 
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        +{b.metros || 3}m
                      </div>
                    </div>

                    {/* Card Footer Info */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      
                      {/* Header: Name and Box Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                          REGISTRO {b.numero_barra}
                        </strong>

                        {b.tem_caixa ? (
                          <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)', textTransform: 'uppercase' }}>
                            CAIXA
                          </span>
                        ) : (
                          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            CANALIZAÇÃO
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        <Clock size={11} />
                        <span>
                          {b.horario_registro ? new Date(b.horario_registro).toLocaleString('pt-BR') : 'Data não informada'}
                        </span>
                      </div>

                      {/* Observation */}
                      {b.observacao && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={b.observacao}>
                          {b.observacao}
                        </p>
                      )}

                      {/* Actions (Excluir) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                        <button
                          onClick={() => setConfirmDeleteBarraId(b.id)}
                          style={{
                            color: 'var(--danger)',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none'
                          }}
                          title="Excluir Registro"
                        >
                          <Trash2 size={11} />
                          <span>Excluir</span>
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Visualização do Mapa */}
        {activeTab === 'mapa' && (
          <MapView
            barras={barras}
            onSelectPhoto={(url) => setPreviewPhotoUrl(url)}
          />
        )}

      </div>

      {/* MODAL DE NOVO REGISTRO (PORTAL CENTRALIZADO) */}
      <RodEntryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        nextBarraNumber={barras.length + 1}
        onSubmit={handleAddBarra}
        loading={savingBarra}
      />

      {/* MODAL DE EDITAR SERVIÇO (PORTAL CENTRALIZADO) */}
      <NovoServicoModal
        isOpen={showEditModal}
        initialData={servico}
        onClose={() => setShowEditModal(false)}
        onSave={handleUpdateServico}
        loading={savingEditServico}
      />

      {/* MODAL DE CELEBRAÇÃO (PORTAL CENTRALIZADO) */}
      <MetaCelebration
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        metaMetros={celebrationData.metaMetros}
        metrosAtingidos={celebrationData.metrosAtingidos}
        tipoMeta={celebrationData.tipoMeta}
        nomeServico={servico.nome}
      />

      {/* CONFIRM DIALOG - EXCLUIR SERVIÇO */}
      <ConfirmDialog
        open={confirmDeleteServicoOpen}
        title="Excluir Serviço"
        message={`Deseja realmente excluir o serviço "${servico.nome}"? Esta ação removerá todos os registros associados.`}
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleConfirmDeleteServico}
        onCancel={() => setConfirmDeleteServicoOpen(false)}
      />

      {/* CONFIRM DIALOG - EXCLUIR REGISTRO DE CAMPO */}
      <ConfirmDialog
        open={Boolean(confirmDeleteBarraId)}
        title="Excluir Registro de Campo"
        message="Deseja realmente remover este apontamento fotográfico e a metragem associada?"
        confirmLabel="Excluir Registro"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleConfirmDeleteBarra}
        onCancel={() => setConfirmDeleteBarraId(null)}
      />

      {/* LIGHTBOX AMPLIADO (PORTAL CENTRALIZADO) */}
      {previewPhotoUrl && createPortal(
        <div 
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={previewPhotoUrl} 
              alt="Foto Ampliada" 
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} 
            />
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                borderRadius: '50%',
                padding: '6px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
