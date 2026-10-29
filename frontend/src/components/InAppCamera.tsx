import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RotateCcw, Zap, ZapOff, Image as ImageIcon, AlertTriangle, Loader2 } from 'lucide-react';

interface InAppCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Photo: string) => void;
  onSelectFromGallery?: () => void;
  onFallbackToNativeCamera?: () => void;
}

export const InAppCamera: React.FC<InAppCameraProps> = ({
  isOpen,
  onClose,
  onCapture,
  onSelectFromGallery,
  onFallbackToNativeCamera
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Para todo e qualquer stream e libera hardware de câmera
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
      } catch (_) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isCapturingRef.current = false;
    setIsCapturing(false);
  }, []);

  // Inicializa o stream da câmera com resolução controlada para economizar RAM
  const startCamera = useCallback(async (mode: 'environment' | 'user', isRetry: boolean = false) => {
    stopStream();
    setIsInitializing(true);
    setCameraError(null);
    setTorchOn(false);
    setHasTorch(false);
    isCapturingRef.current = false;
    setIsCapturing(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Seu navegador ou aparelho não suporta a câmera ao vivo direta. Utilize a câmera do celular.');
      setIsInitializing(false);
      return;
    }

    try {
      // Tenta 3 níveis de compatibilidade de restrições de vídeo
      let stream: MediaStream | null = null;

      // Nível 1: Resolução ideal Full HD e facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          },
          audio: false
        });
      } catch (firstErr) {
        console.warn('[Camera] Fallback nível 1 falhou, tentando nível 2:', firstErr);
      }

      // Nível 2: facingMode ideal sem restrição de resolução
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: mode } },
            audio: false
          });
        } catch (secondErr) {
          console.warn('[Camera] Fallback nível 2 falhou, tentando nível 3 genérico:', secondErr);
        }
      }

      // Nível 3: Qualquer câmera de vídeo disponível no aparelho (sem restrições)
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Essencial para iOS Safari
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[Camera] video.play() await falhou, anexando onloadedmetadata:', playErr);
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn('[Camera] Play tardio falhou:', e));
          };
        }
      }

      // Verifica capacidade de Lanterna / Flash (Android Chrome suporta na traseira)
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      }

      setIsInitializing(false);
    } catch (err: any) {
      console.error('[InAppCamera Start Error]:', err);

      // Auto-retry com backoff de 450ms se o sensor estiver temporariamente bloqueado pelo SO
      if (!isRetry && (err.name === 'NotReadableError' || err.name === 'TrackStartError' || err.name === 'AbortError')) {
        console.warn('[Camera] Sensor travado pelo SO. Aguardando 450ms para auto-recuperação...');
        await new Promise(res => setTimeout(res, 450));
        return startCamera(mode, true);
      }

      let msg = 'Não foi possível acessar a câmera do celular.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão da câmera negada. Conceda acesso nas configurações do navegador ou use a câmera nativa do celular.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'A câmera ainda estava ocupada pelo sistema. Toque em "Tentar Novamente" ou use a Câmera do Celular.';
      }
      setCameraError(msg);
      setIsInitializing(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Alterna lanterna
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('[Torch Error]:', err);
      }
    }
  };

  // Alterna entre câmera frontal e traseira
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Captura o frame direto do elemento <video> para um Canvas de baixo consumo de memória
  const takePhoto = () => {
    if (!videoRef.current || isCapturingRef.current) return;

    try {
      isCapturingRef.current = true;
      setIsCapturing(true);

      // Vibração tátil no celular ao disparar a foto (quando suportado)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch (_) {}
      }

      const video = videoRef.current;
      const vWidth = video.videoWidth || 1280;
      const vHeight = video.videoHeight || 720;

      // Escala mantendo proporção com máximo de 1280px (qualidade cirúrgica com míseros 3MB de RAM)
      const MAX_DIM = 1280;
      let targetWidth = vWidth;
      let targetHeight = vHeight;

      if (vWidth > MAX_DIM || vHeight > MAX_DIM) {
        if (vWidth > vHeight) {
          targetHeight = Math.round((vHeight * MAX_DIM) / vWidth);
          targetWidth = MAX_DIM;
        } else {
          targetWidth = Math.round((vWidth * MAX_DIM) / vHeight);
          targetHeight = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        throw new Error('Falha ao obter contexto de renderização da foto');
      }

      // Se for câmera frontal, espelha para ficar natural
      if (facingMode === 'user') {
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // Exporta em JPEG otimizado 0.75
      const base64Photo = canvas.toDataURL('image/jpeg', 0.75);

      // Limpa canvas para liberação imediata de memória
      canvas.width = 1;
      canvas.height = 1;

      // Para a câmera imediatamente
      stopStream();

      // Envia foto capturada para processamento
      onCapture(base64Photo);
    } catch (err) {
      console.error('[Take Photo Error]:', err);
      setCameraError('Erro ao capturar foto. Tente novamente.');
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* 1. TOP BAR */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)'
        }}
      >
        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Fechar câmera"
        >
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              color: 'var(--primary)',
              backgroundColor: 'rgba(240, 90, 34, 0.2)',
              border: '1px solid var(--primary)',
              padding: '4px 10px',
              borderRadius: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Câmera Direta • Sem Quedas
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              style={{
                backgroundColor: torchOn ? 'var(--primary)' : 'rgba(0,0,0,0.6)',
                color: torchOn ? '#FFFFFF' : '#FFD700',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={torchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
            >
              {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Alternar Câmera (Traseira/Frontal)"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* 2. VIEWFINDER / LIVE VIDEO AREA */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          overflow: 'hidden'
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraError ? 'none' : 'block'
          }}
          autoPlay
          playsInline
          muted
        />

        {/* Framing Guide Overlays */}
        {!cameraError && !isInitializing && (
          <div
            style={{
              position: 'absolute',
              inset: '12% 8%',
              border: '1.5px dashed rgba(255, 255, 255, 0.45)',
              borderRadius: '16px',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ alignSelf: 'flex-start', width: '20px', height: '20px', borderTop: '3px solid var(--primary)', borderLeft: '3px solid var(--primary)' }} />
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                padding: '6px 14px',
                borderRadius: '20px',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 600,
                textAlign: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}
            >
              Enquadre a tubulação, caixa ou detalhe do furo
            </div>
            <div style={{ alignSelf: 'flex-end', width: '20px', height: '20px', borderBottom: '3px solid var(--primary)', borderRight: '3px solid var(--primary)' }} />
          </div>
        )}

        {/* Loading Spinner */}
        {isInitializing && (
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: '#FFFFFF'
            }}
          >
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Iniciando câmera segura...</span>
          </div>
        )}

        {/* Flash Effect on Capture */}
        {isCapturing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#FFFFFF',
              opacity: 0.9,
              transition: 'opacity 0.2s ease',
              zIndex: 20
            }}
          />
        )}

        {/* Error Fallback Box */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              margin: '20px',
              maxWidth: '380px',
              backgroundColor: '#111D24',
              border: '1px solid #E74C3C',
              borderRadius: '12px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '14px',
              color: '#FFFFFF',
              zIndex: 15
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: 'rgba(231, 76, 60, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#E74C3C'
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <div>
              <strong style={{ fontSize: '15px', display: 'block', marginBottom: '6px' }}>
                Acesso à Câmera
              </strong>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                {cameraError}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '6px' }}>
              {onFallbackToNativeCamera && (
                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    onClose();
                    onFallbackToNativeCamera();
                  }}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(240, 90, 34, 0.4)'
                  }}
                >
                  <Camera size={18} />
                  <span>Tirar Foto com a Câmera do Celular</span>
                </button>
              )}

              {onSelectFromGallery && (
                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    onClose();
                    onSelectFromGallery();
                  }}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '11px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <ImageIcon size={16} />
                  <span>Escolher Foto da Galeria / Arquivos</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '9px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Tentar Câmera Novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM CONTROL BAR */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '24px 20px 36px 20px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)'
        }}
      >
        {/* Gallery Button */}
        {onSelectFromGallery ? (
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
              onSelectFromGallery();
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Escolher da Galeria"
          >
            <ImageIcon size={22} />
          </button>
        ) : (
          <div style={{ width: '50px' }} />
        )}

        {/* Shutter Button */}
        <button
          type="button"
          disabled={Boolean(cameraError) || isInitializing || isCapturing}
          onClick={takePhoto}
          style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: '4px solid var(--primary)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (cameraError || isInitializing || isCapturing) ? 'not-allowed' : 'pointer',
            opacity: (cameraError || isInitializing) ? 0.4 : 1,
            boxShadow: '0 0 20px rgba(240, 90, 34, 0.5)',
            transform: isCapturing ? 'scale(0.92)' : 'scale(1)',
            transition: 'transform 0.1s ease',
            pointerEvents: (cameraError || isInitializing || isCapturing) ? 'none' : 'auto'
          }}
          title="Tirar Foto"
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Camera size={26} style={{ color: 'var(--primary)' }} />
          </div>
        </button>

        {/* Cancel button */}
        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            width: '50px',
            textAlign: 'center'
          }}
        >
          Voltar
        </button>
      </div>
    </div>,
    document.body
  );
};
