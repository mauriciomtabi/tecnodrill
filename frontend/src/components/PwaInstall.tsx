import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare } from 'lucide-react';

export const PwaInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
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

    // Se não estiver instalado, mostra o banner de instalação
    const dismissed = sessionStorage.getItem('pwa_dismissed');
    if (!dismissed) {
      setIsVisible(true);
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
      <div 
        className="fade-in"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height) + 16px)',
          right: '16px',
          left: 'auto',
          backgroundColor: '#0D1C24',
          color: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1.5px solid var(--primary)',
          maxWidth: '360px',
          boxSizing: 'border-box'
        }}
      >
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
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(240, 90, 34, 0.4)'
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
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Modal de Instruções de Instalação */}
      {showInstructions && (
        <div 
          onClick={() => setShowInstructions(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="fade-in"
            style={{
              backgroundColor: '#0D1C24',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Como Instalar o App
                </h3>
              </div>
              <button onClick={() => setShowInstructions(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>iPhone / iPad:</span>
                <span>Toque no botão <strong>Compartilhar</strong> <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> no Safari e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>Android (Chrome):</span>
                <span>Toque no menu (3 pontinhos) no topo do Chrome e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>Computador (PC/Mac):</span>
                <span>Clique no ícone de <strong>Instalar</strong> na barra de endereços do Chrome/Edge.</span>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '13px', marginTop: '6px' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
