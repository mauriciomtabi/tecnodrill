import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare } from 'lucide-react';

export const PwaInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Verificar se o app já está rodando em modo standalone (já instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const dismissed = sessionStorage.getItem('pwa_dismissed');
    if (dismissed) {
      setIsVisible(false);
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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Resposta do usuário para instalação: ${outcome}`);
      setDeferredPrompt(null);
      setIsVisible(false);
    } else {
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_dismissed', 'true');
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

      {/* Modal Instruções de Instalação Manual (Fallback) */}
      {showInstructions && (
        <div 
          onClick={() => setShowInstructions(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#0D1C24',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Como Instalar o App</h3>
              </div>
              <button 
                onClick={() => setShowInstructions(false)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              
              {/* iPhone / iPad */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <strong style={{ color: 'var(--primary)', minWidth: '60px' }}>iPhone / iPad:</strong>
                <div>
                  Toque no botão <strong>Compartilhar</strong> <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> no Safari e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />.
                </div>
              </div>

              {/* Android */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <strong style={{ color: 'var(--primary)', minWidth: '60px' }}>Android (Chrome):</strong>
                <div>
                  Toque no menu (3 pontinhos) no topo do Chrome e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                </div>
              </div>

              {/* Computador */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <strong style={{ color: 'var(--primary)', minWidth: '60px' }}>Computador (PC/Mac):</strong>
                <div>
                  Clique no ícone de <strong>Instalar</strong> na barra de endereços do Chrome/Edge.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 700, marginTop: '8px' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
