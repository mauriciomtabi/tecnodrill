import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Barra, Servico } from '../types';
import { parseBarraObservacao } from '../services/api';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { decToDMSForWatermark, reverseGeocode, formatFullAddress, AddressDetails } from '../utils/watermark';
import { 
  X, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Maximize2, 
  User, 
  Clock, 
  Navigation, 
  MapPin, 
  Camera, 
  Trash2,
  Minimize2,
  Building2,
  ChevronLeft,
  ChevronRight,
  Hash,
  Layers
} from 'lucide-react';

interface RegistroDetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  barra: Barra | null;
  servico?: Servico | null;
  isGestor?: boolean;
  onDelete?: (barraId: string) => void;
}

export const RegistroDetalhesModal: React.FC<RegistroDetalhesModalProps> = ({
  isOpen,
  onClose,
  barra,
  servico,
  isGestor = false,
  onDelete
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
  const [dynamicAddress, setDynamicAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);

  // Trata botão nativo de voltar do celular (se tela cheia, fecha fullscreen; senão fecha modal)
  useModalBackButton(
    isOpen, 
    isPhotoFullscreen ? () => setIsPhotoFullscreen(false) : onClose, 
    'registroDetalhes'
  );

  const { observacao: cleanObservacao, meta: barraMeta } = parseBarraObservacao(barra?.observacao);
  const effectiveDiametro = barra?.diametro || barraMeta.diametro;
  const effectiveNumeroOs = barra?.numero_os || barraMeta.numero_os;
  const effectiveTipoRegistro = barra?.tipo_registro || barraMeta.tipo_registro || (barra?.tem_caixa ? 'CAIXA' : 'CANALIZACAO');
  const allPhotos: string[] = (barra?.fotos && barra.fotos.length > 0)
    ? barra.fotos
    : (barraMeta.fotos && barraMeta.fotos.length > 0)
      ? barraMeta.fotos
      : (barra?.foto_url ? [barra.foto_url] : []);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    setActivePhotoIndex(0);
    setZoom(1);
    setRotation(0);
  }, [barra?.id]);

  // Dynamic reverse geocoding for existing records that don't have endereco pre-saved
  useEffect(() => {
    if (!isOpen || !barra) {
      setDynamicAddress(null);
      setLoadingAddress(false);
      return;
    }

    if (barra.endereco) {
      setDynamicAddress(barra.endereco);
      setLoadingAddress(false);
      return;
    }

    if (barra.latitude && barra.longitude) {
      setLoadingAddress(true);
      reverseGeocode(barra.latitude, barra.longitude)
        .then((addr: AddressDetails | null) => {
          if (addr) {
            setDynamicAddress(formatFullAddress(addr));
          } else {
            setDynamicAddress(null);
          }
        })
        .catch(() => {
          setDynamicAddress(null);
        })
        .finally(() => {
          setLoadingAddress(false);
        });
    } else {
      setDynamicAddress(null);
      setLoadingAddress(false);
    }
  }, [isOpen, barra]);

  if (!isOpen || !barra) return null;

  const currentPhoto = allPhotos[activePhotoIndex] || barra.foto_url;

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handlePrevPhoto = () => {
    if (allPhotos.length <= 1) return;
    setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : allPhotos.length - 1));
    setZoom(1);
    setRotation(0);
  };

  const handleNextPhoto = () => {
    if (allPhotos.length <= 1) return;
    setActivePhotoIndex(prev => (prev < allPhotos.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!currentPhoto) return;
    const a = document.createElement('a');
    a.href = currentPhoto;
    a.download = `TecnoDrill_Registro_${barra.numero_barra}_foto_${activePhotoIndex + 1}.jpg`;
    a.click();
  };

  const isBox = effectiveTipoRegistro === 'CAIXA' || (Boolean(barra.tem_caixa) && !effectiveDiametro);
  const dataFormatada = barra.created_at || barra.data_registro || barra.horario_registro
    ? new Date(barra.created_at || barra.data_registro || barra.horario_registro!).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 12, 16, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '12px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="fade-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isPhotoFullscreen ? '98vw' : '480px',
          maxHeight: '94vh',
          backgroundColor: '#0D1C24',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Floating Control Bar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'rgba(13, 28, 36, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            zIndex: 10
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          {/* Photo Counter Pill if multiple photos */}
          {allPhotos.length > 1 && (
            <div 
              style={{
                backgroundColor: 'rgba(240, 90, 34, 0.2)',
                border: '1px solid var(--primary)',
                color: '#FFFFFF',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Foto {activePhotoIndex + 1} de {allPhotos.length}</span>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          {/* Main Photo View Area */}
          <div 
            style={{
              position: 'relative',
              width: '100%',
              minHeight: isPhotoFullscreen ? '65vh' : '320px',
              backgroundColor: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            {currentPhoto ? (
              <img 
                src={currentPhoto} 
                alt={`Registro ${barra.numero_barra}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: isPhotoFullscreen ? '75vh' : '380px',
                  objectFit: 'contain',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out'
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', gap: '8px' }}>
                <Camera size={36} opacity={0.4} />
                <span style={{ fontSize: '12px' }}>Nenhuma foto capturada</span>
              </div>
            )}

            {/* Carousel Navigation Arrows if Multiple Photos */}
            {allPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevPhoto}
                  disabled={activePhotoIndex === 0}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: activePhotoIndex === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)',
                    color: activePhotoIndex === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: activePhotoIndex === 0 ? 'default' : 'pointer',
                    zIndex: 5
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNextPhoto}
                  disabled={activePhotoIndex === allPhotos.length - 1}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: activePhotoIndex === allPhotos.length - 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)',
                    color: activePhotoIndex === allPhotos.length - 1 ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: activePhotoIndex === allPhotos.length - 1 ? 'default' : 'pointer',
                    zIndex: 5
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Thumbnail Carousel strip if multiple photos */}
            {allPhotos.length > 1 && (
              <div 
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '6px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  borderRadius: '20px',
                  backdropFilter: 'blur(4px)',
                  zIndex: 6
                }}
              >
                {allPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      border: activePhotoIndex === idx ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
                      padding: 0,
                      cursor: 'pointer',
                      backgroundColor: '#000'
                    }}
                  >
                    <img src={photo} alt={`Miniatura ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Photo Inspection Toolbar */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '8px 16px',
              backgroundColor: '#071319',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <button 
              onClick={handleZoomOut} 
              title="Reduzir Zoom" 
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={handleResetZoom} 
              title="Resetar Zoom"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button 
              onClick={handleZoomIn} 
              title="Aumentar Zoom" 
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ZoomIn size={16} />
            </button>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
            <button 
              onClick={handleRotate} 
              title="Girar Imagem" 
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <RotateCw size={16} />
            </button>
            <button 
              onClick={handleDownload} 
              title="Baixar Foto Original" 
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => setIsPhotoFullscreen(!isPhotoFullscreen)} 
              title={isPhotoFullscreen ? "Reduzir Foto" : "Expandir Foto"} 
              style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isPhotoFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          {/* Technical Data Details Card */}
          <div 
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: '#0D1C24'
            }}
          >
            {/* Header: Badges & Title */}
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor: isBox ? 'rgba(39, 174, 96, 0.18)' : 'rgba(240, 90, 34, 0.18)',
                    color: isBox ? 'var(--success)' : 'var(--primary)',
                  }}
                >
                  <Camera size={11} />
                  <span>{isBox ? 'INSTALAÇÃO DE CAIXA' : 'CANALIZAÇÃO'}</span>
                </span>

                {effectiveDiametro && (
                  <span 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <Layers size={11} />
                    <span>Ø {effectiveDiametro}</span>
                  </span>
                )}

                {effectiveNumeroOs && (
                  <span 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: 'rgba(0, 188, 212, 0.15)',
                      color: '#00bcd4',
                    }}
                  >
                    <Hash size={11} />
                    <span>OS: {effectiveNumeroOs}</span>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  REGISTRO {barra.numero_barra}
                </h3>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {isBox ? 'Ponto de Caixa' : `+${barra.metros || 3}m (Acum: ${barra.metros_acumulados}m)`}
                </span>
              </div>
            </div>

            {/* List Details Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              
              {/* Diâmetro do Tubo se houver */}
              {effectiveDiametro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                  <Layers size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>DIÂMETRO DA TUBULAÇÃO</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{effectiveDiametro}</span>
                  </div>
                </div>
              )}

              {/* Número da OS se houver */}
              {effectiveNumeroOs && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                  <Hash size={16} style={{ color: '#00bcd4', flexShrink: 0 }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>ORDEM DE SERVIÇO (OS)</span>
                    <span style={{ color: '#00bcd4', fontWeight: 700 }}>{effectiveNumeroOs}</span>
                  </div>
                </div>
              )}
              
              {/* Cadastrado Por */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                <User size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>CADASTRADO POR</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {servico?.navegador_nome || servico?.operador_nome || 'Equipe TecnoDrill'}
                  </span>
                </div>
              </div>

              {/* Data e Hora */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                <Clock size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>DATA E HORA</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{dataFormatada}</span>
                </div>
              </div>

              {/* Localização GPS (Coordenadas DMS) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                <Navigation size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>LOCALIZAÇÃO GPS</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                    {barra.latitude && barra.longitude 
                      ? `${decToDMSForWatermark(barra.latitude, true)} ${decToDMSForWatermark(barra.longitude, false)}`
                      : 'Não disponível'}
                  </span>
                </div>
              </div>

              {/* Endereço Completo do Ponto de Registro */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                    ENDEREÇO COMPLETO
                  </span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '12px', lineHeight: '1.4', display: 'block' }}>
                    {dynamicAddress ? (
                      dynamicAddress
                    ) : loadingAddress ? (
                      <span style={{ color: 'var(--primary)', fontStyle: 'italic', fontSize: '11px' }}>
                        Identificando endereço do registro...
                      </span>
                    ) : (
                      'Endereço não disponível'
                    )}
                  </span>
                </div>
              </div>

              {/* Cidade / Localidade da Obra */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                <Building2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>CIDADE / LOCALIDADE DA OBRA</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {servico?.local || servico?.cidade || servico?.nome || 'Localidade da Obra'}
                  </span>
                </div>
              </div>

              {/* Observação Técnica se houver texto limpo digitado pelo usuário */}
              {cleanObservacao && cleanObservacao.trim().length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    OBSERVAÇÃO TÉCNICA
                  </span>
                  <p style={{ color: '#FFFFFF', fontSize: '12px', fontStyle: 'italic', margin: 0, lineHeight: '1.4' }}>
                    {cleanObservacao}
                  </p>
                </div>
              )}

              {/* Botão Excluir Registro para Gestores */}
              {isGestor && onDelete && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginTop: '4px' }}>
                  <button
                    onClick={() => onDelete(barra.id)}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid var(--danger)',
                      color: 'var(--danger)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Excluir este Registro</span>
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
