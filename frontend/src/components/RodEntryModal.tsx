import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Barra } from '../types';
import { 
  applyTecnodrillWatermark, 
  reverseGeocode, 
  AddressDetails, 
  decToDMSForWatermark,
  formatFullAddress
} from '../utils/watermark';
import { 
  Camera, 
  Image as ImageIcon, 
  X, 
  ArrowLeft, 
  MapPin, 
  Check, 
  RefreshCw, 
  Plus, 
  Minus, 
  Loader2,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface RodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextBarraNumber: number;
  onSubmit: (barraData: Partial<Barra>) => Promise<any>;
  loading?: boolean;
}

export const RodEntryModal: React.FC<RodEntryModalProps> = ({
  isOpen,
  onClose,
  nextBarraNumber,
  onSubmit,
  loading = false
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentBarraNumber, setCurrentBarraNumber] = useState<number>(nextBarraNumber);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [rawPhotoBase64, setRawPhotoBase64] = useState<string | null>(null);
  const [metros, setMetros] = useState<number>(3);
  const [temCaixa, setTemCaixa] = useState<boolean>(false);
  const [observacao, setObservacao] = useState<string>('');
  
  // GPS State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null);
  const [capturingGps, setCapturingGps] = useState<boolean>(false);
  const [processingWatermark, setProcessingWatermark] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Saved result for Step 4 Success screen
  const [savedSuccessData, setSavedSuccessData] = useState<{
    numero_barra: number;
    metros: number;
    tem_caixa: boolean;
    endereco?: string;
    foto_url?: string;
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const locationPromiseRef = useRef<Promise<{ lat: number | null; lon: number | null; addr: AddressDetails | null }> | null>(null);

  const captureLocation = useCallback((): Promise<{ lat: number | null; lon: number | null; addr: AddressDetails | null }> => {
    if (!('geolocation' in navigator)) {
      return Promise.resolve({ lat: null, lon: null, addr: null });
    }

    setCapturingGps(true);

    const promise = new Promise<{ lat: number | null; lon: number | null; addr: AddressDetails | null }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = Math.round(pos.coords.accuracy);

          setLatitude(lat);
          setLongitude(lon);
          setPrecisao(acc);

          // Reverse geocoding para endereço completo
          const addr = await reverseGeocode(lat, lon);
          if (addr) {
            setAddressDetails(addr);
          }

          setCapturingGps(false);
          resolve({ lat, lon, addr });
        },
        () => {
          setCapturingGps(false);
          resolve({ lat: null, lon: null, addr: null });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    });

    locationPromiseRef.current = promise;
    return promise;
  }, []);

  // Whenever location changes or is recaptured, update watermark on existing raw photo if present
  useEffect(() => {
    if (rawPhotoBase64 && latitude !== null && longitude !== null && addressDetails !== null) {
      applyTecnodrillWatermark(rawPhotoBase64, latitude, longitude, addressDetails, new Date())
        .then((watermarked) => {
          setFotoUrl(watermarked);
        })
        .catch(() => {});
    }
  }, [latitude, longitude, addressDetails, rawPhotoBase64]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentBarraNumber(nextBarraNumber);
      setFotoUrl(null);
      setRawPhotoBase64(null);
      setMetros(3);
      setTemCaixa(false);
      setObservacao('');
      setAddressDetails(null);
      setStatusMessage('');
      setSavedSuccessData(null);
      captureLocation();
    }
  }, [isOpen, nextBarraNumber, captureLocation]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingWatermark(true);
    setStatusMessage('Carregando foto...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      if (!rawBase64) {
        setProcessingWatermark(false);
        setStatusMessage('');
        return;
      }

      setRawPhotoBase64(rawBase64);

      try {
        let curLat = latitude;
        let curLon = longitude;
        let curAddr = addressDetails;

        // Se ainda não temos a localização e o endereço, aguardar o processo de captura
        if (curLat === null || curLon === null || curAddr === null) {
          setStatusMessage('Obtendo endereço e coordenadas GPS de alta precisão...');
          if (locationPromiseRef.current) {
            const locResult = await Promise.race([
              locationPromiseRef.current,
              new Promise<{ lat: null; lon: null; addr: null }>((resolve) => setTimeout(() => resolve({ lat: null, lon: null, addr: null }), 4500))
            ]);
            if (locResult.lat !== null) curLat = locResult.lat;
            if (locResult.lon !== null) curLon = locResult.lon;
            if (locResult.addr !== null) curAddr = locResult.addr;
          } else {
            const locResult = await captureLocation();
            if (locResult.lat !== null) curLat = locResult.lat;
            if (locResult.lon !== null) curLon = locResult.lon;
            if (locResult.addr !== null) curAddr = locResult.addr;
          }
        }

        // Se tivermos coordenadas mas faltar o endereço, tentar geocodificação rápida
        if (curLat !== null && curLon !== null && !curAddr) {
          setStatusMessage('Identificando logradouro e bairro...');
          curAddr = await reverseGeocode(curLat, curLon);
          if (curAddr) {
            setAddressDetails(curAddr);
          }
        }

        setStatusMessage('Aplicando carimbo oficial TecnoDrill...');
        const watermarked = await applyTecnodrillWatermark(
          rawBase64,
          curLat,
          curLon,
          curAddr,
          new Date()
        );

        setFotoUrl(watermarked);
        setStep(2); // Avança para o Passo 2
      } catch (err) {
        console.error('[Watermark Error]:', err);
        setFotoUrl(rawBase64);
        setStep(2);
      } finally {
        setProcessingWatermark(false);
        setStatusMessage('');
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = async () => {
    const formattedAddress = addressDetails ? formatFullAddress(addressDetails) : undefined;
    setSubmitting(true);

    try {
      await onSubmit({
        numero_barra: currentBarraNumber,
        metros: Number(metros) || 3,
        tem_caixa: temCaixa,
        observacao: observacao.trim() || undefined,
        foto_url: fotoUrl || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        endereco: formattedAddress
      });

      // Salva os dados para a Tela de Sucesso
      setSavedSuccessData({
        numero_barra: currentBarraNumber,
        metros: Number(metros) || 3,
        tem_caixa: temCaixa,
        endereco: formattedAddress,
        foto_url: fotoUrl || undefined
      });

      // Avança para a Tela de Sucesso (Passo 4)
      setStep(4);
    } catch (err) {
      console.error('Erro ao enviar apontamento:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNextRod = () => {
    const nextNum = currentBarraNumber + 1;
    setCurrentBarraNumber(nextNum);
    setFotoUrl(null);
    setRawPhotoBase64(null);
    setMetros(3);
    setTemCaixa(false);
    setObservacao('');
    setSavedSuccessData(null);
    setStep(1);
    captureLocation();
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
            PASSO 1: CAPTURA DE FOTO (IDÊNTICO AO APP JLE COM MARCA D'ÁGUA ROBUSTA)
           ========================================================================= */}
        {step === 1 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Registrar Novo Registro #{currentBarraNumber}
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
                padding: '32px 20px',
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
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  border: '2px dashed #2A8ACC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2A8ACC',
                  backgroundColor: 'rgba(42, 138, 204, 0.08)'
                }}
              >
                {processingWatermark ? (
                  <Loader2 size={38} className="animate-spin text-[#F05A22]" />
                ) : (
                  <Camera size={38} />
                )}
              </div>

              <div>
                <strong style={{ fontSize: '16px', color: '#FFFFFF', display: 'block', marginBottom: '6px' }}>
                  {processingWatermark ? 'Processando Carimbo Oficial...' : 'Registrar Nova Estrutura'}
                </strong>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  {statusMessage || 'Tire uma foto da estrutura ou escolha um arquivo da galeria com carimbo de coordenadas e endereço.'}
                </p>
              </div>

              {/* Status Pill Location */}
              <div 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  backgroundColor: latitude ? 'rgba(39, 174, 96, 0.12)' : 'rgba(42, 138, 204, 0.12)',
                  border: `1px solid ${latitude ? 'rgba(39, 174, 96, 0.3)' : 'rgba(42, 138, 204, 0.3)'}`,
                  fontSize: '11px',
                  color: latitude ? 'var(--success)' : '#2A8ACC'
                }}
              >
                {capturingGps ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Obtendo GPS & Endereço...</span>
                  </>
                ) : latitude && addressDetails ? (
                  <>
                    <Check size={12} />
                    <span>GPS & Endereço prontos para o carimbo</span>
                  </>
                ) : (
                  <>
                    <MapPin size={12} />
                    <span>Aguardando geolocalização...</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={processingWatermark}
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
                    cursor: processingWatermark ? 'wait' : 'pointer',
                    boxShadow: '0 4px 14px rgba(240, 90, 34, 0.4)',
                    opacity: processingWatermark ? 0.7 : 1
                  }}
                >
                  <Camera size={18} />
                  <span>{processingWatermark ? 'Processando Carimbo...' : 'Tirar Foto (Câmera)'}</span>
                </button>

                <button
                  type="button"
                  disabled={processingWatermark}
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
                    cursor: processingWatermark ? 'wait' : 'pointer',
                    opacity: processingWatermark ? 0.7 : 1
                  }}
                >
                  <ImageIcon size={18} />
                  <span>{processingWatermark ? 'Processando...' : 'Escolher da Galeria'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
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
                  CARIMBADO
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => setMetros(prev => Math.max(1, (Number(prev) || 3) - 3))}
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
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Minus size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={metros}
                    onChange={(e) => setMetros(e.target.value === '' ? '' as any : Number(e.target.value))}
                    style={{
                      fontSize: '28px',
                      fontWeight: 800,
                      color: 'var(--primary)',
                      fontFamily: 'var(--font-mono)',
                      width: '100px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-app)',
                      border: '1.5px solid var(--primary)',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    m
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setMetros(prev => (Number(prev) || 0) + 3)}
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
                    cursor: 'pointer',
                    flexShrink: 0
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
            PASSO 3: CONFIRMAÇÃO, LOCALIZAÇÃO, OBSERVAÇÃO E ENVIO (COM ENDEREÇO COMPLETO)
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

            {/* Big Photo Preview with Watermark Stamp */}
            <div 
              style={{
                position: 'relative',
                width: '100%',
                height: '190px',
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
                REGISTRO #{currentBarraNumber} (+{metros}m)
              </div>
            </div>

            {/* Card Localização Capturada com Endereço Completo */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} style={{ color: 'var(--primary)' }} />
                  <strong style={{ fontSize: '12px', color: 'var(--success)' }}>
                    Localização & Endereço Capturados
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {/* DMS Coordinates */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {latitude && longitude 
                      ? `${decToDMSForWatermark(latitude, true)} ${decToDMSForWatermark(longitude, false)} · prec: ${precisao || 10}m` 
                      : 'GPS obtido pelo dispositivo'}
                  </span>
                </div>

                {/* Full Address Display */}
                {addressDetails && (
                  <div style={{ paddingLeft: '19px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '12px' }}>
                      {addressDetails.road}{addressDetails.houseNumber ? `, ${addressDetails.houseNumber}` : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {[addressDetails.neighbourhood, addressDetails.city, addressDetails.state].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
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
              disabled={submitting || loading}
              onClick={handleFinalSubmit}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                cursor: (submitting || loading) ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (submitting || loading) ? 0.8 : 1
              }}
            >
              {submitting || loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Salvando Registro #{currentBarraNumber}...</span>
                </>
              ) : (
                <span>Salvar Registro #{currentBarraNumber}</span>
              )}
            </button>

          </div>
        )}

        {/* =========================================================================
            PASSO 4: TELA DE REGISTRO CONCLUÍDO COM SUCESSO (FEEDBACK INSTANTÂNEO)
           ========================================================================= */}
        {step === 4 && savedSuccessData && (
          <div 
            className="fade-in"
            style={{ 
              padding: '28px 24px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center', 
              gap: '20px',
              overflowY: 'auto'
            }}
          >
            {/* Animated Glowing Success Icon */}
            <div 
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                backgroundColor: 'rgba(39, 174, 96, 0.15)',
                border: '2px solid var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
                boxShadow: '0 0 24px rgba(39, 174, 96, 0.35)',
                marginTop: '8px'
              }}
            >
              <CheckCircle2 size={44} />
            </div>

            {/* Success Heading */}
            <div>
              <span 
                style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--success)',
                  backgroundColor: 'rgba(39, 174, 96, 0.12)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  marginBottom: '8px'
                }}
              >
                APONTAMENTO SALVO
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px 0' }}>
                Registro #{savedSuccessData.numero_barra} Concluído!
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                Foto oficial carimbada e geolocalização registradas com sucesso.
              </p>
            </div>

            {/* Summary Details Card */}
            <div 
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textAlign: 'left',
                boxSizing: 'border-box'
              }}
            >
              {/* Photo & Badge Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {savedSuccessData.foto_url && (
                  <div style={{ width: '64px', height: '54px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000', flexShrink: 0 }}>
                    <img src={savedSuccessData.foto_url} alt="Foto Carimbada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    ESTRUTURA APONTADA:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                      +{savedSuccessData.metros}m
                    </span>
                    <span 
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: savedSuccessData.tem_caixa ? 'rgba(39, 174, 96, 0.18)' : 'rgba(240, 90, 34, 0.18)',
                        color: savedSuccessData.tem_caixa ? 'var(--success)' : 'var(--primary)'
                      }}
                    >
                      {savedSuccessData.tem_caixa ? 'COM CAIXA' : 'CANALIZAÇÃO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Row */}
              {savedSuccessData.endereco && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--text-main)', fontWeight: 600, lineHeight: '1.3' }}>
                    {savedSuccessData.endereco}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleStartNextRod}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
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
                <Plus size={18} />
                <span>Apontar Próximo Registro (#{currentBarraNumber + 1})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Layers size={16} />
                <span>Ver Lista de Registros da Obra</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
