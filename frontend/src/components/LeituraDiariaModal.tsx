import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Veiculo } from '../types';
import { ManutencaoService, calcularStatusPreventiva } from '../services/manutencaoService';
import { Gauge, Truck, Drill, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LeituraDiariaModalProps {
  isOpen: boolean;
  veiculos: Veiculo[];
  servicoNome?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const LeituraDiariaModal: React.FC<LeituraDiariaModalProps> = ({
  isOpen,
  veiculos,
  servicoNome,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useAuth();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && veiculos.length > 0) {
      const initial: Record<string, string> = {};
      veiculos.forEach((v) => {
        initial[v.id] = v.leitura_atual ? String(v.leitura_atual) : '';
      });
      setValores(initial);
    }
  }, [isOpen, veiculos]);

  if (!isOpen || veiculos.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const entradas: Array<{ veiculo: Veiculo; leitura_informada: number }> = [];
    for (const v of veiculos) {
      const raw = (valores[v.id] || '').replace(',', '.').trim();
      const num = Number(raw);
      if (!raw || isNaN(num) || num < 0) {
        showToast(`Informe a leitura válida para ${v.nome}.`, 'error');
        return;
      }
      if (num < Number(v.leitura_atual || 0)) {
        const unit = v.unidade_medida === 'HORAS' ? 'h' : 'km';
        showToast(
          `${v.nome}: a leitura (${num}${unit}) não pode ser menor que a atual (${v.leitura_atual}${unit}).`,
          'error'
        );
        return;
      }
      entradas.push({ veiculo: v, leitura_informada: num });
    }

    setSaving(true);
    try {
      await ManutencaoService.registrarLeituras(entradas, 'PRIMEIRO_REGISTRO_DIA');
      showToast('Leituras diárias registradas! Continuando apontamento...', 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar leituras diárias.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          padding: '22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(240, 90, 34, 0.16)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Gauge size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Leitura Obrigatória do Dia
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                {servicoNome ? `Obra: ${servicoNome} • ` : ''}
                Informe o horímetro e/ou km antes do 1º registro de hoje.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '8px',
            }}
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {veiculos.map((v) => {
            const unit = v.unidade_medida === 'HORAS' ? 'h' : 'km';
            const labelCampo = v.tipo === 'PERFURATRIZ' ? 'Horímetro Atual (horas)' : 'Odômetro / Km Atual';
            const preventivas = (v.preventivas || []).map((p) =>
              calcularStatusPreventiva(p, Number(valores[v.id] || v.leitura_atual))
            );
            const vencidas = preventivas.filter((p) => p.status === 'VENCIDO');
            const proximas = preventivas.filter((p) => p.status === 'PROXIMO');

            return (
              <div
                key={v.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-app)',
                  border: `1px solid ${vencidas.length > 0 ? 'rgba(231, 76, 60, 0.5)' : proximas.length > 0 ? 'rgba(243, 156, 18, 0.5)' : 'var(--border-color)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {v.foto_principal_url ? (
                    <img
                      src={v.foto_principal_url}
                      alt={v.nome}
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {v.tipo === 'PERFURATRIZ' ? <Drill size={22} /> : <Truck size={22} />}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                        {v.nome}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '999px',
                          backgroundColor: v.tipo === 'PERFURATRIZ' ? 'rgba(240, 90, 34, 0.16)' : 'rgba(14, 165, 233, 0.16)',
                          color: v.tipo === 'PERFURATRIZ' ? 'var(--primary)' : '#38BDF8',
                        }}
                      >
                        {v.tipo === 'PERFURATRIZ' ? 'PERFURATRIZ' : 'CAMINHÃO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Última leitura: <strong style={{ color: 'var(--text-main)' }}>{v.leitura_atual} {unit}</strong>
                      {v.placa ? ` • Placa ${v.placa}` : ''}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {labelCampo} *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      step="0.1"
                      min={v.leitura_atual || 0}
                      required
                      value={valores[v.id] ?? ''}
                      onChange={(e) => setValores((prev) => ({ ...prev, [v.id]: e.target.value }))}
                      placeholder={`Ex: ${v.leitura_atual}`}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '28px' }}>
                      {unit}
                    </span>
                  </div>
                </div>

                {(vencidas.length > 0 || proximas.length > 0) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: vencidas.length > 0 ? 'rgba(231, 76, 60, 0.12)' : 'rgba(243, 156, 18, 0.12)',
                      color: vencidas.length > 0 ? '#FCA5A5' : '#FCD34D',
                      fontSize: '11.5px',
                      lineHeight: 1.4,
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      {vencidas.length > 0 && (
                        <div>
                          <strong>Preventiva vencida:</strong> {vencidas.map((p) => p.nome).join(', ')}. Avise o gestor!
                        </div>
                      )}
                      {proximas.length > 0 && (
                        <div>
                          <strong>Próxima do vencimento:</strong> {proximas.map((p) => `${p.nome} (faltam ${p.restante}${unit})`).join(', ')}.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={18} />
              {saving ? 'Salvando...' : 'Confirmar e Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
