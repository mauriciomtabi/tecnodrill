import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Barra } from '../types';
import { Camera, X, Box, MapPin } from 'lucide-react';

interface RodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextBarraNumber: number;
  onSubmit: (barraData: Partial<Barra>) => Promise<void>;
  loading?: boolean;
}

export const RodEntryModal: React.FC<RodEntryModalProps> = ({
  isOpen,
  onClose,
  nextBarraNumber,
  onSubmit,
  loading = false
}) => {
  const [metros, setMetros] = useState<string>('3');
  const [temCaixa, setTemCaixa] = useState<boolean>(false);
  const [observacao, setObservacao] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Obtendo GPS...');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capturar GPS automaticamente ao abrir
  useEffect(() => {
    if (isOpen) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLatitude(pos.coords.latitude);
            setLongitude(pos.coords.longitude);
            setGpsStatus('GPS Capturado ✓');
          },
          () => {
            setGpsStatus('GPS não disponível');
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);

          // Inserir carimbo com data/hora
          const now = new Date();
          const dataHoraStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(10, height - 40, 320, 30);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.fillText(`TecnoDrill INFRA • ${dataHoraStr}`, 20, height - 20);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFotoUrl(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const metrosNum = Number(metros) || 3;

    await onSubmit({
      numero_barra: nextBarraNumber,
      metros: metrosNum,
      tem_caixa: temCaixa,
      tipo_caixa: temCaixa ? 'Caixa' : undefined,
      observacao: observacao.trim() || undefined,
      foto_url: fotoUrl || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined
    });

    // Reset
    setMetros('3');
    setTemCaixa(false);
    setObservacao('');
    setFotoUrl(null);
  };

  return createPortal(
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0,
        top: 0, 
        left: 0, 
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)', 
        backdropFilter: 'blur(4px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 999999, 
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="fade-in" 
        style={{ 
          width: '100%', 
          maxWidth: '500px', 
          backgroundColor: 'var(--bg-card)', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-color)', 
          padding: '20px', 
          maxHeight: '92vh', 
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          margin: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Apontamento de Campo #{nextBarraNumber}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Tire a foto da execução, informe a metragem e se há caixa no local
            </span>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 1. CAPTURA DE FOTO */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
              FOTO DA EXECUÇÃO / LOCAL
            </label>

            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              ref={fileInputRef} 
              onChange={handlePhotoSelect} 
              style={{ display: 'none' }} 
            />

            {fotoUrl ? (
              <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <img 
                  src={fotoUrl} 
                  alt="Registro" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <button
                  type="button"
                  onClick={() => setFotoUrl(null)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(231, 76, 60, 0.85)',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Remover foto"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  height: '110px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-input)',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ padding: '8px', backgroundColor: 'rgba(240, 90, 34, 0.1)', borderRadius: '50%', color: 'var(--primary)' }}>
                  <Camera size={22} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                  Tirar Foto / Carregar da Galeria
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Clique para abrir a câmera do celular
                </span>
              </div>
            )}
          </div>

          {/* 2. METRAGEM INFORMADA */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
              METRAGEM EXECUTADA NESTE REGISTRO (METROS) *
            </label>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {['3', '6', '10', '15', '20'].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMetros(val)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: metros === val ? 'var(--primary)' : 'var(--bg-input)',
                    color: metros === val ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${metros === val ? 'var(--primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer'
                  }}
                >
                  +{val}m
                </button>
              ))}
            </div>

            <input 
              type="number" 
              step="any"
              value={metros} 
              onChange={e => setMetros(e.target.value)} 
              placeholder="Metros executados (ex: 3, 10, 15...)" 
              required
              style={{ fontSize: '15px', fontWeight: 700 }}
            />
          </div>

          {/* 3. SE TEM CAIXA OU NÃO (UMA SÓ, SEM OPÇÕES EXTRAS) */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
              POSSUI CAIXA NO LOCAL?
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTemCaixa(false)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  backgroundColor: !temCaixa ? 'var(--bg-app)' : 'var(--bg-input)',
                  color: !temCaixa ? 'var(--text-main)' : 'var(--text-muted)',
                  border: `2px solid ${!temCaixa ? 'var(--text-muted)' : 'var(--border-color)'}`
                }}
              >
                <span>Sem Caixa</span>
              </button>

              <button
                type="button"
                onClick={() => setTemCaixa(true)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  backgroundColor: temCaixa ? 'rgba(39, 174, 96, 0.18)' : 'var(--bg-input)',
                  color: temCaixa ? 'var(--success)' : 'var(--text-muted)',
                  border: `2px solid ${temCaixa ? 'var(--success)' : 'var(--border-color)'}`
                }}
              >
                <Box size={16} />
                <span>✓ Com Caixa</span>
              </button>
            </div>
          </div>

          {/* 4. OBSERVAÇÕES */}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)' }}>
              OBSERVAÇÃO DO CAMPO (OPCIONAL)
            </label>
            <textarea 
              value={observacao} 
              onChange={e => setObservacao(e.target.value)} 
              placeholder="ex: Travessia concluída, solo argiloso, sem interferências..." 
              rows={2}
              style={{ fontSize: '12px', resize: 'vertical' }}
            />
          </div>

          {/* GPS Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
            <MapPin size={12} style={{ color: latitude ? 'var(--success)' : 'var(--warning)' }} />
            <span>{gpsStatus} {latitude && longitude ? `(${latitude.toFixed(5)}, ${longitude.toFixed(5)})` : ''}</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary"
              style={{ padding: '9px 22px', fontSize: '13px', fontWeight: 700 }}
            >
              {loading ? 'Salvando...' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
