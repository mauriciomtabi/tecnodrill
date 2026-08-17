import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, Search, Box, MapPin as MapPinIcon, Camera, Eye } from 'lucide-react';
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filtrar apenas registros que possuem GPS válido
  const validPins = barras.filter(b => b.latitude && b.longitude);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Inicializar mapa se ainda não existir
    if (!mapRef.current) {
      const defaultCenter: [number, number] = validPins.length > 0 
        ? [validPins[0].latitude!, validPins[0].longitude!]
        : [-23.9608, -46.3336]; // Santos / SP padrão

      mapRef.current = L.map(mapContainerRef.current, {
        maxZoom: 22,
        zoomControl: true
      }).setView(defaultCenter, 16);

      // Camada OpenStreetMap
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

      // Custom HTML Marker Icon
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
            font-family: var(--font-sans);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            ${label}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(group);

      // Popup Content
      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 12px; color: #1E293B; min-width: 180px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: ${color}; font-size: 13px;">REGISTRO #${b.numero_barra}</strong>
            <span style="font-size: 10px; font-weight: 700; background: ${isBox ? '#DCFCE7' : '#FEE2E2'}; color: ${isBox ? '#166534' : '#991B1B'}; padding: 2px 6px; border-radius: 4px;">
              ${isBox ? 'COM CAIXA' : 'CANALIZAÇÃO'}
            </span>
          </div>

          ${b.foto_url ? `
            <div style="margin-bottom: 6px; border-radius: 6px; overflow: hidden; height: 100px; background: #000; cursor: pointer;">
              <img src="${b.foto_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto" />
            </div>
          ` : ''}

          <div style="font-size: 11.5px; margin-bottom: 2px;">
            <strong>Metragem:</strong> +${b.metros || 3}m (Total: ${b.metros_acumulados || 0}m)
          </div>

          ${b.observacao ? `
            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
              <em>"${b.observacao}"</em>
            </div>
          ` : ''}

          <div style="font-size: 9.5px; color: #94A3B8; margin-top: 6px;">
            ${b.horario_registro ? new Date(b.horario_registro).toLocaleString('pt-BR') : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
    });

    // Traçado da Linha de Canalização / Perfuração
    if (latLngs.length > 1) {
      polylineRef.current = L.polyline(latLngs, {
        color: '#F05A22',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(map);
    }

    // Ajustar zoom para enquadrar todos os pontos
    if (validPins.length > 0) {
      const bounds = group.getBounds();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }

    // Disparar resize do leaflet
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [barras, isFullscreen]);

  const handleSearchFocus = (num: number) => {
    const target = validPins.find(b => b.numero_barra === num);
    if (target && mapRef.current) {
      mapRef.current.setView([target.latitude!, target.longitude!], 19);
    }
  };

  return (
    <div 
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : height,
        zIndex: isFullscreen ? 99999 : 1,
        backgroundColor: 'var(--bg-card)',
        borderRadius: isFullscreen ? 0 : 'var(--radius-md)',
        border: isFullscreen ? 'none' : '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Map Control Bar */}
      <div 
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        {/* Search Pin Input */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="number" 
            placeholder="Ir para registro nº..." 
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val) handleSearchFocus(Number(val));
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '12px',
              width: '140px',
              padding: 0,
              color: 'var(--text-main)'
            }}
          />
        </div>

        {/* Legend & Fullscreen Button */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Legenda rápida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '11px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
              <span>Canalização ({barras.filter(b => !b.tem_caixa).length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
              <span>Caixa ({barras.filter(b => b.tem_caixa).length})</span>
            </div>
          </div>

          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Ver em Tela Cheia'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Leaflet Container */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', minHeight: '350px' }} 
      />

      {/* No GPS Warning Footer */}
      {validPins.length === 0 && (
        <div 
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '11.5px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none'
          }}
        >
          <MapPinIcon size={14} style={{ color: 'var(--primary)' }} />
          <span>Nenhum registro com GPS capturado ainda. Ao apontar no celular, o GPS será marcado automaticamente.</span>
        </div>
      )}
    </div>
  );
};
