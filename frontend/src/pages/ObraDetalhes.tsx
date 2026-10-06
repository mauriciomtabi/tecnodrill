import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Servico, Furo, Barra } from '../types';
import { ApiService, sanitizeLocalidade, parseBarraObservacao } from '../services/api';
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
  Edit,
  UserPlus,
  Users,
  DollarSign,
  X
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

  // Modal Adicionar Membro à Equipe
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [membroTipo, setMembroTipo] = useState<'NAVEGADOR' | 'OPERADOR'>('OPERADOR');
  const [membroUserId, setMembroUserId] = useState('');
  const [membroCustomNome, setMembroCustomNome] = useState('');
  const [todosUsuarios, setTodosUsuarios] = useState<Array<{ id: string; nome: string; perfil: string }>>([]);
  const [salvandoMembro, setSalvandoMembro] = useState(false);

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
      setHeaderInfo(s.nome, `OS: ${s.id} · ${s.cliente} (${sanitizeLocalidade(s.local, s.cidade, s.uf)})`);

      const furos = (s.furos && s.furos.length > 0) ? s.furos : await ApiService.getFuros(servicoId);
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

  const carregarUsuarios = async () => {
    try {
      const users = await ApiService.getUsuarios();
      setTodosUsuarios(users);
    } catch (_) {}
  };

  const handleAddMember = async () => {
    if (!servico) return;
    let nomeFinal = membroCustomNome.trim();
    let idFinal = membroUserId;
    if (membroUserId) {
      const u = todosUsuarios.find(user => user.id === membroUserId);
      if (u) {
        nomeFinal = u.nome;
      }
    }
    if (!nomeFinal) {
      showToast('Por favor, informe ou selecione o técnico.', 'error');
      return;
    }
    setSalvandoMembro(true);
    try {
      await ApiService.addEquipeMembro(servico.id, {
        id: idFinal || undefined,
        nome: nomeFinal,
        perfil: membroTipo,
        cargo: membroTipo
      });
      showToast(`${membroTipo === 'NAVEGADOR' ? 'Navegador' : 'Operador'} adicionado à equipe com sucesso!`, 'success');
      setShowAddMemberModal(false);
      setMembroCustomNome('');
      setMembroUserId('');
      await fetchDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar membro à equipe.', 'error');
    } finally {
      setSalvandoMembro(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, [servicoId]);

  // Listener para atualização em tempo real se uma barra for adicionada ou excluída de qualquer lugar
  useEffect(() => {
    const handleRealtimeBarra = (e: any) => {
      const newBarra = e.detail?.barra;
      if (newBarra && (!furo || newBarra.furo_id === furo.id)) {
        setBarras(prev => {
          if (prev.some(b => b.id === newBarra.id)) return prev;
          return [...prev, newBarra].sort((a, b) => a.numero_barra - b.numero_barra);
        });
        setFuro(prev => prev ? ({
          ...prev,
          comprimento_furo: Math.max(prev.comprimento_furo || 0, newBarra.metros_acumulados)
        }) : null);
      }
    };

    const handleRealtimeBarraDeleted = (e: any) => {
      const { furoId: delFuroId, remainingBarras } = e.detail || {};
      if (furo && delFuroId === furo.id) {
        if (remainingBarras) {
          setBarras(remainingBarras);
          const novoTotal = remainingBarras.reduce((acc: number, b: Barra) => {
            if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
            return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
          }, 0);
          setFuro(prev => prev ? ({ ...prev, comprimento_furo: novoTotal }) : null);
        } else {
          fetchDados();
        }
      }
    };

    window.addEventListener('tecnodrill:barra_added', handleRealtimeBarra);
    window.addEventListener('tecnodrill:barra_deleted', handleRealtimeBarraDeleted);
    return () => {
      window.removeEventListener('tecnodrill:barra_added', handleRealtimeBarra);
      window.removeEventListener('tecnodrill:barra_deleted', handleRealtimeBarraDeleted);
    };
  }, [furo]);

  const handleAddBarra = async (barraData: Partial<Barra>) => {
    if (!furo) return;
    setSavingBarra(true);
    try {
      const res = await ApiService.addBarra(furo.id, barraData);
      
      // Atualização imediata em memória
      setBarras(prev => {
        if (prev.some(b => b.id === res.barra.id)) return prev;
        return [...prev, res.barra].sort((a, b) => a.numero_barra - b.numero_barra);
      });
      setFuro(prev => prev ? ({ ...prev, comprimento_furo: res.barra.metros_acumulados }) : null);

      if (res.celebrarMeta) {
        const total = res.barra.metros_acumulados;
        const meta = servico?.meta_metros || 54;
        setCelebrationData({
          metaMetros: meta,
          metrosAtingidos: total,
          tipoMeta: servico?.tipo_meta || 'DIARIA'
        });
        setCelebrationOpen(true);
      }

      return res;
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar apontamento.', 'error');
      throw err;
    } finally {
      setSavingBarra(false);
    }
  };

  const handleConfirmDeleteBarra = async () => {
    if (!confirmDeleteBarraId) return;
    try {
      const res = await ApiService.deleteBarra(confirmDeleteBarraId);
      showToast('Registro de apontamento excluído e sequência recalculada.', 'info');
      setConfirmDeleteBarraId(null);
      if (res.remainingBarras) {
        setBarras(res.remainingBarras);
        const novoTotal = res.remainingBarras.reduce((acc, b) => {
          if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
          return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
        }, 0);
        setFuro(prev => prev ? ({ ...prev, comprimento_furo: novoTotal }) : null);
      } else {
        await fetchDados();
      }
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

  // Isolamento estrito de dados para Técnicos:
  // 1. Somente o que registrou no seu nome
  // 2. Apenas a partir de Setembro de 2026 (meses anteriores ficam ocultos para técnicos)
  const barrasVisiveis = isGestor
    ? barras
    : barras.filter(b => {
        const { meta } = parseBarraObservacao(b.observacao);
        const isMine = (user?.id && b.registrado_por && b.registrado_por === user.id) ||
                       (user?.id && meta.registrado_por_id && meta.registrado_por_id === user.id) ||
                       (user?.nome && b.registrado_por_nome && b.registrado_por_nome.toLowerCase().trim() === user.nome.toLowerCase().trim()) ||
                       (user?.nome && meta.registrado_por_nome && meta.registrado_por_nome.toLowerCase().trim() === user.nome.toLowerCase().trim()) ||
                       (user?.username && meta.registrado_por_nome && meta.registrado_por_nome.toLowerCase().trim() === user.username.toLowerCase().trim());
        if (!isMine) return false;

        // Visualização permitida apenas a partir de Setembro de 2026
        const mesRef = b.mes_referencia || meta.mes_referencia || b.data_referencia?.slice(0, 7) || meta.data_referencia?.slice(0, 7) || b.horario_registro?.slice(0, 7);
        if (mesRef && mesRef < '2026-09') return false;

        return true;
      });

  const metrosTecnico = barrasVisiveis.reduce((acc, b) => {
    if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
    return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
  }, 0);
  const totalComCaixaVisiveis = barrasVisiveis.filter(b => b.tem_caixa).length;
  const totalSemCaixaVisiveis = barrasVisiveis.length - totalComCaixaVisiveis;

  // Cálculos Oficiais do Serviço
  const metrosExecutadosTotal = furo?.comprimento_furo !== undefined
    ? furo.comprimento_furo
    : barras.reduce((acc, b) => {
        if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return acc;
        return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }, 0);
  const metrosTotalPrevisto = servico.metragem_prevista_total || 54;
  const percentualConcluido = Math.min(100, Math.round((metrosExecutadosTotal / (metrosTotalPrevisto || 1)) * 100));
  const totalComCaixa = barras.filter(b => b.tem_caixa).length;
  const totalSemCaixa = barras.length - totalComCaixa;

  // Cálculo de Retorno Financeiro Real (somando diâmetros reais das barras)
  let retornoCalculado = 0;
  if (servico.cenario_financeiro === 'VALOR_METRO') {
    retornoCalculado = metrosExecutadosTotal * (Number(servico.valor_metro) || 180);
  } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
    const diamDefault = Number(servico.diametro_furo_mm) || 150;
    const fator = Number(servico.fator_financeiro) || 0.8;
    let somaRetorno = 0;
    let count = 0;
    for (const b of barras) {
      if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) continue;
      const m = Number(b.metros) ?? 3;
      const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
      somaRetorno += m * fator * numDiam;
      count++;
    }
    retornoCalculado = count > 0 ? somaRetorno : (metrosExecutadosTotal * fator * diamDefault);
  } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
    retornoCalculado = (metrosExecutadosTotal / (metrosTotalPrevisto || 1)) * (Number(servico.valor_total_fechado) || 0);
  }

  // Regra Oficial de Custo: Multiplicado sempre por 2 (rateio 50% Navegador e 50% Operador)
  const custoMetro = Number(servico.custo_metro) || 0;
  const custoEquipeTotal = metrosExecutadosTotal * custoMetro * 2;

  // Filtragem de Barras Visíveis
  const filteredBarras = barrasVisiveis
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
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
              {servico.cliente} • {sanitizeLocalidade(servico.local, servico.cidade, servico.uf)}
            </p>
            
            {/* Lista Completa da Equipe (Multi-Técnicos) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Navegadores */}
              {(servico.navegadores && servico.navegadores.length > 0
                ? servico.navegadores
                : (servico.navegador_nome || furo?.navegador_nome)
                  ? [{ id: furo?.navegador_id || '1', nome: servico.navegador_nome || furo?.navegador_nome || '' }]
                  : []
              ).map((nav, idx) => (
                <span key={`nav-${idx}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(240, 90, 34, 0.12)', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  🧭 Navegador: <strong style={{ color: 'var(--text-main)' }}>{nav.nome}</strong>
                </span>
              ))}

              {/* Operadores */}
              {(servico.operadores && servico.operadores.length > 0
                ? servico.operadores
                : (servico.operador_nome || furo?.operador_nome)
                  ? [{ id: furo?.operador_id || '1', nome: servico.operador_nome || furo?.operador_nome || '' }]
                  : []
              ).map((op, idx) => (
                <span key={`op-${idx}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(93, 173, 226, 0.12)', color: '#5DADE2', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  👷 Operador: <strong style={{ color: 'var(--text-main)' }}>{op.nome}</strong>
                </span>
              ))}

              {/* Botão Gestor: Adicionar Técnico */}
              {isGestor && (
                <button
                  type="button"
                  onClick={() => {
                    carregarUsuarios();
                    setShowAddMemberModal(true);
                  }}
                  title="Acrescentar operador ou navegador à equipe"
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-main)',
                    border: '1px dashed var(--border-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <UserPlus size={12} color="var(--primary)" />
                  <span>+ Adicionar Técnico</span>
                </button>
              )}
            </div>
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

      {/* 2. ALERT BANNER (REVISÃO PENDENTE / CONCLUÍDO - APENAS GESTOR) */}
      {isGestor && percentualConcluido >= 100 && servico.status !== 'CONCLUIDO' && (
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
          gridTemplateColumns: isGestor ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: Progresso / Meus Metros */}
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
            {isGestor ? 'Progresso do Serviço' : 'Meus Metros Apontados'}
          </span>
          {isGestor ? (
            <>
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
            </>
          ) : (
            <>
              <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', display: 'block', margin: '4px 0' }}>
                {metrosTecnico.toFixed(1)}m
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Metros registrados por você
              </span>
            </>
          )}
        </div>

        {/* Card 2: Metros Realizados / Meus Registros */}
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
            {isGestor ? 'Metros Realizados' : 'Meus Registros'}
          </span>
          {isGestor ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '4px 0' }}>
                <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {metrosExecutadosTotal}m
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  / {metrosTotalPrevisto}m
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {barras.length} registros no total
              </span>
            </>
          ) : (
            <>
              <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', display: 'block', margin: '4px 0' }}>
                {barrasVisiveis.length}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Apontamentos no seu nome
              </span>
            </>
          )}
        </div>

        {/* Card 3: Caixas */}
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
            {isGestor ? 'Possui Caixa' : 'Minhas Caixas'}
          </span>
          <strong style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', display: 'block', margin: '4px 0' }}>
            {isGestor ? totalComCaixa : totalComCaixaVisiveis}
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {isGestor ? `${totalSemCaixa} sem caixa` : `${totalSemCaixaVisiveis} canalizações`}
          </span>
        </div>

        {/* Card 4: Retorno Financeiro (Apenas Gestores/Admin - NUNCA para técnicos) */}
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
              {servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO' && `Fator ${servico.fator_financeiro || 0.8} (diâmetro real)`}
              {servico.cenario_financeiro === 'VALOR_FECHADO' && `Valor Fechado`}
            </span>
          </div>
        )}

        {/* Card 5: Custo Operacional 2x (Apenas Gestores/Admin) */}
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
              Custo Operacional (2x)
            </span>
            <strong style={{ fontSize: '18px', fontWeight: 800, color: '#E74C3C', display: 'block', margin: '4px 0' }}>
              R$ {custoEquipeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              2x R$ {custoMetro.toFixed(2)}/m (50% Nav / 50% Op)
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
            <span>Fotos ({barrasVisiveis.length})</span>
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
                  TODOS ({barrasVisiveis.length})
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
                  POSSUI CAIXA ({totalComCaixaVisiveis})
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
                  SEM CAIXA ({totalSemCaixaVisiveis})
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
                  {isGestor 
                    ? 'Clique no botão "+ Novo Registro" para apontar a metragem e capturar a foto do local.'
                    : 'Nenhum apontamento registrado em seu nome nesta obra.'}
                </p>
              </div>
            ) : (
              <div className="photo-grid">
                {filteredBarras.map((b) => {
                  const mBarra = (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) ? 0 : (b.metros ?? 3);
                  let valorCard = 0;
                  if (servico.cenario_financeiro === 'VALOR_METRO') {
                    valorCard = mBarra * (Number(servico.valor_metro) || 0);
                  } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
                    const diamDefault = Number(servico.diametro_furo_mm) || 150;
                    const fator = Number(servico.fator_financeiro) || 0.8;
                    const numDiam = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || diamDefault;
                    valorCard = mBarra * fator * numDiam;
                  } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
                    const prev = Number(servico.metragem_prevista_total) || 1000;
                    valorCard = prev > 0 ? (mBarra / prev) * (Number(servico.valor_total_fechado) || 0) : 0;
                  }

                  return (
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

                        {/* Diâmetro em Destaque no Topo Esquerdo da Foto */}
                        {b.diametro && (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '6px',
                              left: '6px',
                              backgroundColor: 'rgba(0, 180, 216, 0.92)',
                              color: '#FFFFFF',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span>Ø {b.diametro.toUpperCase().includes('DN') ? b.diametro : `DN ${b.diametro}`}</span>
                          </div>
                        )}

                        {/* Tag Superior Direita Metros / Caixa */}
                        {(!b.tem_caixa && b.tipo_registro !== 'CAIXA') ? (
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
                        ) : (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              backgroundColor: 'rgba(39, 174, 96, 0.9)',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}
                          >
                            📦 CAIXA
                          </div>
                        )}
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
                            color: (b.tem_caixa || b.tipo_registro === 'CAIXA') ? 'var(--success)' : '#2A8ACC',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Camera size={10} />
                          <span>{(b.tem_caixa || b.tipo_registro === 'CAIXA') ? 'CAIXA' : 'CANALIZAÇÃO'}</span>
                        </span>

                        {/* Date Timestamp */}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {b.created_at || b.data_registro || b.horario_registro
                            ? new Date(b.created_at || b.data_registro || b.horario_registro!).toLocaleString('pt-BR')
                            : new Date().toLocaleString('pt-BR')}
                        </span>

                        {/* Badges Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>
                          {(!b.tem_caixa && b.tipo_registro !== 'CAIXA') && (
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
                          )}

                          {b.diametro && (
                            <span 
                              style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                padding: '2px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(0, 180, 216, 0.15)',
                                color: '#00B4D8'
                              }}
                            >
                              Ø {b.diametro.toUpperCase().includes('DN') ? b.diametro : `DN ${b.diametro}`}
                            </span>
                          )}

                          <span 
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              backgroundColor: (b.tem_caixa || b.tipo_registro === 'CAIXA') ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                              color: (b.tem_caixa || b.tipo_registro === 'CAIXA') ? 'var(--success)' : 'var(--danger)',
                              textTransform: 'uppercase'
                            }}
                          >
                            {(b.tem_caixa || b.tipo_registro === 'CAIXA') ? '📦 CAIXA' : 'SEM CAIXA'}
                          </span>
                        </div>

                        {/* Registrado por e Mês de Referência */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>Por: <strong style={{ color: 'var(--text-main)' }}>{b.registrado_por_nome || 'Técnico'}</strong></span>
                          {b.mes_referencia && (
                            <span style={{ color: '#B37DDB', fontWeight: 700 }}>📅 {b.mes_referencia}</span>
                          )}
                        </div>

                        {/* Valor na cara do card (Apenas Gestores/Admin) */}
                        {isGestor && valorCard > 0 && (
                          <div style={{
                            marginTop: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(46, 204, 113, 0.12)',
                            border: '1px solid rgba(46, 204, 113, 0.28)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '9px', color: '#8BA6B5', fontWeight: 700, textTransform: 'uppercase' }}>Valor:</span>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#2ECC71', fontFamily: 'var(--font-mono)' }}>
                              R$ {valorCard.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Visualização do Mapa */}
        {activeTab === 'mapa' && (
          <MapView
            barras={barrasVisiveis}
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
        servico={servico}
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
        onBarraUpdated={(updated) => {
          setBarras(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
          setSelectedBarraDetails(updated);
        }}
      />

      {/* MODAL ADICIONAR TÉCNICO À EQUIPE (APENAS GESTOR) */}
      {showAddMemberModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 12, 16, 0.88)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#0D1C24',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Adicionar Técnico à Obra
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Acrescenta operador ou navegador à equipe sem substituir os atuais
                  </span>
                </div>
              </div>
              <button onClick={() => setShowAddMemberModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Seleção de Função */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Função do Técnico
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMembroTipo('OPERADOR')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: `1px solid ${membroTipo === 'OPERADOR' ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: membroTipo === 'OPERADOR' ? 'var(--primary)' : 'var(--bg-app)',
                    color: membroTipo === 'OPERADOR' ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  👷 Operador
                </button>
                <button
                  type="button"
                  onClick={() => setMembroTipo('NAVEGADOR')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: `1px solid ${membroTipo === 'NAVEGADOR' ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: membroTipo === 'NAVEGADOR' ? 'var(--primary)' : 'var(--bg-app)',
                    color: membroTipo === 'NAVEGADOR' ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  🧭 Navegador
                </button>
              </div>
            </div>

            {/* Selecionar Usuário Cadastrado */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Selecionar Usuário do Sistema
              </label>
              <select
                value={membroUserId}
                onChange={(e) => {
                  setMembroUserId(e.target.value);
                  if (e.target.value) setMembroCustomNome('');
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  color: 'var(--text-main)'
                }}
              >
                <option value="">-- Escolha um usuário cadastrado --</option>
                {todosUsuarios
                  .filter(u => u.perfil === membroTipo || u.perfil === 'OPERADOR' || u.perfil === 'NAVEGADOR')
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.perfil})
                    </option>
                  ))}
              </select>
            </div>

            {/* Ou Nome Avulso */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Ou Digite o Nome do Técnico
              </label>
              <input
                type="text"
                value={membroCustomNome}
                onChange={(e) => {
                  setMembroCustomNome(e.target.value);
                  if (e.target.value) setMembroUserId('');
                }}
                placeholder="ex: João da Silva"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  color: 'var(--text-main)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoMembro || (!membroUserId && !membroCustomNome.trim())}
                onClick={handleAddMember}
                style={{
                  backgroundColor: (membroUserId || membroCustomNome.trim()) ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: (membroUserId || membroCustomNome.trim()) ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {salvandoMembro ? 'Adicionando...' : 'Adicionar à Obra'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
