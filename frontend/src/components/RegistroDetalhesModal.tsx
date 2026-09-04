import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Barra, Servico } from '../types';
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

  const allPhotos: string[] = (barra?.fotos && barra.fotos.length > 0)
    ? barra.fotos
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

  const isBox = barra.tipo_registro === 'CAIXA' || barra.tem_caixa;
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
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* =========================================================================
            PARTE 1: FOTO & TOOLBAR DE CONTROLES (IDÊNTICO AO APP JLE)
           ========================================================================= */}
        <div style={{ position: 'relative', width: '100%', backgroundColor: '#050C10', flexShrink: 0 }}>
          
          {/* Top Floating Voltar Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 20,
              backgroundColor: 'rgba(13, 28, 36, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </button>

          {/* Top Right Photo Count Badge */}
          {allPhotos.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}
            >
              Foto {activePhotoIndex + 1} de {allPhotos.length}
            </div>
          )}

          {/* Photo Viewport with Pan/Zoom/Rotation */}
          <div 
            style={{
              width: '100%',
              height: isPhotoFullscreen ? '80vh' : '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={`Registro ${barra.numero_barra} Foto ${activePhotoIndex + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                  userSelect: 'none'
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Camera size={36} />
                <span style={{ fontSize: '13px' }}>Sem foto cadastrada para este registro</span>
              </div>
            )}

            {/* Prev Photo Arrow */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 22
                }}
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Next Photo Arrow */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 22
                }}
              >
                <ChevronRight size={20} />
              </button>
            )}

            {/* Thumbnail dots / strip */}
            {allPhotos.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '6px',
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  padding: '4px 8px',
                  borderRadius: '20px',
                  zIndex: 22,
                  backdropFilter: 'blur(4px)'
                }}
              >
                {allPhotos.map((thumb, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setActivePhotoIndex(idx); setZoom(1); setRotation(0); }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: idx === activePhotoIndex ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.3)',
                      overflow: 'hidden',
                      padding: 0,
                      cursor: 'pointer',
                      background: 'transparent'
                    }}
                  >
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Photo Action Toolbar (Zoom, Rotate, Download, Fullscreen) */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(13, 28, 36, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#FFFFFF'
            }}
          >
            <button
              onClick={handleZoomOut}
              title="Reduzir Zoom"
              style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
            >
              <ZoomOut size={16} />
            </button>

            <button
              onClick={handleResetZoom}
              title="Zoom Padrão"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '11px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              title="Aumentar Zoom"
              style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
            >
              <ZoomIn size={16} />
            </button>

            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

            <button
              onClick={handleRotate}
              title="Girar Foto 90°"
              style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
            >
              <RotateCw size={16} />
            </button>

            <button
              onClick={handleDownload}
              title="Baixar Foto Oficial"
              style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
            >
              <Download size={16} />
            </button>

            <button
              onClick={() => setIsPhotoFullscreen(prev => !prev)}
              title={isPhotoFullscreen ? 'Sair da Tela Cheia' : 'Foto em Tela Cheia'}
              style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
            >
              {isPhotoFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* =========================================================================
            PARTE 2: PAINEL DE DETALHES TÉCNICOS (COM ENDEREÇO COMPLETO E COORDENADAS)
           ========================================================================= */}
        {!isPhotoFullscreen && (
          <div 
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflowY: 'auto',
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

                {barra.diametro && (
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
                    <span>Ø {barra.diametro}</span>
                  </span>
                )}

                {barra.numero_os && (
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
                    <span>OS: {barra.numero_os}</span>
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
              {barra.diametro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                  <Layers size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>DIÂMETRO DA TUBULAÇÃO</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{barra.diametro}</span>
                  </div>
                </div>
              )}

              {/* Número da OS se houver */}
              {barra.numero_os && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                  <Hash size={16} style={{ color: '#00bcd4', flexShrink: 0 }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase' }}>ORDEM DE SERVIÇO (OS)</span>
                    <span style={{ color: '#00bcd4', fontWeight: 700 }}>{barra.numero_os}</span>
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
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
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

              {/* Observação Técnica se houver */}
              {barra.observacao && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    OBSERVAÇÃO TÉCNICA
                  </span>
                  <p style={{ color: '#FFFFFF', fontSize: '12px', fontStyle: 'italic', margin: 0, lineHeight: '1.4' }}>
                    {barra.observacao}
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
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
