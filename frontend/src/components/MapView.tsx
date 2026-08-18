import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { 
  Maximize2, 
  Minimize2, 
  Search, 
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
  height = '480px',
  onSelectPhoto
}) => {
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const lastContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersMapRef = useRef<Map<number, L.Marker>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const onSelectPhotoRef = useRef(onSelectPhoto);

  useEffect(() => {
    onSelectPhotoRef.current = onSelectPhoto;
  }, [onSelectPhoto]);

  // Filtrar apenas registros com GPS válido
  const validPins = barras.filter(b => b.latitude && b.longitude);

  // Invalidate map size on fullscreen toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Inicializar e gerenciar ciclo de vida do Leaflet
  useEffect(() => {
    if (!mapContainer || validPins.length === 0) return;

    // Se o contêiner DOM mudou (ex: alternou tela cheia / portal), destrói o mapa anterior
    if (lastContainerRef.current !== mapContainer) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      lastContainerRef.current = mapContainer;
    }

    // Inicializar mapa se ainda não existir
    if (!mapRef.current) {
      const defaultCenter: [number, number] = [validPins[0].latitude!, validPins[0].longitude!];

      mapRef.current = L.map(mapContainer, {
        maxZoom: 22,
        zoomControl: false
      }).setView(defaultCenter, 16);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      // OpenStreetMap Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22,
        maxNativeZoom: 19
      }).addTo(mapRef.current);

      markersGroupRef.current = L.featureGroup().addTo(mapRef.current);

      // Triggers de clique dentro do popup para abrir foto
      mapRef.current.on('popupopen', (e) => {
        const container = e.popup.getElement();
        if (container) {
          const triggers = container.querySelectorAll('.photo-popup-trigger');
          triggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
              const url = trigger.getAttribute('data-url');
              if (url && onSelectPhotoRef.current) {
                onSelectPhotoRef.current(url);
              }
            });
          });
        }
      });
    } else {
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();
      }
    }

    markersMapRef.current.clear();

    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const latLngs: [number, number][] = [];

    // Plotar pins
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
      markersMapRef.current.set(b.numero_barra, marker);

      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 12px; color: #1E293B; min-width: 180px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: ${color}; font-size: 13px;">REGISTRO #${b.numero_barra}</strong>
            <span style="font-size: 10px; font-weight: 700; background: ${isBox ? '#DCFCE7' : '#FEE2E2'}; color: ${isBox ? '#166534' : '#991B1B'}; padding: 2px 6px; border-radius: 4px;">
              ${isBox ? 'COM CAIXA' : 'CANALIZAÇÃO'}
            </span>
          </div>

          ${b.foto_url ? `
            <div style="margin-bottom: 6px; border-radius: 6px; overflow: hidden; height: 110px; background: #000; cursor: pointer;">
              <img src="${b.foto_url}" class="photo-popup-trigger" data-url="${b.foto_url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Foto" />
            </div>
          ` : ''}

          <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #64748B;">
            <div><strong>Metros:</strong> ${b.metros}m (Acum: ${b.metros_acumulados}m)</div>
            ${b.observacao ? `<div><strong>Obs:</strong> ${b.observacao}</div>` : ''}
            <div><strong>Data:</strong> ${b.horario_registro ? new Date(b.horario_registro).toLocaleString('pt-BR') : '-'}</div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
    });

    // Traçado da rota conectando os pontos
    if (latLngs.length > 1) {
      polylineRef.current = L.polyline(latLngs, {
        color: '#F05A22',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85
      }).addTo(map);
    }

    // Auto-fit inicial
    if (latLngs.length > 0) {
      map.fitBounds(group.getBounds().pad(0.15));
    }
  }, [mapContainer, validPins.length, isFullscreen]);

  // Enquadrar todos os pontos
  const handleFitAll = () => {
    if (mapRef.current && markersGroupRef.current && validPins.length > 0) {
      mapRef.current.fitBounds(markersGroupRef.current.getBounds().pad(0.2));
    }
  };

  // Buscar e focar num registro
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(searchQuery.replace('#', '').trim());
    if (isNaN(num)) return;

    const marker = markersMapRef.current.get(num);
    if (marker && mapRef.current) {
      mapRef.current.setView(marker.getLatLng(), 18, { animate: true });
      marker.openPopup();
    }
  };

  if (validPins.length === 0) {
    return (
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}
      >
        <Navigation size={44} style={{ marginBottom: '12px', color: 'var(--border-color)' }} />
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Nenhum ponto GPS registrado</h3>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>
          Os apontamentos capturados com GPS ativo aparecerão automaticamente traçados no mapa.
        </p>
      </div>
    );
  }

  const mapContent = (
    <div 
      style={isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999999,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0D1C24'
      } : {
        position: 'relative',
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* Barra de Controles Superior */}
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
          gap: '8px',
          flexWrap: 'wrap',
          pointerEvents: 'none'
        }}
      >
        {/* Lado Esquerdo: Botão Voltar (em tela cheia) e Busca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {isFullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
              }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>
          )}

          {/* Form de Busca */}
          <form 
            onSubmit={handleSearch}
            style={{
              backgroundColor: 'rgba(13, 28, 36, 0.95)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Buscar registro nº..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '11.5px',
                width: '120px',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </form>

          {/* Botão Enquadrar */}
          <button
            onClick={handleFitAll}
            style={{
              backgroundColor: 'rgba(13, 28, 36, 0.95)',
              border: '1px solid var(--border-color)',
              color: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Navigation size={13} style={{ color: 'var(--primary)' }} />
            <span>Enquadrar</span>
          </button>
        </div>

        {/* Lado Direito: Legenda e Botão Tela Cheia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {/* Legenda Resumida */}
          <div 
            style={{
              backgroundColor: 'rgba(13, 28, 36, 0.95)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '11px',
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F05A22' }} />
              <span>Canalização ({validPins.filter(p => !p.tem_caixa).length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27AE60' }} />
              <span>Caixa ({validPins.filter(p => p.tem_caixa).length})</span>
            </div>
          </div>

          {/* Botão Ampliar / Minimizar */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              backgroundColor: isFullscreen ? 'rgba(231, 76, 60, 0.2)' : 'rgba(13, 28, 36, 0.95)',
              border: `1px solid ${isFullscreen ? 'var(--danger)' : 'var(--border-color)'}`,
              color: isFullscreen ? 'var(--danger)' : '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} />
                <span>Fechar</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                <span>Ampliar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Container Real do Mapa Leaflet */}
      <div 
        ref={setMapContainer}
        style={{
          width: '100%',
          height: isFullscreen ? '100vh' : height,
          backgroundColor: '#0D1C24'
        }}
      />
    </div>
  );

  return isFullscreen ? createPortal(mapContent, document.body) : mapContent;
};

export default MapView;
