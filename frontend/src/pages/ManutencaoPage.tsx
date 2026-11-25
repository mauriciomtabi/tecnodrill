import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Veiculo,
  Servico,
  PlanoPreventiva,
  ManutencaoHistorico,
  VeiculoLeitura,
  ItemPlanoPreventiva,
} from '../types';
import {
  ManutencaoService,
  calcularStatusPreventiva,
  PreventivaCalculada,
} from '../services/manutencaoService';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { VeiculoFormModal } from '../components/VeiculoFormModal';
import {
  Wrench,
  Truck,
  Drill,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Camera,
  FileText,
  Gauge,
  History,
  Bell,
  Edit3,
  Trash2,
  ChevronLeft,
  Settings,
  X,
} from 'lucide-react';

interface ManutencaoPageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
}

export const ManutencaoPage: React.FC<ManutencaoPageProps> = ({ setHeaderInfo }) => {
  const { user, showToast } = useAuth();
  const isGestor = user?.perfil === 'ADMIN' || user?.perfil === 'GESTOR';

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [planos, setPlanos] = useState<PlanoPreventiva[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'PERFURATRIZ' | 'CAMINHAO'>('TODOS');
  const [apenasAlertas, setApenasAlertas] = useState(false);
  const [busca, setBusca] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(null);

  // Detalhe do veículo selecionado
  const [activeTab, setActiveTab] = useState<'PREVENTIVAS' | 'FOTOS_DOCS' | 'LEITURAS' | 'HISTORICO'>('PREVENTIVAS');
  const [historico, setHistorico] = useState<ManutencaoHistorico[]>([]);
  const [leituras, setLeituras] = useState<VeiculoLeitura[]>([]);

  // Modal Baixa de Preventiva
  const [baixaTarget, setBaixaTarget] = useState<PreventivaCalculada | null>(null);
  const [baixaLeitura, setBaixaLeitura] = useState('');
  const [baixaExecutadoPor, setBaixaExecutadoPor] = useState('');
  const [baixaObs, setBaixaObs] = useState('');
  const [baixaFotos, setBaixaFotos] = useState<string[]>([]);
  const [savingBaixa, setSavingBaixa] = useState(false);

  // Modal Novo Item Preventiva
  const [showNovaPrevModal, setShowNovaPrevModal] = useState(false);
  const [prevNome, setPrevNome] = useState('');
  const [prevCategoria, setPrevCategoria] = useState('');
  const [prevIntervalo, setPrevIntervalo] = useState('');
  const [prevAntecedencia, setPrevAntecedencia] = useState('');
  const [prevUltimaLeitura, setPrevUltimaLeitura] = useState('');

  // Modal Leitura Manual
  const [showLeituraModal, setShowLeituraModal] = useState(false);
  const [leituraValor, setLeituraValor] = useState('');
  const [leituraObs, setLeituraObs] = useState('');

  // Modal Planos Padrão
  const [showPlanosModal, setShowPlanosModal] = useState(false);
  const [planoEditNome, setPlanoEditNome] = useState('');
  const [planoEditTipo, setPlanoEditTipo] = useState<'PERFURATRIZ' | 'CAMINHAO'>('PERFURATRIZ');
  const [planoEditItens, setPlanoEditItens] = useState<ItemPlanoPreventiva[]>([]);

  const [enviandoAlerta, setEnviandoAlerta] = useState(false);

  useEffect(() => {
    setHeaderInfo('Frota & Manutenção', 'Controle preventivo de perfuratrizes e caminhões');
  }, [setHeaderInfo]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [vList, sList, pList] = await Promise.all([
        ManutencaoService.getVeiculos(),
        ApiService.getServicos(),
        ManutencaoService.getPlanosPreventiva(),
      ]);
      setVeiculos(vList);
      setServicos(sList);
      setPlanos(pList);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar dados da frota.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const selectedVeiculo = useMemo(
    () => veiculos.find((v) => v.id === selectedVeiculoId) || null,
    [veiculos, selectedVeiculoId]
  );

  useEffect(() => {
    if (!selectedVeiculoId) return;
    Promise.all([
      ManutencaoService.getHistoricoVeiculo(selectedVeiculoId),
      ManutencaoService.getLeiturasVeiculo(selectedVeiculoId),
    ])
      .then(([hist, leit]) => {
        setHistorico(hist);
        setLeituras(leit);
      })
      .catch(() => {});
  }, [selectedVeiculoId]);

  const alertasAvaliados = useMemo(
    () => ManutencaoService.avaliarAlertasVeiculos(veiculos),
    [veiculos]
  );

  const resumoKPIs = useMemo(() => {
    let vencidas = 0;
    let proximas = 0;
    let emDia = 0;
    alertasAvaliados.forEach((a) => {
      if (a.statusGeral === 'VENCIDO') vencidas++;
      else if (a.statusGeral === 'PROXIMO') proximas++;
      else emDia++;
    });
    return { total: veiculos.length, vencidas, proximas, emDia };
  }, [alertasAvaliados, veiculos.length]);

  const veiculosFiltrados = useMemo(() => {
    return alertasAvaliados.filter(({ veiculo, statusGeral }) => {
      if (filtroTipo !== 'TODOS' && veiculo.tipo !== filtroTipo) return false;
      if (apenasAlertas && statusGeral === 'EM_DIA') return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hit =
          veiculo.nome.toLowerCase().includes(q) ||
          (veiculo.codigo_interno || '').toLowerCase().includes(q) ||
          (veiculo.placa || '').toLowerCase().includes(q) ||
          (veiculo.servico_nome || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [alertasAvaliados, filtroTipo, apenasAlertas, busca]);

  const handleEnviarAlertaTelegram = async () => {
    setEnviandoAlerta(true);
    try {
      const res = await ManutencaoService.enviarAlertaFrotaTelegram(veiculos);
      showToast(res.message || 'Alerta enviado com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar alerta.', 'error');
    } finally {
      setEnviandoAlerta(false);
    }
  };

  const handleOpenBaixa = (prev: PreventivaCalculada) => {
    if (!selectedVeiculo) return;
    setBaixaTarget(prev);
    setBaixaLeitura(String(selectedVeiculo.leitura_atual || 0));
    setBaixaExecutadoPor('');
    setBaixaObs('');
    setBaixaFotos([]);
  };

  const handleConfirmBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVeiculo || !baixaTarget) return;
    const leituraNum = Number(baixaLeitura.replace(',', '.'));
    if (isNaN(leituraNum) || leituraNum < 0) {
      showToast('Informe a leitura realizada válida.', 'error');
      return;
    }
    setSavingBaixa(true);
    try {
      await ManutencaoService.registrarBaixaPreventiva({
        veiculo: selectedVeiculo,
        preventiva: baixaTarget,
        leitura_realizada: leituraNum,
        executado_por_nome: baixaExecutadoPor,
        observacoes: baixaObs,
        fotos: baixaFotos,
      });
      showToast('Baixa de preventiva registrada!', 'success');
      setBaixaTarget(null);
      await carregarDados();
      const [hist, leit] = await Promise.all([
        ManutencaoService.getHistoricoVeiculo(selectedVeiculo.id),
        ManutencaoService.getLeiturasVeiculo(selectedVeiculo.id),
      ]);
      setHistorico(hist);
      setLeituras(leit);
    } catch (err: any) {
      showToast(err.message || 'Erro ao dar baixa na preventiva.', 'error');
    } finally {
      setSavingBaixa(false);
    }
  };

  const handleSalvarNovaPreventiva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVeiculo) return;
    try {
      await ManutencaoService.savePreventivaVeiculo({
        veiculo_id: selectedVeiculo.id,
        nome: prevNome,
        categoria: prevCategoria,
        intervalo: Number(prevIntervalo),
        alerta_antecedencia: Number(prevAntecedencia || 0),
        ultima_leitura_realizada: Number(prevUltimaLeitura || selectedVeiculo.leitura_atual || 0),
      });
      showToast('Item preventivo adicionado!', 'success');
      setShowNovaPrevModal(false);
      setPrevNome('');
      setPrevCategoria('');
      setPrevIntervalo('');
      setPrevAntecedencia('');
      setPrevUltimaLeitura('');
      await carregarDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar item preventivo.', 'error');
    }
  };

  const handleSalvarLeituraManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVeiculo) return;
    const val = Number(leituraValor.replace(',', '.'));
    if (isNaN(val) || val < Number(selectedVeiculo.leitura_atual || 0)) {
      showToast('A nova leitura não pode ser menor que a leitura atual.', 'error');
      return;
    }
    try {
      await ManutencaoService.registrarLeituras(
        [{ veiculo: selectedVeiculo, leitura_informada: val, observacao: leituraObs }],
        'MANUAL'
      );
      showToast('Leitura registrada!', 'success');
      setShowLeituraModal(false);
      setLeituraValor('');
      setLeituraObs('');
      await carregarDados();
      setLeituras(await ManutencaoService.getLeiturasVeiculo(selectedVeiculo.id));
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar leitura.', 'error');
    }
  };

  const handleAplicarPlano = async (planoId: string) => {
    if (!selectedVeiculo) return;
    const plano = planos.find((p) => p.id === planoId);
    if (!plano) return;
    try {
      await ManutencaoService.aplicarPlanoAoVeiculo(
        selectedVeiculo.id,
        plano.itens,
        selectedVeiculo.leitura_atual
      );
      showToast(`Plano "${plano.nome}" aplicado!`, 'success');
      await carregarDados();
    } catch (err: any) {
      showToast(err.message || 'Erro ao aplicar plano.', 'error');
    }
  };

  const handleCriarPlanoPadrao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planoEditNome.trim() || planoEditItens.length === 0) {
      showToast('Informe o nome e ao menos 1 item no plano.', 'error');
      return;
    }
    try {
      await ManutencaoService.savePlanoPreventiva({
        nome: planoEditNome,
        tipo_veiculo: planoEditTipo,
        itens: planoEditItens,
      });
      showToast('Plano padrão salvo!', 'success');
      setPlanoEditNome('');
      setPlanoEditItens([]);
      setPlanos(await ManutencaoService.getPlanosPreventiva());
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar plano padrão.', 'error');
    }
  };

  const statusBadge = (status: 'EM_DIA' | 'PROXIMO' | 'VENCIDO') => {
    const map = {
      VENCIDO: { bg: 'rgba(231, 76, 60, 0.16)', color: '#F87171', label: 'Vencida' },
      PROXIMO: { bg: 'rgba(243, 156, 18, 0.16)', color: '#FBBF24', label: 'Próxima' },
      EM_DIA: { bg: 'rgba(39, 174, 96, 0.16)', color: '#34D399', label: 'Em Dia' },
    };
    const cfg = map[status];
    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '999px',
          backgroundColor: cfg.bg,
          color: cfg.color,
        }}
      >
        {cfg.label}
      </span>
    );
  };

  // ============================================================================
  // VISUALIZAÇÃO DE DETALHE DO VEÍCULO SELECIONADO
  // ============================================================================
  if (selectedVeiculo) {
    const unit = selectedVeiculo.unidade_medida === 'HORAS' ? 'h' : 'km';
    const preventivasCalc = (selectedVeiculo.preventivas || []).map((p) =>
      calcularStatusPreventiva(p, selectedVeiculo.leitura_atual)
    );
    const planosCompativeis = planos.filter((p) => p.tipo_veiculo === selectedVeiculo.tipo);

    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <button
            type="button"
            onClick={() => setSelectedVeiculoId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            <ChevronLeft size={16} /> Voltar para Frota
          </button>
        </div>

        {/* Header Card do Veículo */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '18px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '18px',
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          {selectedVeiculo.foto_principal_url ? (
            <img
              src={selectedVeiculo.foto_principal_url}
              alt={selectedVeiculo.nome}
              style={{ width: '110px', height: '84px', borderRadius: '12px', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '110px',
                height: '84px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedVeiculo.tipo === 'PERFURATRIZ' ? <Drill size={34} /> : <Truck size={34} />}
            </div>
          )}

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedVeiculo.nome}
              </h2>
              {selectedVeiculo.codigo_interno && (
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  #{selectedVeiculo.codigo_interno}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {[selectedVeiculo.marca, selectedVeiculo.modelo, selectedVeiculo.ano, selectedVeiculo.placa]
                .filter(Boolean)
                .join(' • ') || 'Sem dados complementares'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                <Gauge size={15} style={{ verticalAlign: 'middle', marginRight: '5px', color: 'var(--primary)' }} />
                Leitura Atual: <strong>{selectedVeiculo.leitura_atual} {unit}</strong>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Obra: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.servico_nome || 'Base / Pátio'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setLeituraValor(String(selectedVeiculo.leitura_atual || 0));
                setShowLeituraModal(true);
              }}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Gauge size={15} /> Atualizar {unit === 'h' ? 'Horímetro' : 'Km'}
            </button>
            {isGestor && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVeiculo(selectedVeiculo);
                    setShowFormModal(true);
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Edit3 size={15} /> Editar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Inativar ${selectedVeiculo.nome}?`)) return;
                    await ManutencaoService.inativarVeiculo(selectedVeiculo.id);
                    showToast('Veículo inativado.', 'info');
                    setSelectedVeiculoId(null);
                    carregarDados();
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(231, 76, 60, 0.12)',
                    color: '#F87171',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                  title="Inativar veículo"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { id: 'PREVENTIVAS', label: `Preventivas (${preventivasCalc.length})`, icon: Wrench },
            { id: 'FOTOS_DOCS', label: `Fotos & Docs (${selectedVeiculo.fotos.length})`, icon: Camera },
            { id: 'LEITURAS', label: `Leituras (${leituras.length})`, icon: Gauge },
            { id: 'HISTORICO', label: `Histórico (${historico.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  backgroundColor: active ? 'var(--primary)' : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'PREVENTIVAS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isGestor && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPrevUltimaLeitura(String(selectedVeiculo.leitura_atual || 0));
                    setShowNovaPrevModal(true);
                  }}
                  className="btn-primary"
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={15} /> Novo Item Preventivo
                </button>
                {planosCompativeis.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAplicarPlano(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="">+ Aplicar Plano Padrão...</option>
                    {planosCompativeis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.itens.length} itens)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {preventivasCalc.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '14px',
                  padding: '28px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                }}
              >
                Nenhum item de manutenção preventiva cadastrado para este veículo.
              </div>
            ) : (
              preventivasCalc.map((prev) => {
                const barColor =
                  prev.status === 'VENCIDO' ? '#E74C3C' : prev.status === 'PROXIMO' ? '#F39C12' : '#27AE60';
                return (
                  <div
                    key={prev.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                            {prev.nome}
                          </span>
                          {statusBadge(prev.status)}
                          {prev.categoria && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• {prev.categoria}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Intervalo: <strong>{prev.intervalo}{unit}</strong> • Última: <strong>{prev.ultima_leitura_realizada}{unit}</strong> • Próxima: <strong style={{ color: 'var(--text-main)' }}>{prev.proxima_leitura}{unit}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: barColor }}>
                          {prev.restante <= 0
                            ? `Vencida há ${Math.abs(prev.restante)}${unit}`
                            : `Faltam ${prev.restante}${unit}`}
                        </span>
                        {isGestor && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenBaixa(prev)}
                              style={{
                                padding: '7px 12px',
                                borderRadius: '9px',
                                backgroundColor: 'rgba(39, 174, 96, 0.16)',
                                color: '#34D399',
                                fontWeight: 700,
                                fontSize: '12.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              <CheckCircle2 size={14} /> Dar Baixa
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await ManutencaoService.deletePreventivaVeiculo(prev.id);
                                showToast('Item removido.', 'info');
                                carregarDados();
                              }}
                              style={{
                                padding: '7px',
                                borderRadius: '9px',
                                backgroundColor: 'rgba(231, 76, 60, 0.12)',
                                color: '#F87171',
                              }}
                              title="Remover item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-app)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, prev.percentualUso)}%`,
                          height: '100%',
                          backgroundColor: barColor,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'FOTOS_DOCS' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '12px' }}>Galeria de Fotos</h4>
              {selectedVeiculo.fotos.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma foto cadastrada.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                  {selectedVeiculo.fotos.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3' }}>
                      <img src={url} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '12px' }}>Documentos & Especificações</h4>
              {selectedVeiculo.documentos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {selectedVeiculo.documentos.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--primary)',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      <FileText size={15} />
                      <span>[{doc.tipo}] {doc.nome}</span>
                      {doc.validade && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '11.5px' }}>Val: {doc.validade}</span>}
                    </a>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {selectedVeiculo.especificacoes.oleo_motor && <div>Óleo Motor: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.oleo_motor}</strong></div>}
                {selectedVeiculo.especificacoes.oleo_hidraulico && <div>Óleo Hidráulico: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.oleo_hidraulico}</strong></div>}
                {selectedVeiculo.especificacoes.filtro_oleo && <div>Filtro Óleo: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.filtro_oleo}</strong></div>}
                {selectedVeiculo.especificacoes.filtro_ar && <div>Filtro Ar: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.filtro_ar}</strong></div>}
                {selectedVeiculo.especificacoes.filtro_combustivel && <div>Filtro Comb.: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.filtro_combustivel}</strong></div>}
                {selectedVeiculo.especificacoes.filtro_hidraulico && <div>Filtro Hidr.: <strong style={{ color: 'var(--text-main)' }}>{selectedVeiculo.especificacoes.filtro_hidraulico}</strong></div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'LEITURAS' && (
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border-color)' }}>
            {leituras.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Nenhuma leitura registrada ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leituras.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-app)',
                      fontSize: '13px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong>{l.leitura_informada} {l.unidade_medida === 'HORAS' ? 'h' : 'km'}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (anterior: {l.leitura_anterior}{l.unidade_medida === 'HORAS' ? 'h' : 'km'})
                      </span>
                      {l.observacao && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{l.observacao}</div>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      <div>{l.usuario_nome || 'Usuário'} • {l.origem}</div>
                      <div>{l.data_referencia}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'HISTORICO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {historico.length === 0 ? (
              <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                Nenhuma manutenção preventiva baixada ainda.
              </div>
            ) : (
              historico.map((h) => (
                <div
                  key={h.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    padding: '14px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <strong style={{ fontSize: '14.5px', color: 'var(--text-main)' }}>{h.titulo}</strong>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#34D399' }}>
                      Realizada com {h.leitura_realizada}{unit}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {new Date(h.data_realizacao).toLocaleDateString('pt-BR')} • Registrado por {h.registrado_por_nome || 'Gestor'}
                    {h.executado_por_nome ? ` • Executado por: ${h.executado_por_nome}` : ''}
                  </div>
                  {h.observacoes && <div style={{ fontSize: '12.5px', marginTop: '6px', color: 'var(--text-main)' }}>{h.observacoes}</div>}
                  {h.fotos && h.fotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {h.fotos.map((f, i) => (
                        <a key={i} href={f} target="_blank" rel="noreferrer">
                          <img src={f} alt="Comprovante" style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Baixa Preventiva */}
        {baixaTarget && createPortal(
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '460px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Dar Baixa: {baixaTarget.nome}</h3>
                <button type="button" onClick={() => setBaixaTarget(null)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleConfirmBaixa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Leitura na execução ({unit}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={baixaLeitura}
                    onChange={(e) => setBaixaLeitura(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Mecânico / Oficina
                  </label>
                  <input
                    type="text"
                    value={baixaExecutadoPor}
                    onChange={(e) => setBaixaExecutadoPor(e.target.value)}
                    placeholder="Opcional"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={baixaObs}
                    onChange={(e) => setBaixaObs(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Fotos / Comprovante
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      const urls = await Promise.all(
                        files.map(
                          (f) =>
                            new Promise<string>((res) => {
                              const r = new FileReader();
                              r.onload = () => res(String(r.result || ''));
                              r.readAsDataURL(f);
                            })
                        )
                      );
                      setBaixaFotos((prev) => [...prev, ...urls]);
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setBaixaTarget(null)} style={{ padding: '9px 14px', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'transparent' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingBaixa} className="btn-primary" style={{ padding: '9px 16px', borderRadius: '9px' }}>
                    {savingBaixa ? 'Salvando...' : 'Confirmar Baixa'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Novo Item Preventivo */}
        {showNovaPrevModal && createPortal(
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px' }}>Novo Item Preventivo</h3>
              <form onSubmit={handleSalvarNovaPreventiva} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input required placeholder="Nome (ex: Troca de óleo motor)" value={prevNome} onChange={(e) => setPrevNome(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <input placeholder="Categoria (ex: Motor, Hidráulica)" value={prevCategoria} onChange={(e) => setPrevCategoria(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <input required type="number" step="0.1" min="1" placeholder={`Intervalo (${unit})`} value={prevIntervalo} onChange={(e) => setPrevIntervalo(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <input type="number" step="0.1" min="0" placeholder={`Avisar com antecedência de (${unit})`} value={prevAntecedencia} onChange={(e) => setPrevAntecedencia(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <input type="number" step="0.1" min="0" placeholder={`Última realização (${unit})`} value={prevUltimaLeitura} onChange={(e) => setPrevUltimaLeitura(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowNovaPrevModal(false)} style={{ padding: '9px 14px', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'transparent' }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ padding: '9px 16px', borderRadius: '9px' }}>Salvar Item</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Leitura Manual */}
        {showLeituraModal && createPortal(
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px' }}>Atualizar {unit === 'h' ? 'Horímetro' : 'Odômetro'}</h3>
              <form onSubmit={handleSalvarLeituraManual} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input required type="number" step="0.1" min={selectedVeiculo.leitura_atual} value={leituraValor} onChange={(e) => setLeituraValor(e.target.value)} style={{ padding: '10px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', fontWeight: 700 }} />
                <input placeholder="Observação (opcional)" value={leituraObs} onChange={(e) => setLeituraObs(e.target.value)} style={{ padding: '9px 12px', borderRadius: '9px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button type="button" onClick={() => setShowLeituraModal(false)} style={{ padding: '9px 14px', borderRadius: '9px', border: '1px solid var(--border-color)', background: 'transparent' }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ padding: '9px 16px', borderRadius: '9px' }}>Registrar</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        <VeiculoFormModal
          isOpen={showFormModal}
          veiculo={editingVeiculo}
          servicos={servicos}
          planos={planos}
          onClose={() => {
            setShowFormModal(false);
            setEditingVeiculo(null);
          }}
          onSaved={() => {
            setShowFormModal(false);
            setEditingVeiculo(null);
            carregarDados();
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // LISTAGEM PRINCIPAL DA FROTA & SEMÁFORO
  // ============================================================================
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* UPPER HEADER BAR (Padrão Serviços) */}
      <div className="upper-header">
        <div>
          <h1 className="header-title">Frota & Manutenção Preventiva</h1>
          <p className="header-subtitle">Controle de horímetro (perfuratrizes) e quilometragem (caminhões)</p>
        </div>

        {isGestor && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleEnviarAlertaTelegram}
              disabled={enviandoAlerta}
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Bell size={15} /> {enviandoAlerta ? 'Enviando...' : 'Enviar Alerta Telegram'}
            </button>
            <button
              type="button"
              onClick={() => setShowPlanosModal(true)}
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontWeight: 600,
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Settings size={15} /> Planos Padrão
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingVeiculo(null);
                setShowFormModal(true);
              }}
              className="header-action-btn"
            >
              <Plus size={16} />
              <span>Novo Veículo</span>
            </button>
          </div>
        )}
      </div>

      {/* KPIs Semáforo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total na Frota', val: resumoKPIs.total, color: 'var(--primary)', icon: Wrench },
          { label: 'Preventivas Vencidas', val: resumoKPIs.vencidas, color: '#E74C3C', icon: AlertTriangle },
          { label: 'Próximas do Vencimento', val: resumoKPIs.proximas, color: '#F39C12', icon: Clock },
          { label: 'Frota em Dia', val: resumoKPIs.emDia, color: '#27AE60', icon: CheckCircle2 },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${kpi.color}20`, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{kpi.val}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTER & SEARCH BAR (Padrão Serviços) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-input)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          {(['TODOS', 'PERFURATRIZ', 'CAMINHAO'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTipo(t)}
              style={{
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: filtroTipo === t ? 'var(--primary)' : 'transparent',
                color: filtroTipo === t ? '#FFFFFF' : 'var(--text-muted)',
              }}
            >
              {t === 'TODOS' ? 'Todos' : t === 'PERFURATRIZ' ? 'Perfuratrizes' : 'Caminhões'}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, código, placa ou obra..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              paddingLeft: '36px',
              fontSize: '12px',
              height: '36px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setApenasAlertas((v) => !v)}
          style={{
            height: '36px',
            padding: '0 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: apenasAlertas ? 'rgba(231, 76, 60, 0.16)' : 'var(--bg-card)',
            color: apenasAlertas ? '#F87171' : 'var(--text-muted)',
            border: `1px solid ${apenasAlertas ? '#E74C3C' : 'var(--border-color)'}`,
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          Somente com Alerta
        </button>
      </div>

      {/* Lista de Veículos */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando frota...</div>
      ) : veiculosFiltrados.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
          Nenhum veículo encontrado. {isGestor ? 'Clique em "Novo Veículo" para cadastrar a primeira perfuratriz ou caminhão.' : ''}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {veiculosFiltrados.map(({ veiculo, statusGeral, vencidas, proximas }) => {
            const unit = veiculo.unidade_medida === 'HORAS' ? 'h' : 'km';
            return (
              <div
                key={veiculo.id}
                onClick={() => {
                  setSelectedVeiculoId(veiculo.id);
                  setActiveTab('PREVENTIVAS');
                }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${statusGeral === 'VENCIDO' ? 'rgba(231, 76, 60, 0.5)' : statusGeral === 'PROXIMO' ? 'rgba(243, 156, 18, 0.5)' : 'var(--border-color)'}`,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', height: '150px', backgroundColor: 'var(--bg-app)' }}>
                  {veiculo.foto_principal_url ? (
                    <img src={veiculo.foto_principal_url} alt={veiculo.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      {veiculo.tipo === 'PERFURATRIZ' ? <Drill size={44} /> : <Truck size={44} />}
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '4px 9px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(10, 22, 28, 0.85)',
                        color: veiculo.tipo === 'PERFURATRIZ' ? 'var(--primary)' : '#38BDF8',
                      }}
                    >
                      {veiculo.tipo === 'PERFURATRIZ' ? 'PERFURATRIZ' : 'CAMINHÃO'}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    {statusBadge(statusGeral)}
                  </div>
                </div>

                <div style={{ padding: '14px' }}>
                  <div style={{ fontWeight: 800, fontSize: '15.5px', color: 'var(--text-main)' }}>
                    {veiculo.nome}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {veiculo.placa ? `Placa: ${veiculo.placa} • ` : ''}
                    {veiculo.servico_nome ? `Obra: ${veiculo.servico_nome}` : 'Base / Pátio'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                      <Gauge size={14} style={{ verticalAlign: 'middle', marginRight: '5px', color: 'var(--primary)' }} />
                      <strong>{veiculo.leitura_atual} {unit}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {vencidas.length > 0
                        ? `${vencidas.length} vencida(s)`
                        : proximas.length > 0
                        ? `${proximas.length} próxima(s)`
                        : `${(veiculo.preventivas || []).length} preventiva(s)`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cadastro/Edição de Veículo */}
      <VeiculoFormModal
        isOpen={showFormModal}
        veiculo={editingVeiculo}
        servicos={servicos}
        planos={planos}
        onClose={() => {
          setShowFormModal(false);
          setEditingVeiculo(null);
        }}
        onSaved={() => {
          setShowFormModal(false);
          setEditingVeiculo(null);
          carregarDados();
        }}
      />

      {/* Modal Planos Padrão */}
      {showPlanosModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1080, padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Planos Padrão de Preventiva</h3>
              <button type="button" onClick={() => setShowPlanosModal(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {planos.map((p) => (
                <div key={p.id} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.nome}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{p.tipo_veiculo} • {p.itens.length} itens</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    {p.itens.map((it, idx) => (
                      <div key={idx}>• {it.nome} (a cada {it.intervalo} {p.tipo_veiculo === 'PERFURATRIZ' ? 'h' : 'km'}, alerta -{it.alerta_antecedencia})</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCriarPlanoPadrao} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Criar Novo Plano Padrão</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  placeholder="Nome do plano"
                  value={planoEditNome}
                  onChange={(e) => setPlanoEditNome(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                />
                <select
                  value={planoEditTipo}
                  onChange={(e) => setPlanoEditTipo(e.target.value as 'PERFURATRIZ' | 'CAMINHAO')}
                  style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                >
                  <option value="PERFURATRIZ">Perfuratriz</option>
                  <option value="CAMINHAO">Caminhão</option>
                </select>
              </div>
              {planoEditItens.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <input
                    placeholder="Nome do item"
                    value={it.nome}
                    onChange={(e) => {
                      const next = [...planoEditItens];
                      next[i] = { ...next[i], nome: e.target.value };
                      setPlanoEditItens(next);
                    }}
                    style={{ flex: 2, padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                  <input
                    type="number"
                    placeholder="Intervalo"
                    value={it.intervalo || ''}
                    onChange={(e) => {
                      const next = [...planoEditItens];
                      next[i] = { ...next[i], intervalo: Number(e.target.value) };
                      setPlanoEditItens(next);
                    }}
                    style={{ width: '95px', padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                  <input
                    type="number"
                    placeholder="Alerta"
                    value={it.alerta_antecedencia || ''}
                    onChange={(e) => {
                      const next = [...planoEditItens];
                      next[i] = { ...next[i], alerta_antecedencia: Number(e.target.value) };
                      setPlanoEditItens(next);
                    }}
                    style={{ width: '85px', padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPlanoEditItens((prev) => [...prev, { nome: '', intervalo: 250, alerta_antecedencia: 25 }])}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', fontSize: '12.5px' }}
                >
                  + Adicionar Item
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
