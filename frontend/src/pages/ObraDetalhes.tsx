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
import { RegistroDetalhesModal } from '../components/RegistroDetalhesModal';
import { 
  ArrowLeft, 
  Trash2, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpDown, 
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
  const [selectedBarraDetails, setSelectedBarraDetails] = useState<Barra | null>(null);

  // Modal Editar Serviço
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEditServico, setSavingEditServico] = useState(false);

  // Confirm Dialogs
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
      showToast(res.mensagem, 'success');
      setShowAddModal(false);
      await fetchDados();

      if (res.celebrarMeta) {
        const total = res.barra.metros_acumulados;
        const meta = servico?.meta_metros || 54;
        setCelebrationData({
          metaMetros: meta,
          metrosAtingidos: total,
          tipoMeta: 'DIARIA'
        });
        setCelebrationOpen(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar apontamento.', 'error');
    } finally {
      setSavingBarra(false);
    }
  };

  const handleConfirmDeleteBarra = async () => {
    if (!confirmDeleteBarraId) return;
    try {
      await ApiService.deleteBarra(confirmDeleteBarraId);
      showToast('Registro de apontamento excluído.', 'info');
      setConfirmDeleteBarraId(null);
      await fetchDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir registro.', 'error');
    }
  };

  const handleConfirmDeleteServico = async () => {
    if (!servico) return;
    try {
      await ApiService.deleteServico(servico.id);
      showToast(`Serviço ${servico.nome} excluído com sucesso.`, 'info');
      onBack();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir serviço.', 'error');
    }
  };

  const handleUpdateServico = async (dadosAtualizados: Partial<Servico>) => {
    if (!servico) return;
    setSavingEditServico(true);
    try {
      const res = await ApiService.updateServico(servico.id, dadosAtualizados);
      setServico(res);
      showToast('Serviço atualizado com sucesso!', 'success');
      setShowEditModal(false);
      await fetchDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar serviço.', 'error');
    } finally {
      setSavingEditServico(false);
    }
  };

  const handleConcluirServico = async () => {
    if (!servico) return;
    try {
      const res = await ApiService.updateServico(servico.id, { status: 'CONCLUIDO' });
      setServico(res);
      showToast('Serviço marcado como CONCLUÍDO com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao concluir serviço.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="skeleton" style={{ height: '100px' }} />
          <div className="skeleton" style={{ height: '100px' }} />
          <div className="skeleton" style={{ height: '100px' }} />
        </div>
      </div>
    );
  }

  if (!servico) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Serviço não encontrado.</p>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '16px' }}>
          Voltar para lista
        </button>
      </div>
    );
  }

  // Cálculos Oficiais
  const metrosExecutadosTotal = furo?.comprimento_furo || barras.reduce((acc, b) => acc + (b.metros || 3), 0);
  const metrosTotalPrevisto = servico.metragem_prevista_total || 54;
  const percentualConcluido = Math.min(100, Math.round((metrosExecutadosTotal / (metrosTotalPrevisto || 1)) * 100));
  const totalComCaixa = barras.filter(b => b.tem_caixa).length;
  const totalSemCaixa = barras.length - totalComCaixa;

  let retornoCalculado = 0;
  if (servico.cenario_financeiro === 'VALOR_METRO') {
    retornoCalculado = metrosExecutadosTotal * (servico.valor_metro || 180);
  } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
    retornoCalculado = metrosExecutadosTotal * (servico.fator_financeiro || 2.85) * (servico.diametro_furo_mm || 150);
  } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
    retornoCalculado = (metrosExecutadosTotal / (metrosTotalPrevisto || 1)) * (servico.valor_total_fechado || 0);
  }

  // Filtragem de Barras
  const filteredBarras = barras
    .filter(b => {
      if (filterType === 'COM_CAIXA') return b.tem_caixa;
      if (filterType === 'SEM_CAIXA') return !b.tem_caixa;
      return true;
    })
    .sort((a, b) => {
      return sortOrder === 'DESC' 
        ? b.numero_barra - a.numero_barra
        : a.numero_barra - b.numero_barra;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. TOP HEADER ROW (BOTÃO VOLTAR + TÍTULO DA OBRA + AÇÕES) */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase' }}>
                {servico.nome}
              </h1>
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
                OS: {servico.id}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {servico.cliente} • {servico.local}
            </p>
          </div>
        </div>

        {/* Action Buttons Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isGestor && (
            <>
              {/* Botão Editar Serviço */}
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary"
                style={{
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit size={14} style={{ color: 'var(--primary)' }} />
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

      {/* 3. OVERVIEW CARDS ROW */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: isGestor ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
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
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
            <div 
              style={{ 
                width: `${percentualConcluido}%`, 
                height: '100%', 
                backgroundColor: 'var(--primary)', 
                transition: 'width 0.4s ease' 
              }} 
            />
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
              {metrosExecutadosTotal}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              / {metrosTotalPrevisto}m
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {barras.length} registros apontados
          </span>
        </div>

        {/* Card 3: Possui Caixa */}
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

        {/* Card 4: Retorno Financeiro (Apenas Gestores/Admin) */}
        {isGestor && (
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
        )}
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

            {/* Photo Cards Grid (Layout Compacto Padrão JLE) */}
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
              <div className="photo-grid">
                {filteredBarras.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBarraDetails(b)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, border-color 0.2s ease'
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
                    {/* Photo Area 4:3 Aspect */}
                    <div 
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        backgroundColor: '#0D1C24',
                        position: 'relative',
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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', gap: '4px' }}>
                          <Camera size={20} />
                          <span style={{ fontSize: '10px' }}>Sem foto</span>
                        </div>
                      )}

                      {/* Tag Superior Direita Metros */}
                      <div 
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          color: '#FFFFFF',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        +{b.metros || 3}m
                      </div>
                    </div>

                    {/* Card Footer Info (Idêntico ao App JLE) */}
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      
                      {/* Title: REGISTRO N */}
                      <strong style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                        REGISTRO {b.numero_barra}
                      </strong>

                      {/* Sub-label Tipo */}
                      <span 
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: b.tem_caixa ? 'var(--success)' : '#2A8ACC',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Camera size={10} />
                        <span>{b.tem_caixa ? 'CAIXA' : 'CANALIZAÇÃO'}</span>
                      </span>

                      {/* Date Timestamp */}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {b.created_at || b.data_registro || b.horario_registro
                          ? new Date(b.created_at || b.data_registro || b.horario_registro!).toLocaleString('pt-BR')
                          : new Date().toLocaleString('pt-BR')}
                      </span>

                      {/* Badges Footer Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span 
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(240, 90, 34, 0.15)',
                            color: 'var(--primary)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {b.metros || 3}m
                        </span>

                        <span 
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            backgroundColor: b.tem_caixa ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                            color: b.tem_caixa ? 'var(--success)' : 'var(--danger)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {b.tem_caixa ? 'COM CAIXA' : 'SEM CAIXA'}
                        </span>
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
            onSelectPhoto={(url) => {
              const matched = barras.find(b => b.foto_url === url);
              if (matched) setSelectedBarraDetails(matched);
            }}
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

      {/* MODAL DETALHES DO REGISTRO (PADRÃO JLE COM TOOLBAR DE ZOOM E INFORMAÇÕES) */}
      <RegistroDetalhesModal
        isOpen={Boolean(selectedBarraDetails)}
        onClose={() => setSelectedBarraDetails(null)}
        barra={selectedBarraDetails}
        servico={servico}
        isGestor={isGestor}
        onDelete={(id) => {
          setSelectedBarraDetails(null);
          setConfirmDeleteBarraId(id);
        }}
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

    </div>
  );
};

export default ObraDetalhes;
