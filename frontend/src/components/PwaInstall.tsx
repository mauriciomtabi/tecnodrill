import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PwaInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificar se o app já está rodando em modo standalone (já instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir prompt automático antigo
      e.preventDefault();
      // Armazenar o evento para acionar no clique do botão
      setDeferredPrompt(e);
      // Mostrar botão de instalação
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
    if (!deferredPrompt) {
      // Fallback para iOS / navegadores sem beforeinstallprompt nativo
      alert('Para instalar no iPhone / iPad, toque no botão Compartilhar do Safari e selecione "Adicionar à Tela de Início".');
      return;
    }
    
    // Disparar prompt oficial de instalação
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Resposta do usuário para instalação: ${outcome}`);
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fade-in"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height) + 16px)',
        right: '16px',
        backgroundColor: 'var(--bg-card)',
        color: '#FFFFFF',
        padding: '12px 18px',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid var(--primary)',
        maxWidth: '360px'
      }}
    >
      <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)' }}>
        <Download size={18} />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Instalar TecnoDrill</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Acesse direto da tela inicial</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
        <button
          onClick={handleInstallClick}
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Instalar
        </button>
        
        <button
          onClick={() => setIsVisible(false)}
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
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
