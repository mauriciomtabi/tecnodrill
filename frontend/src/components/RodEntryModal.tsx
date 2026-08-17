import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Barra } from '../types';
import { 
  Camera, 
  Image as ImageIcon, 
  X, 
  ArrowLeft, 
  MapPin, 
  Check, 
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [metros, setMetros] = useState<number>(3);
  const [temCaixa, setTemCaixa] = useState<boolean>(false);
  const [observacao, setObservacao] = useState<string>('');
  
  // GPS State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [capturingGps, setCapturingGps] = useState<boolean>(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const captureLocation = () => {
    if ('geolocation' in navigator) {
      setCapturingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setPrecisao(Math.round(pos.coords.accuracy));
          setCapturingGps(false);
        },
        () => {
          setCapturingGps(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFotoUrl(null);
      setMetros(3);
      setTemCaixa(false);
      setObservacao('');
      captureLocation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

          // Carimbo com data, hora e marca TecnoDrill
          const now = new Date();
          const dataHoraStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(10, height - 38, 330, 28);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(`TecnoDrill INFRA • ${dataHoraStr}`, 18, height - 19);

          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setFotoUrl(compressed);
          setStep(2); // Avança automaticamente para o Passo 2
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = async () => {
    await onSubmit({
      numero_barra: nextBarraNumber,
      metros: Number(metros) || 3,
      tem_caixa: temCaixa,
      observacao: observacao.trim() || undefined,
      foto_url: fotoUrl || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined
    });
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
        backgroundColor: 'rgba(5, 12, 16, 0.92)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />

      {/* Main Container */}
      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#0D1C24',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          boxSizing: 'border-box'
        }}
      >
        {/* =========================================================================
            PASSO 1: CAPTURA DE FOTO (IDÊNTICO AO APP JLE)
           ========================================================================= */}
        {step === 1 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Registrar Novo Registro
              </h2>
              <button
                onClick={onClose}
                style={{ color: 'var(--danger)', padding: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Inner Step Card */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px'
              }}
            >
              {/* Dashed Camera Circle */}
              <div 
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  border: '2px dashed #2A8ACC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2A8ACC',
                  backgroundColor: 'rgba(42, 138, 204, 0.08)'
                }}
              >
                <Camera size={40} />
              </div>

              <div>
                <strong style={{ fontSize: '16px', color: '#FFFFFF', display: 'block', marginBottom: '6px' }}>
                  Registrar Nova Estrutura
                </strong>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  Tire uma foto da estrutura ou escolha um arquivo da galeria.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    padding: '13px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(240, 90, 34, 0.4)'
                  }}
                >
                  <Camera size={18} />
                  <span>Tirar Foto (Câmera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  style={{
                    backgroundColor: 'rgba(42, 138, 204, 0.15)',
                    color: '#2A8ACC',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: '1px solid rgba(42, 138, 204, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <ImageIcon size={18} />
                  <span>Escolher da Galeria</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Voltar para o Serviço
              </button>
            </div>

          </div>
        )}

        {/* =========================================================================
            PASSO 2: METRAGEM E SE TEM CAIXA (IDÊNTICO AO APP JLE)
           ========================================================================= */}
        {step === 2 && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
              >
                <ArrowLeft size={18} />
              </button>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PASSO 2 DE 3 — ESTRUTURA DO REGISTRO
              </span>
            </div>

            {/* Photo Thumbnail & Replace Buttons */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div style={{ position: 'relative', width: '80px', height: '65px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000', flexShrink: 0 }}>
                {fotoUrl && (
                  <img src={fotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <span 
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--success)',
                    color: '#FFFFFF',
                    fontSize: '9px',
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: '1px 0'
                  }}
                >
                  NOVO
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Substituir imagem atual:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(42, 138, 204, 0.15)',
                      border: '1px solid #2A8ACC',
                      color: '#2A8ACC',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Camera size={13} />
                    <span>Câmera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(42, 138, 204, 0.15)',
                      border: '1px solid #2A8ACC',
                      color: '#2A8ACC',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <ImageIcon size={13} />
                    <span>Galeria</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Seletor de Metragem Apontada */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Metragem Apontada (Metros)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button
                  type="button"
                  onClick={() => setMetros(prev => Math.max(1, prev - 3))}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Minus size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {metros}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    metros
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setMetros(prev => prev + 3)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Toggle Possui Caixa / Sem Caixa */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Instalação de Caixa
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setTemCaixa(false)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    backgroundColor: !temCaixa ? 'var(--primary)' : 'var(--bg-app)',
                    color: !temCaixa ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${!temCaixa ? 'var(--primary)' : 'var(--border-color)'}`,
                    boxShadow: !temCaixa ? '0 4px 12px rgba(240, 90, 34, 0.35)' : 'none'
                  }}
                >
                  Sem Caixa
                </button>

                <button
                  type="button"
                  onClick={() => setTemCaixa(true)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    backgroundColor: temCaixa ? 'var(--primary)' : 'var(--bg-app)',
                    color: temCaixa ? '#FFFFFF' : 'var(--text-muted)',
                    border: `1px solid ${temCaixa ? 'var(--primary)' : 'var(--border-color)'}`,
                    boxShadow: temCaixa ? '0 4px 12px rgba(240, 90, 34, 0.35)' : 'none'
                  }}
                >
                  Com Caixa
                </button>
              </div>
            </div>

            {/* Avançar para Passo 3 */}
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)',
                marginTop: '4px'
              }}
            >
              Avançar para Confirmação
            </button>

          </div>
        )}

        {/* =========================================================================
            PASSO 3: CONFIRMAÇÃO, LOCALIZAÇÃO, OBSERVAÇÃO E ENVIO (IDÊNTICO AO APP JLE)
           ========================================================================= */}
        {step === 3 && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}
              >
                <ArrowLeft size={18} />
              </button>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PASSO 3 DE 3 — CONFIRMAÇÃO
              </span>
            </div>

            {/* Big Photo Preview with Badges */}
            <div 
              style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: '#000',
                border: '1px solid var(--border-color)'
              }}
            >
              {fotoUrl && (
                <img src={fotoUrl} alt="Registro" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}

              {/* Tag Top Left: REGISTRO */}
              <div 
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  color: '#FFFFFF',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Camera size={13} />
                <span>{temCaixa ? 'CAIXA' : 'CANALIZAÇÃO'}</span>
              </div>

              {/* Tag Bottom Right: PRÓXIMO # */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#FFFFFF',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                PRÓXIMO: #{nextBarraNumber} (+{metros}m)
              </div>
            </div>

            {/* Card Localização Capturada */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>📍</span>
                  <strong style={{ fontSize: '12px', color: 'var(--success)' }}>
                    Localização capturada
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={captureLocation}
                  disabled={capturingGps}
                  style={{
                    color: '#2A8ACC',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={11} className={capturingGps ? 'animate-spin' : ''} />
                  <span>{capturingGps ? 'Obtendo...' : 'Recapturar'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Check size={14} style={{ color: 'var(--success)' }} />
                <span>
                  {latitude && longitude 
                    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)} · prec: ${precisao || 10}m` 
                    : 'GPS obtido pelo dispositivo'}
                </span>
              </div>
            </div>

            {/* Observação (Opcional - Máx 500 caract.) */}
            <div>
              <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                OBSERVAÇÃO (OPCIONAL — MÁX 500 CARACT.)
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={500}
                placeholder="Observações sobre o solo, interferências, condições do local..."
                rows={3}
                style={{
                  width: '100%',
                  fontSize: '12.5px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botão de Envio Final */}
            <button
              type="button"
              disabled={loading}
              onClick={handleFinalSubmit}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <span>Enviando...</span>
              ) : (
                <span>Enviar Registro #{nextBarraNumber}</span>
              )}
            </button>

          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
