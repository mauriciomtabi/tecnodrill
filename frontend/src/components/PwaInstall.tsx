import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PwaInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      console.log('TecnoDrill INFRA foi instalado com sucesso!');
      setDeferredPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Resposta do usuário para instalação: ${outcome}`);
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        .pwa-banner-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: #0D1C24;
          border: 1.5px solid var(--primary);
          border-radius: 12px;
          padding: 12px 16px;
          color: #FFFFFF;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
          box-sizing: border-box;
        }

        @media (max-width: 1023px) {
          .pwa-banner-container {
            bottom: calc(var(--bottom-nav-height) + 12px) !important;
            left: 12px !important;
            right: 12px !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="pwa-banner-container fade-in">
        <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)', flexShrink: 0 }}>
          <Download size={20} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>Instalar App</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleInstallClick}
            style={{
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 16px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(240, 90, 34, 0.4)',
              border: 'none'
            }}
          >
            Instalar
          </button>
          
          <button
            onClick={handleDismiss}
            style={{
              color: 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  );
};
