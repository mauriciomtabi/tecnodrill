import React, { useState, useEffect } from 'react';
import { Servico, Furo } from '../types';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Search, 
  MapPin, 
  HardHat, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  User, 
  UserCheck, 
  DollarSign, 
  Radio, 
  WifiOff 
} from 'lucide-react';

interface ObrasListProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
  onSelectServico: (id: string) => void;
  onOpenNovoServicoModal: () => void;
}

export const ObrasList: React.FC<ObrasListProps> = ({ 
  setHeaderInfo, 
  onSelectServico, 
  onOpenNovoServicoModal 
}) => {
  const { user, isOffline, showToast } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [furos, setFuros] = useState<Furo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [activeTab, setActiveTab] = useState<'ATIVAS' | 'CONCLUIDAS'>('ATIVAS');

  const isGestor = user?.perfil === 'GESTOR' || user?.perfil === 'ADMIN';

  const fetchServicos = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getServicos();
      setServicos(data);
      const furosData = await ApiService.getFuros();
      setFuros(furosData);
    } catch (err) {
      console.error('Erro ao buscar serviços:', err);
      showToast('Erro ao carregar serviços.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHeaderInfo('Serviços em andamento', '');
    fetchServicos();
  }, [setHeaderInfo]);

  const renderProgressBar = (metrosExec: number, metrosTotal: number) => {
    const percent = metrosTotal > 0 ? Math.min(Math.round((metrosExec / metrosTotal) * 100), 100) : 0;
    let barColor = 'var(--danger)';
    if (percent >= 70) {
      barColor = 'var(--success)';
    } else if (percent >= 30) {
      barColor = 'var(--warning)';
    }

    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span>Progresso</span>
          <span>{metrosExec} de {metrosTotal} metros ({percent}%)</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div 
            style={{
              width: `${percent}%`,
              height: '100%',
              backgroundColor: barColor,
              borderRadius: '4px',
              transition: 'width 0.5s ease-out'
            }}
          />
        </div>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    let bg = 'var(--border-color)';
    let text = 'var(--text-muted)';

    if (status === 'EM_ANDAMENTO' || status === 'ATIVA') {
      bg = 'rgba(39, 174, 96, 0.12)';
      text = 'var(--success)';
    } else if (status === 'PAUSADO' || status === 'PAUSADA') {
      bg = 'rgba(243, 156, 18, 0.12)';
      text = 'var(--warning)';
    } else if (status === 'CONCLUIDO' || status === 'CONCLUIDA') {
      bg = 'rgba(41, 128, 168, 0.15)';
      text = 'var(--primary-light)';
    }

    return (
      <span 
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: bg,
          color: text,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {status === 'CONCLUIDO' && <CheckCircle2 size={10} style={{ color: text }} />}
        {status === 'EM_ANDAMENTO' ? 'ATIVA' : status}
      </span>
    );
  };

  // Filtragem idêntica ao App JLE
  const filteredServicos = servicos.filter(s => {
    const matchesSearch = 
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cliente && s.cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.local && s.local.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTab = activeTab === 'ATIVAS' ? s.status !== 'CONCLUIDO' : s.status === 'CONCLUIDO';
    const matchesStatus = statusFilter === 'TODAS' || s.status === statusFilter;
    
    return matchesSearch && matchesTab && matchesStatus;
  });

  const countAtivas = servicos.filter(s => s.status !== 'CONCLUIDO').length;
  const countConcluidas = servicos.filter(s => s.status === 'CONCLUIDO').length;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Offline Alert */}
      {isOffline && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(231, 76, 60, 0.15)',
              border: '1px solid var(--danger)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '11px',
              color: '#FADBD8',
              fontWeight: 600
            }}
          >
            <WifiOff size={14} style={{ color: 'var(--danger)' }} />
            <span>MODO OFFLINE (Registros salvam em cache)</span>
          </div>
        </div>
      )}

      {/* UPPER HEADER BAR */}
      <div className="upper-header">
        <div>
          <h1 className="header-title">Serviços em andamento</h1>
          <p className="header-subtitle">Gestão de frentes de canalização e perfuração direcional (MND)</p>
        </div>

        {isGestor && (
          <button
            onClick={onOpenNovoServicoModal}
            className="header-action-btn"
          >
            <Plus size={16} />
            <span>Novo Serviço</span>
          </button>
        )}
      </div>

      {/* FILTER & SEARCH BAR (Idêntica ao App JLE) */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Tab Buttons (Ativas / Concluídas) */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('ATIVAS')}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeTab === 'ATIVAS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'ATIVAS' ? '#FFFFFF' : 'var(--text-muted)'
            }}
          >
            Ativas ({countAtivas})
          </button>
          <button
            onClick={() => setActiveTab('CONCLUIDAS')}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeTab === 'CONCLUIDAS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'CONCLUIDAS' ? '#FFFFFF' : 'var(--text-muted)'
            }}
          >
            Concluídas ({countConcluidas})
          </button>
        </div>

        {/* Search Input and Status Dropdown */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '420px', minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por serviço, cliente ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '34px',
                fontSize: '12px',
                height: '36px'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '130px',
              fontSize: '12px',
              height: '36px',
              padding: '6px 10px'
            }}
          >
            <option value="TODAS">Todos Status</option>
            <option value="EM_ANDAMENTO">Ativas</option>
            <option value="PAUSADO">Pausadas</option>
            <option value="CONCLUIDO">Concluídas</option>
          </select>
        </div>
      </div>

      {/* CARDS GRID (Layout idêntico ao App JLE) */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-md)' }} />
        </div>
      ) : filteredServicos.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)' }}>
          Nenhum serviço encontrado nesta seção.
        </div>
      ) : (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredServicos.map((servico) => {
            const furosDaObra = furos.filter(f => f.servico_id === servico.id);
            const furoPrincipal = furosDaObra[0];
            const metrosExec = servico.metricas?.metrosExecutados || (furoPrincipal?.comprimento_furo || 0);
            const metrosPrevistos = servico.metragem_prevista_total || 54;
            const retornoR$ = servico.metricas?.retornoFinanceiroCalculado;

            return (
              <div
                key={servico.id}
                onClick={() => onSelectServico(servico.id)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'var(--transition)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-light)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Site ID / Código Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                    <MapPin size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span 
                      style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: 'var(--primary)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}
                      title={servico.id}
                    >
                      {servico.id}
                    </span>
                  </div>

                  {getStatusBadge(servico.status)}
                </div>

                {/* Name */}
                <h3 style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)', overflowWrap: 'break-word', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {servico.nome}
                  {servico.status === 'CONCLUIDO' && (
                    <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  )}
                </h3>
                
                {/* Local & Cliente */}
                <p 
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}
                >
                  {servico.cliente} • {servico.local}
                </p>

                {/* Equipe Técnica Vinculada (Caixa compacta idêntica ao App JLE) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px', 
                  marginBottom: '10px', 
                  fontSize: '10.5px',
                  padding: '6px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardHat size={11} style={{ color: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>
                      Gestor: <strong style={{ color: 'var(--text-main)' }}>Eduardo / Carlos</strong>
                    </span>
                  </div>

                  {furoPrincipal && furoPrincipal.navegador_nome && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={11} style={{ color: 'var(--primary-light)' }} />
                      <span style={{ color: 'var(--text-muted)' }}>
                        Navegador: <strong style={{ color: 'var(--text-main)' }}>{furoPrincipal.navegador_nome}</strong>
                      </span>
                    </div>
                  )}

                  {furoPrincipal && furoPrincipal.operador_nome && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={11} style={{ color: '#5DADE2' }} />
                      <span style={{ color: 'var(--text-muted)' }}>
                        Operador: <strong style={{ color: 'var(--text-main)' }}>{furoPrincipal.operador_nome}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Financial indicator for Managers */}
                {isGestor && retornoR$ !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '2px', color: 'var(--text-muted)' }}>
                    <span>Retorno:</span>
                    <strong style={{ color: 'var(--success)', fontSize: '12px' }}>
                      R$ {retornoR$.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}

                {/* Progress Bar */}
                {renderProgressBar(metrosExec, metrosPrevistos)}

                {/* Footer */}
                <div 
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    marginTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} />
                    <span>
                      {servico.criado_em 
                        ? new Date(servico.criado_em).toLocaleDateString('pt-BR')
                        : 'Recente'
                      }
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--primary-light)', fontWeight: 600 }}>
                    <span>Ver Detalhes</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
