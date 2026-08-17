import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { 
  Maximize2, 
  Minimize2, 
  Search, 
  MapPin as MapPinIcon, 
  ArrowLeft, 
  X,
  Navigation
} from 'lucide-react';
import { Barra } from '../types';

interface MapViewProps {
  barras: Barra[];
  height?: string;
  onSelectPhoto?: (fotoUrl: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  barras,
  height = '520px',
  onSelectPhoto
}) => {
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filtrar apenas registros que possuem GPS válido
  const validPins = barras.filter(b => b.latitude && b.longitude);

  // Invalidate map size on fullscreen toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Inicializar e atualizar o mapa Leaflet
  useEffect(() => {
    if (!mapContainer) return;

    if (!mapRef.current) {
      const defaultCenter: [number, number] = validPins.length > 0 
        ? [validPins[0].latitude!, validPins[0].longitude!]
        : [-23.9608, -46.3336]; // Santos / SP

      mapRef.current = L.map(mapContainer, {
        maxZoom: 22,
        zoomControl: false // Vamos adicionar o zoom control em posição customizada
      }).setView(defaultCenter, 16);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      // OpenStreetMap Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22,
        maxNativeZoom: 19
      }).addTo(mapRef.current);

      markersGroupRef.current = L.featureGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const latLngs: [number, number][] = [];

    // Adicionar marcadores ordenados
    validPins.forEach((b) => {
      const lat = b.latitude!;
      const lng = b.longitude!;
      latLngs.push([lat, lng]);

      const isBox = b.tem_caixa;
      const color = isBox ? '#27AE60' : '#F05A22';
      const label = isBox ? 'CX' : `#${b.numero_barra}`;

      const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: ${color};
            color: #FFFFFF;
            font-weight: 800;
            font-size: 11px;
            font-family: var(--font-sans, sans-serif);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            cursor: pointer;
          ">
            ${label}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(group);

      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 12px; color: #1E293B; min-width: 180px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: ${color}; font-size: 13px;">REGISTRO #${b.numero_barra}</strong>
            <span style="font-size: 10px; font-weight: 700; background: ${isBox ? '#DCFCE7' : '#FEE2E2'}; color: ${isBox ? '#166534' : '#991B1B'}; padding: 2px 6px; border-radius: 4px;">
              ${isBox ? 'COM CAIXA' : 'CANALIZAÇÃO'}
            </span>
          </div>

          ${b.foto_url ? `
            <div style="margin-bottom: 6px; border-radius: 6px; overflow: hidden; height: 110px; background: #000; cursor: pointer;" onclick="window.__openPhotoModal && window.__openPhotoModal('${b.foto_url}')">
              <img src="${b.foto_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto" />
            </div>
          ` : ''}

          <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #64748B;">
            <div><strong>Metros:</strong> ${b.metros}m (Acum: ${b.metros_acumulados}m)</div>
            <div><strong>Data:</strong> ${new Date(b.created_at || Date.now()).toLocaleString('pt-BR')}</div>
            ${b.observacao ? `<div><strong>Obs:</strong> ${b.observacao}</div>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
    });

    // Traçado da Linha de Perfuração
    if (latLngs.length > 1) {
      polylineRef.current = L.polyline(latLngs, {
        color: '#F05A22',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(map);

      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 18 });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 17);
    }
  }, [validPins.length, mapContainer]);

  const handleSearchFocus = (num: number) => {
    const target = validPins.find(b => b.numero_barra === num);
    if (target && mapRef.current) {
      mapRef.current.setView([target.latitude!, target.longitude!], 19);
    }
  };

  const handleFitAll = () => {
    if (mapRef.current && markersGroupRef.current && validPins.length > 0) {
      mapRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [40, 40] });
    }
  };

  // Conteúdo do Mapa
  const mapContent = (
    <div 
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : height,
        zIndex: isFullscreen ? 9999999 : 1,
        backgroundColor: '#0D1C24',
        borderRadius: isFullscreen ? 0 : 'var(--radius-md)',
        border: isFullscreen ? 'none' : '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. TOP CONTROL BAR */}
      <div 
        style={{
          position: 'absolute',
          top: '14px',
          left: '14px',
          right: '14px',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          pointerEvents: 'none'
        }}
      >
        {/* Left Area: Voltar / Fechar se Fullscreen + Busca */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
              }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>
          )}

          {/* Search Pin Input */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: '#0D1C24', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)', 
              border: '1px solid var(--border-color)' 
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="number" 
              placeholder="Buscar registro nº..." 
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val) handleSearchFocus(Number(val));
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '12.5px',
                width: '140px',
                padding: 0,
                color: '#FFFFFF',
                outline: 'none'
              }}
            />
          </div>

          <button
            onClick={handleFitAll}
            title="Enquadrar todos os pontos"
            style={{
              backgroundColor: '#0D1C24',
              border: '1px solid var(--border-color)',
              color: '#FFFFFF',
              padding: '8px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}
          >
            <Navigation size={14} style={{ color: 'var(--primary)' }} />
            <span>Enquadrar</span>
          </button>
        </div>

        {/* Right Area: Legenda e Botão de Alternar Tela Cheia */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              backgroundColor: '#0D1C24', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              fontSize: '11.5px', 
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              color: '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#F05A22' }} />
              <span>Canalização ({barras.filter(b => !b.tem_caixa).length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#27AE60' }} />
              <span>Caixa ({barras.filter(b => b.tem_caixa).length})</span>
            </div>
          </div>

          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              backgroundColor: isFullscreen ? 'rgba(231, 76, 60, 0.2)' : '#0D1C24',
              border: `1px solid ${isFullscreen ? 'var(--danger)' : 'var(--border-color)'}`,
              color: isFullscreen ? 'var(--danger)' : '#FFFFFF',
              padding: '9px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Ver em Tela Cheia'}
          >
            {isFullscreen ? (
              <>
                <X size={15} />
                <span>Fechar</span>
              </>
            ) : (
              <>
                <Maximize2 size={15} />
                <span>Ampliar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. LEAFLET CONTAINER */}
      <div 
        ref={(el) => setMapContainer(el)} 
        style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '100vh' : '350px' }} 
      />

      {/* 3. NO GPS FOOTER */}
      {validPins.length === 0 && (
        <div 
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(13, 28, 36, 0.95)',
            border: '1px solid var(--border-color)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
            boxShadow: '0 4px 18px rgba(0,0,0,0.5)'
          }}
        >
          <MapPinIcon size={15} style={{ color: 'var(--primary)' }} />
          <span>Nenhum registro com GPS capturado ainda. Ao apontar pelo celular, os pontos aparecerão aqui.</span>
        </div>
      )}
    </div>
  );

  return isFullscreen ? createPortal(mapContent, document.body) : mapContent;
};
