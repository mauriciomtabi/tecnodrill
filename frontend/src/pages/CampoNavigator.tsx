import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Servico, Furo, Barra } from '../types';
import { ApiService } from '../services/api';
import { OfflineSyncService } from '../services/offlineSync';
import { RodEntryModal } from '../components/RodEntryModal';
import { MetaCelebration } from '../components/MetaCelebration';
import { 
  HardHat, 
  Plus, 
  Trophy, 
  Target, 
  MapPin, 
  Trash2, 
  Box, 
  Camera, 
  X,
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface CampoNavigatorProps {
  onVerFichaOficial: (furoId: string) => void;
  servicoIdProp?: string;
}

export const CampoNavigator: React.FC<CampoNavigatorProps> = ({ onVerFichaOficial, servicoIdProp }) => {
  const { user, showToast } = useAuth();

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selectedServicoId, setSelectedServicoId] = useState<string>('');
  const [selectedFuro, setSelectedFuro] = useState<Furo | null>(null);
  const [barras, setBarras] = useState<Barra[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Modal de Adição
  const [showAddBarraModal, setShowAddBarraModal] = useState(false);
  const [savingBarra, setSavingBarra] = useState(false);

  // Modal de Celebração de Meta
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    metaMetros: number;
    metrosAtingidos: number;
    tipoMeta: 'DIARIA' | 'SEMANAL';
  }>({ metaMetros: 54, metrosAtingidos: 54, tipoMeta: 'DIARIA' });

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const servicosData = await ApiService.getServicos();
      setServicos(servicosData);

      const targetId = servicoIdProp || (servicosData.length > 0 ? servicosData[0].id : '');
      if (targetId) {
        setSelectedServicoId(targetId);
        await loadFuroForServico(targetId);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de campo:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFuroForServico = async (sId: string) => {
    try {
      const furos = await ApiService.getFuros(sId);
      if (furos.length > 0) {
        const furoCompleto = await ApiService.getFuro(furos[0].id);
        setSelectedFuro(furoCompleto);
        const barrasData = await ApiService.getBarras(furoCompleto.id);
        setBarras(barrasData);
      } else {
        const novoFuro = await ApiService.createFuro({
          servico_id: sId,
          navegador_nome: user?.nome || 'Navegador',
          operador_nome: 'Operador',
          status: 'EM_EXECUCAO',
          comprimento_furo: 0
        });
        setSelectedFuro(novoFuro);
        setBarras([]);
      }
    } catch (err) {
      console.error('Erro ao carregar furo da obra:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [servicoIdProp]);

  const handleSelectServicoChange = async (sId: string) => {
    setSelectedServicoId(sId);
    setLoading(true);
    await loadFuroForServico(sId);
    setLoading(false);
  };

  const currentServico = servicos.find(s => s.id === selectedServicoId);

  const totalMetrosExecutados = barras.length > 0 ? (barras[barras.length - 1]?.metros_acumulados || 0) : 0;
  const metaMetros = currentServico?.meta_metros || 54;
  const tipoMeta = currentServico?.tipo_meta || 'DIARIA';
  const percentualMeta = metaMetros > 0 ? Math.round((totalMetrosExecutados / metaMetros) * 100) : 0;
  const metaAtingida = totalMetrosExecutados >= metaMetros;
  const totalCaixas = barras.filter(b => b.tem_caixa).length;

  const handleSaveBarra = async (barraData: Partial<Barra>) => {
    if (!selectedFuro) return;
    setSavingBarra(true);

    try {
      if (!navigator.onLine) {
        OfflineSyncService.enqueueBarra(selectedFuro.id, barraData);
        const metrosDeste = barraData.metros || 3;
        const totalLocal = totalMetrosExecutados + metrosDeste;
        const novaBarraLocal: Barra = {
          id: `local_${Date.now()}`,
          furo_id: selectedFuro.id,
          numero_barra: barraData.numero_barra || (barras.length + 1),
          metros: metrosDeste,
          metros_acumulados: totalLocal,
          tem_caixa: barraData.tem_caixa,
          tipo_caixa: barraData.tipo_caixa,
          observacao: barraData.observacao,
          foto_url: barraData.foto_url,
          horario_registro: new Date().toISOString()
        };
        setBarras(prev => [...prev, novaBarraLocal]);
        showToast('Apontamento salvo em cache offline.', 'info');
        setShowAddBarraModal(false);
        return;
      }

      const res = await ApiService.addBarra(selectedFuro.id, barraData);
      setBarras(prev => [...prev, res.barra]);

      const totalApos = res.barra.metros_acumulados;
      if (res.celebrarMeta || (totalApos >= metaMetros)) {
        setCelebrationData({
          metaMetros,
          metrosAtingidos: totalApos,
          tipoMeta
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

  const handleDeleteBarra = async (barraId: string) => {
    if (!confirm('Deseja realmente remover este registro?')) return;
    try {
      await ApiService.deleteBarra(barraId);
      setBarras(prev => prev.filter(b => b.id !== barraId));
      showToast('Registro excluído com sucesso.', 'info');
    } catch (err: any) {
      showToast('Erro ao remover registro.', 'error');
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header */}
      <div className="upper-header">
        <div>
          <h1 className="header-title">Apontamento de Campo</h1>
          <p className="header-subtitle">Registro de fotos, metragens e caixas de passagem em tempo real</p>
        </div>

        <button
          onClick={() => setShowAddBarraModal(true)}
          className="header-action-btn"
        >
          <Plus size={16} />
          <span>+ Novo Registro</span>
        </button>
      </div>

      {/* Select Service Dropdown */}
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
            <HardHat size={18} />
          </div>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Serviço Ativo:
            </span>
            <select
              value={selectedServicoId}
              onChange={(e) => handleSelectServicoChange(e.target.value)}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} • {s.nome} - {s.cliente} ({s.local})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentServico && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} style={{ color: 'var(--primary)' }} />
              {currentServico.local}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Box size={12} style={{ color: 'var(--success)' }} />
              {totalCaixas} caixas
            </span>
          </div>
        )}
      </div>

      {/* Target Progress Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: metaAtingida ? '2px solid var(--success)' : '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '10px', 
                backgroundColor: metaAtingida ? 'var(--success)' : 'var(--primary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#FFFFFF'
              }}
            >
              <Trophy size={20} />
            </div>

            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Meta {tipoMeta === 'DIARIA' ? 'Diária' : 'Semanal'} de Produção
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <strong style={{ fontSize: '18px', color: 'var(--text-main)' }}>
                  {totalMetrosExecutados}m
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  de {metaMetros}m ({percentualMeta}%)
                </span>
                {metaAtingida && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(39, 174, 96, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    🎉 Meta Batida!
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowAddBarraModal(true)}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 700 }}
          >
            <Plus size={15} />
            <span>+ Lançar Registro</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div 
            style={{ 
              width: `${Math.min(100, percentualMeta)}%`, 
              height: '100%', 
              backgroundColor: metaAtingida ? 'var(--success)' : 'var(--primary)', 
              transition: 'width 0.4s ease' 
            }} 
          />
        </div>
      </div>

      {/* Registros de Campo */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Apontamentos Realizados ({barras.length} Registros)
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Fotos, metragens e confirmações de caixas de passagem
            </span>
          </div>
        </div>

        {barras.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            Nenhum registro lançado para esta obra. Clique em "+ Novo Registro" para apontar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {barras.map((b) => (
              <div 
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Left: Photo Thumbnail & Seq */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {b.foto_url ? (
                    <div 
                      onClick={() => setPreviewPhotoUrl(b.foto_url!)}
                      style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '6px', 
                        overflow: 'hidden', 
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)' 
                      }}
                      title="Clique para ver a foto"
                    >
                      <img src={b.foto_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '6px', 
                        backgroundColor: 'var(--bg-app)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)' 
                      }}
                    >
                      <Camera size={18} />
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        Registro #{b.numero_barra}
                      </strong>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'rgba(240, 90, 34, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        +{b.metros || 3}m (Total: {b.metros_acumulados}m)
                      </span>
                    </div>

                    {b.observacao && (
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {b.observacao}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Box Badge, Time & Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {b.tem_caixa ? (
                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Box size={12} />
                      <span>{b.tipo_caixa || 'Com Caixa'}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      Sem Caixa
                    </span>
                  )}

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {b.horario_registro ? new Date(b.horario_registro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>

                  <button
                    onClick={() => handleDeleteBarra(b.id)}
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    className="hover:text-rose-400"
                    title="Excluir Registro"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Lançamento */}
      <RodEntryModal
        isOpen={showAddBarraModal}
        onClose={() => setShowAddBarraModal(false)}
        nextBarraNumber={barras.length + 1}
        onSubmit={handleSaveBarra}
        loading={savingBarra}
      />

      {/* Modal de Celebração de Meta */}
      <MetaCelebration
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        metaMetros={celebrationData.metaMetros}
        metrosAtingidos={celebrationData.metrosAtingidos}
        tipoMeta={celebrationData.tipoMeta}
        nomeServico={currentServico?.nome || 'Canalização'}
      />

      {/* Lightbox para Foto Expandida */}
      {previewPhotoUrl && (
        <div 
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={previewPhotoUrl} 
              alt="Foto Ampliada" 
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} 
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
        </div>
      )}
    </div>
  );
};
