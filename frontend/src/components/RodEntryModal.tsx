import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Barra, Servico } from '../types';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { 
  applyTecnodrillWatermark, 
  reverseGeocode, 
  AddressDetails, 
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
  Box,
  Wrench,
  Trash2,
  ArrowRight,
  Edit3
} from 'lucide-react';

interface RodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextBarraNumber: number;
  servico?: Servico | null;
  onSubmit: (barraData: Partial<Barra>) => Promise<any>;
  loading?: boolean;
}

const COMMON_DIAMETERS = ['63mm', '90mm', '110mm', '160mm', '200mm'];

export const RodEntryModal: React.FC<RodEntryModalProps> = ({
  isOpen,
  onClose,
  nextBarraNumber,
  servico = null,
  onSubmit,
  loading = false
}) => {
  // Trata botão nativo de voltar do celular
  useModalBackButton(isOpen, onClose, 'rodEntry');

  // Step 0: Escolha Tipo (Canalização vs Caixa)
  // Step 1: Captura de Fotos (mínimo obrigatório + adicionais)
  // Step 2: Dados Técnicos (Canalização: diâmetro, metros, caixa, OS se saneamento)
  // Step 3: Confirmação Geral
  // Step 4: Tela de Sucesso
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [currentBarraNumber, setCurrentBarraNumber] = useState<number>(nextBarraNumber);
  const [tipoRegistro, setTipoRegistro] = useState<'CANALIZACAO' | 'CAIXA'>('CANALIZACAO');

  // Fotos
  const [fotosList, setFotosList] = useState<string[]>([]);
  const [rawPhotoBase64, setRawPhotoBase64] = useState<string | null>(null);

  // Dados Técnicos
  const [diametro, setDiametro] = useState<string>('110mm');
  const [customDiametro, setCustomDiametro] = useState<string>('');
  const [numeroOs, setNumeroOs] = useState<string>('');
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

  // Raw photos list for re-watermarking when address is edited
  const [rawPhotosList, setRawPhotosList] = useState<string[]>([]);
  const [showAddressEditModal, setShowAddressEditModal] = useState<boolean>(false);
  const [editRua, setEditRua] = useState<string>('');
  const [editNumero, setEditNumero] = useState<string>('');
  const [editBairro, setEditBairro] = useState<string>('');
  const [editCidade, setEditCidade] = useState<string>('');
  const [editUf, setEditUf] = useState<string>('');

  // Saved result for Step 4 Success screen
  const [savedSuccessData, setSavedSuccessData] = useState<{
    numero_barra: number;
    tipo_registro: 'CANALIZACAO' | 'CAIXA';
    metros: number;
    diametro?: string;
    numero_os?: string;
    tem_caixa: boolean;
    endereco?: string;
    fotos: string[];
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const locationPromiseRef = useRef<Promise<{ lat: number | null; lon: number | null; addr: AddressDetails | null }> | null>(null);

  const minFotos = servico?.min_fotos_registro ? Math.max(1, servico.min_fotos_registro) : 2;
  const isSaneamento = servico?.tipo_servico === 'SANEAMENTO';

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
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });

    locationPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setCurrentBarraNumber(nextBarraNumber);
      setTipoRegistro('CANALIZACAO');
      setFotosList([]);
      setRawPhotosList([]);
      setRawPhotoBase64(null);
      setDiametro('110mm');
      setCustomDiametro('');
      setNumeroOs('');
      setMetros(3);
      setTemCaixa(false);
      setObservacao('');
      setAddressDetails(null);
      setStatusMessage('');
      setSavedSuccessData(null);
      setShowAddressEditModal(false);
      captureLocation();
    }
  }, [isOpen, nextBarraNumber, captureLocation]);

  if (!isOpen) return null;

  const handleOpenAddressEdit = () => {
    setEditRua(addressDetails?.road || '');
    setEditNumero(addressDetails?.houseNumber || '');
    setEditBairro(addressDetails?.neighbourhood || '');
    setEditCidade(addressDetails?.city || servico?.cidade || 'Novo Hamburgo');
    setEditUf(addressDetails?.state || servico?.uf || 'RS');
    setShowAddressEditModal(true);
  };

  const handleSaveEditedAddress = async () => {
    const updated: AddressDetails = {
      road: editRua.trim(),
      houseNumber: editNumero.trim(),
      neighbourhood: editBairro.trim(),
      city: editCidade.trim() || 'Novo Hamburgo',
      state: editUf.trim().toUpperCase() || 'RS'
    };
    updated.formattedAddress = formatFullAddress(updated);
    setAddressDetails(updated);
    setShowAddressEditModal(false);

    if (rawPhotosList.length > 0) {
      setProcessingWatermark(true);
      setStatusMessage('Atualizando carimbo das fotos com o novo endereço...');
      try {
        const rewatermarked = await Promise.all(
          rawPhotosList.map(raw => applyTecnodrillWatermark(
            raw,
            latitude,
            longitude,
            updated,
            new Date(),
            servico?.logo_cliente || null
          ))
        );
        setFotosList(rewatermarked);
      } catch (err) {
        console.error('[Watermark Update Error]:', err);
      } finally {
        setProcessingWatermark(false);
        setStatusMessage('');
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same photo can be reselected if needed
    e.target.value = '';

    setProcessingWatermark(true);
    setStatusMessage('Carregando foto e aplicando carimbo oficial...');

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

        if (curLat === null || curLon === null || curAddr === null) {
          setStatusMessage('Obtendo coordenadas GPS de alta precisão...');
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

        if (curLat !== null && curLon !== null && !curAddr) {
          setStatusMessage('Identificando endereço oficial...');
          curAddr = await reverseGeocode(curLat, curLon);
          if (curAddr) {
            setAddressDetails(curAddr);
          }
        }

        setStatusMessage('Estampando carimbo oficial...');
        const watermarked = await applyTecnodrillWatermark(
          rawBase64,
          curLat,
          curLon,
          curAddr,
          new Date(),
          servico?.logo_cliente || null
        );

        setFotosList(prev => [...prev, watermarked]);
        setRawPhotosList(prev => [...prev, rawBase64]);
      } catch (err) {
        console.error('[Watermark Error]:', err);
        setFotosList(prev => [...prev, rawBase64]);
        setRawPhotosList(prev => [...prev, rawBase64]);
      } finally {
        setProcessingWatermark(false);
        setStatusMessage('');
      }
    };

    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index: number) => {
    setFotosList(prev => prev.filter((_, i) => i !== index));
    setRawPhotosList(prev => prev.filter((_, i) => i !== index));
  };

  const getEffectiveDiametro = () => {
    if (diametro === 'OUTRO') return customDiametro.trim() || 'Customizado';
    return diametro;
  };

  const handleSaveCaixaDireto = async () => {
    if (fotosList.length < minFotos) return;
    if (isSaneamento && !numeroOs.trim()) return;

    const formattedAddress = addressDetails ? formatFullAddress(addressDetails) : undefined;
    setSubmitting(true);

    try {
      const payload: Partial<Barra> = {
        numero_barra: currentBarraNumber,
        tipo_registro: 'CAIXA',
        metros: 0,
        tem_caixa: true,
        tipo_caixa: 'Caixa de Passagem',
        numero_os: numeroOs.trim() || undefined,
        observacao: observacao.trim() || undefined,
        foto_url: fotosList[0] || undefined,
        fotos: fotosList,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        endereco: formattedAddress
      };

      await onSubmit(payload);

      setSavedSuccessData({
        numero_barra: currentBarraNumber,
        tipo_registro: 'CAIXA',
        metros: 0,
        numero_os: numeroOs.trim() || undefined,
        tem_caixa: true,
        endereco: formattedAddress,
        fotos: fotosList
      });

      setStep(4);
    } catch (err) {
      console.error('Erro ao enviar instalação de caixa:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    const formattedAddress = addressDetails ? formatFullAddress(addressDetails) : undefined;
    const finalDiametro = getEffectiveDiametro();
    setSubmitting(true);

    try {
      const payload: Partial<Barra> = {
        numero_barra: currentBarraNumber,
        tipo_registro: 'CANALIZACAO',
        metros: Number(metros) || 3,
        diametro: finalDiametro,
        numero_os: isSaneamento ? (numeroOs.trim() || undefined) : undefined,
        tem_caixa: temCaixa,
        tipo_caixa: temCaixa ? 'Caixa de Passagem' : undefined,
        observacao: observacao.trim() || undefined,
        foto_url: fotosList[0] || undefined,
        fotos: fotosList,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        endereco: formattedAddress
      };

      await onSubmit(payload);

      setSavedSuccessData({
        numero_barra: currentBarraNumber,
        tipo_registro: 'CANALIZACAO',
        metros: Number(metros) || 3,
        diametro: finalDiametro,
        numero_os: isSaneamento ? (numeroOs.trim() || undefined) : undefined,
        tem_caixa: temCaixa,
        endereco: formattedAddress,
        fotos: fotosList
      });

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
    setTipoRegistro('CANALIZACAO');
    setFotosList([]);
    setRawPhotoBase64(null);
    setMetros(3);
    setTemCaixa(false);
    setObservacao('');
    setSavedSuccessData(null);
    setStep(0);
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
            PASSO 0: ESCOLHA DO TIPO (CANALIZAÇÃO VS INSTALAÇÃO DE CAIXA)
           ========================================================================= */}
        {step === 0 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Registro #{currentBarraNumber}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0 0 0' }}>
                  Selecione o Tipo de Atividade
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{ color: 'var(--danger)', padding: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              Escolha a estrutura que está sendo executada no campo antes de tirar as fotos:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Opção 1: Canalização */}
              <div
                onClick={() => {
                  setTipoRegistro('CANALIZACAO');
                  setStep(1);
                }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(240, 90, 34, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                }}
              >
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
                  <Wrench size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '15px', color: '#FFFFFF', display: 'block', marginBottom: '4px' }}>
                    Canalização
                  </strong>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.3', display: 'block' }}>
                    Perfuração/passagem de tubulação. Exige fotos, diâmetro e metragem.
                  </span>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--primary-light)' }} />
              </div>

              {/* Opção 2: Instalação de Caixa */}
              <div
                onClick={() => {
                  setTipoRegistro('CAIXA');
                  setTemCaixa(true);
                  setMetros(0);
                  setStep(1);
                }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--success)';
                  e.currentTarget.style.backgroundColor = 'rgba(39, 174, 96, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                }}
              >
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)' }}>
                  <Box size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '15px', color: '#FFFFFF', display: 'block', marginBottom: '4px' }}>
                    Instalação de Caixa
                  </strong>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.3', display: 'block' }}>
                    Registro ágil de caixa de passagem. Apenas fotos e confirmação imediata.
                  </span>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--success)' }} />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PASSO 1: CAPTURA DE FOTOS COM VALIDAÇÃO DE MÍNIMO
           ========================================================================= */}
        {step === 1 && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setStep(0)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
              >
                <ArrowLeft size={16} />
                <span>Alterar Tipo</span>
              </button>

              <span style={{ 
                fontSize: '11px', 
                fontWeight: 800, 
                padding: '3px 8px', 
                borderRadius: '4px',
                backgroundColor: tipoRegistro === 'CAIXA' ? 'rgba(39, 174, 96, 0.15)' : 'rgba(240, 90, 34, 0.15)',
                color: tipoRegistro === 'CAIXA' ? 'var(--success)' : 'var(--primary)'
              }}>
                {tipoRegistro === 'CAIXA' ? '📦 INSTALAÇÃO DE CAIXA' : '🛠️ CANALIZAÇÃO'}
              </span>

              <button
                onClick={onClose}
                style={{ color: 'var(--danger)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Pill & Requirement Counter */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
                  Fotos Obrigatórias do Registro:
                </span>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 800, 
                  color: fotosList.length >= minFotos ? 'var(--success)' : '#F1C40F' 
                }}>
                  {fotosList.length} de {minFotos} {fotosList.length >= minFotos ? '✓ Mínimo atingido' : 'mínimas'}
                </span>
              </div>

              {/* Progress bar of photos */}
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{
                    width: `${Math.min(100, (fotosList.length / minFotos) * 100)}%`,
                    height: '100%',
                    backgroundColor: fotosList.length >= minFotos ? 'var(--success)' : '#F1C40F',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              {/* GPS Status & Endereço */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: latitude ? 'var(--success)' : '#2A8ACC' }}>
                    {capturingGps ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Obtendo localização GPS...</span>
                      </>
                    ) : latitude && addressDetails ? (
                      <>
                        <Check size={12} />
                        <span>GPS e Endereço prontos para o carimbo</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={12} />
                        <span>GPS ativo</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddressEdit}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--primary-light)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={10} />
                    <span>Ajustar Endereço</span>
                  </button>
                </div>
                {addressDetails && (
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                    📍 {formatFullAddress(addressDetails)}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails of Captured Photos */}
            {fotosList.length > 0 && (
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Fotos Capturadas ({fotosList.length}):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                  {fotosList.map((photo, idx) => (
                    <div 
                      key={idx}
                      style={{
                        position: 'relative',
                        height: '75px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#000'
                      }}
                    >
                      <img src={photo} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '3px' }}>
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: 3,
                          right: 3,
                          backgroundColor: 'rgba(231, 76, 60, 0.85)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '3px',
                          cursor: 'pointer'
                        }}
                        title="Remover foto"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo Capture Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                disabled={processingWatermark}
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: processingWatermark ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(240, 90, 34, 0.35)'
                }}
              >
                {processingWatermark ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processando carimbo...</span>
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    <span>{fotosList.length === 0 ? 'Tirar Foto (Câmera)' : '+ Tirar Outra Foto'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={processingWatermark}
                onClick={() => galleryInputRef.current?.click()}
                style={{
                  backgroundColor: 'rgba(42, 138, 204, 0.15)',
                  color: '#2A8ACC',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(42, 138, 204, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: processingWatermark ? 'wait' : 'pointer'
                }}
              >
                <ImageIcon size={16} />
                <span>Escolher da Galeria</span>
              </button>
            </div>

            {/* Fluxo Especial para INSTALAÇÃO DE CAIXA: só tira fotos e salva */}
            {tipoRegistro === 'CAIXA' && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isSaneamento && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                      NÚMERO DA OS (SANEAMENTO) *
                    </label>
                    <input
                      type="text"
                      value={numeroOs}
                      onChange={(e) => setNumeroOs(e.target.value)}
                      placeholder="ex: OS-2026-9821"
                      required
                      style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '9px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    OBSERVAÇÃO DA CAIXA (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="ex: Caixa de concreto 60x60 na calçada"
                    style={{ fontSize: '12.5px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="button"
                  disabled={fotosList.length < minFotos || (isSaneamento && !numeroOs.trim()) || submitting}
                  onClick={handleSaveCaixaDireto}
                  style={{
                    backgroundColor: (fotosList.length >= minFotos && (!isSaneamento || numeroOs.trim())) ? 'var(--success)' : 'rgba(255, 255, 255, 0.1)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    padding: '13px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: (fotosList.length >= minFotos && (!isSaneamento || numeroOs.trim())) ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: fotosList.length >= minFotos ? '0 4px 14px rgba(39, 174, 96, 0.4)' : 'none'
                  }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>
                    {fotosList.length < minFotos 
                      ? `Faltam ${minFotos - fotosList.length} foto(s) para salvar`
                      : 'Salvar Instalação de Caixa'}
                  </span>
                </button>
              </div>
            )}

            {/* Fluxo Normal para CANALIZAÇÃO: avança para dados técnicos */}
            {tipoRegistro === 'CANALIZACAO' && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button
                  type="button"
                  disabled={fotosList.length < minFotos}
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%',
                    backgroundColor: fotosList.length >= minFotos ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    padding: '13px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: fotosList.length >= minFotos ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: fotosList.length >= minFotos ? '0 4px 14px rgba(240, 90, 34, 0.4)' : 'none'
                  }}
                >
                  <span>
                    {fotosList.length < minFotos 
                      ? `Tire mais ${minFotos - fotosList.length} foto(s) para avançar` 
                      : 'Avançar para Dados Técnicos'}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

          </div>
        )}

        {/* =========================================================================
            PASSO 2: DADOS TÉCNICOS DA CANALIZAÇÃO (DIÂMETRO, OS, METROS, CAIXA)
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
                DADOS TÉCNICOS DA CANALIZAÇÃO
              </span>
            </div>

            {/* CAMPO DIÂMETRO (OBRIGATÓRIO) */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Diâmetro da Tubulação *
              </label>

              {/* Quick Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {COMMON_DIAMETERS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDiametro(d);
                      setCustomDiametro('');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${diametro === d ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: diametro === d ? 'var(--primary)' : 'var(--bg-app)',
                      color: diametro === d ? '#FFFFFF' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDiametro('OUTRO')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: `1px solid ${diametro === 'OUTRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: diametro === 'OUTRO' ? 'var(--primary)' : 'var(--bg-app)',
                    color: diametro === 'OUTRO' ? '#FFFFFF' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Outro
                </button>
              </div>

              {diametro === 'OUTRO' && (
                <input
                  type="text"
                  value={customDiametro}
                  onChange={(e) => setCustomDiametro(e.target.value)}
                  placeholder="Digite o diâmetro (ex: 250mm, 2 pol)"
                  required
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '9px', width: '100%', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* CAMPO NÚMERO DA OS (CASO SANEAMENTO) */}
            {isSaneamento && (
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(42, 138, 204, 0.4)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#2A8ACC', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Número da OS (Saneamento) *
                </label>
                <input
                  type="text"
                  value={numeroOs}
                  onChange={(e) => setNumeroOs(e.target.value)}
                  placeholder="ex: OS-2026-9821"
                  required
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '9px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Metragem Apontada */}
            <div 
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Metragem Apontada (Metros)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <button
                  type="button"
                  onClick={() => setMetros(prev => Math.max(0.1, Number((prev - 1).toFixed(2))))}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Minus size={18} />
                </button>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '2px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.1"
                    value={metros === 0 ? '' : metros}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMetros(isNaN(val) ? 0 : val);
                    }}
                    style={{
                      fontSize: '30px',
                      fontWeight: 900,
                      color: 'var(--primary)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'center',
                      width: '75px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      padding: 0
                    }}
                  />
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    m
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setMetros(prev => Number((prev + 1).toFixed(2)))}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Botões Rápidos */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 3, 6, 9].map(mVal => (
                  <button
                    key={mVal}
                    type="button"
                    onClick={() => setMetros(mVal)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: metros === mVal ? 'var(--primary)' : 'var(--bg-app)',
                      color: metros === mVal ? '#FFFFFF' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    +{mVal}m
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Digite o valor ou utilize os botões +/-
              </span>
            </div>

            {/* Observação */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                OBSERVAÇÃO TÉCNICA (OPCIONAL)
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: Travessia sob calçada, solo arenoso..."
                style={{ fontSize: '12.5px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '9px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Avançar para Confirmação */}
            <button
              type="button"
              disabled={isSaneamento && !numeroOs.trim()}
              onClick={() => setStep(3)}
              style={{
                backgroundColor: (isSaneamento && !numeroOs.trim()) ? 'rgba(255, 255, 255, 0.1)' : 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13.5px',
                padding: '13px',
                borderRadius: '8px',
                border: 'none',
                cursor: (isSaneamento && !numeroOs.trim()) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)'
              }}
            >
              Avançar para Confirmação
            </button>
          </div>
        )}

        {/* =========================================================================
            PASSO 3: CONFIRMAÇÃO E ENVIO
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
                CONFIRMAÇÃO DO REGISTRO
              </span>
            </div>

            {/* Photo Preview Carousel/Thumbnails */}
            {fotosList.length > 0 && (
              <div style={{ position: 'relative', width: '100%', height: '170px', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#000', border: '1px solid var(--border-color)' }}>
                <img src={fotosList[0]} alt="Principal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', color: '#fff', fontWeight: 700 }}>
                  {fotosList.length} foto(s) carimbada(s)
                </div>
              </div>
            )}

            {/* Summary Details */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Atividade:</span>
                <strong style={{ color: '#FFFFFF' }}>{tipoRegistro === 'CAIXA' ? 'Instalação de Caixa' : 'Canalização'}</strong>
              </div>

              {tipoRegistro === 'CANALIZACAO' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Diâmetro:</span>
                    <strong style={{ color: 'var(--primary)' }}>{getEffectiveDiametro()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Metros Apontados:</span>
                    <strong style={{ color: '#FFFFFF' }}>+{metros} metros</strong>
                  </div>
                </>
              )}

              {isSaneamento && numeroOs && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ordem de Serviço (OS):</span>
                  <strong style={{ color: '#2A8ACC' }}>{numeroOs}</strong>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.3' }}>
                    {addressDetails ? formatFullAddress(addressDetails) : 'Endereço não disponível / Sem GPS'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddressEdit}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-light)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Ajustar
                </button>
              </div>
            </div>

            {/* Confirm and Submit Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '14px',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                cursor: submitting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Transmitindo Registro...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Confirmar e Transmitir Registro</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* =========================================================================
            PASSO 4: TELA DE SUCESSO
           ========================================================================= */}
        {step === 4 && savedSuccessData && (
          <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(39, 174, 96, 0.15)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', display: 'inline-block', padding: '3px 8px', backgroundColor: 'rgba(39, 174, 96, 0.15)', borderRadius: '12px', marginBottom: '8px' }}>
                APONTAMENTO SALVO COM SUCESSO
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px 0' }}>
                Registro #{savedSuccessData.numero_barra} Concluído!
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                Fotos oficiais carimbadas e geolocalização salvas com sucesso.
              </p>
            </div>

            <div style={{ width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tipo:</span>
                <strong style={{ color: '#FFFFFF' }}>{savedSuccessData.tipo_registro === 'CAIXA' ? 'Instalação de Caixa' : 'Canalização'}</strong>
              </div>

              {savedSuccessData.diametro && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Diâmetro:</span>
                  <strong style={{ color: 'var(--primary)' }}>{savedSuccessData.diametro}</strong>
                </div>
              )}

              {savedSuccessData.numero_os && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ordem de Serviço (OS):</span>
                  <strong style={{ color: '#2A8ACC' }}>{savedSuccessData.numero_os}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Metros:</span>
                <strong style={{ color: '#FFFFFF' }}>+{savedSuccessData.metros}m</strong>
              </div>

              {savedSuccessData.endereco && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <MapPin size={12} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{savedSuccessData.endereco}</span>
                </div>
              )}
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleStartNextRod}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  padding: '13px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(240, 90, 34, 0.45)'
                }}
              >
                <Plus size={16} />
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
                  padding: '11px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                Concluir e Voltar ao Serviço
              </button>
            </div>
          </div>
        )}

        {/* MODAL / OVERLAY PARA AJUSTAR ENDEREÇO MANUALMENTE */}
        {showAddressEditModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '380px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '14px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} style={{ color: 'var(--primary)' }} />
                  Ajustar Endereço do Carimbo
                </strong>
                <button
                  type="button"
                  onClick={() => setShowAddressEditModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Corrija o endereço para que a marca d'água oficial seja carimbada com a localidade correta.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Rua / Logradouro
                </label>
                <input
                  type="text"
                  value={editRua}
                  onChange={(e) => setEditRua(e.target.value)}
                  placeholder="ex: Rua Bento Gonçalves"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: '#FFFFFF', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Número
                  </label>
                  <input
                    type="text"
                    value={editNumero}
                    onChange={(e) => setEditNumero(e.target.value)}
                    placeholder="ex: 1500 ou S/N"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: '#FFFFFF', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={editBairro}
                    onChange={(e) => setEditBairro(e.target.value)}
                    placeholder="ex: Centro / Ideal"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: '#FFFFFF', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={editCidade}
                    onChange={(e) => setEditCidade(e.target.value)}
                    placeholder="ex: Novo Hamburgo"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: '#FFFFFF', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editUf}
                    onChange={(e) => setEditUf(e.target.value.toUpperCase())}
                    placeholder="RS"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: '#FFFFFF', fontSize: '12px', boxSizing: 'border-box', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddressEditModal(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedAddress}
                  style={{
                    flex: 2,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Salvar Endereço
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
