import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { Trophy, Sparkles, CheckCircle2, X, Zap } from 'lucide-react';

interface MetaCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  metaMetros: number;
  metrosAtingidos: number;
  tipoMeta: 'DIARIA' | 'SEMANAL';
  nomeServico?: string;
  navegadorNome?: string;
  operadorNome?: string;
}

export const MetaCelebration: React.FC<MetaCelebrationProps> = ({
  isOpen,
  onClose,
  metaMetros,
  metrosAtingidos,
  tipoMeta,
  nomeServico,
  navegadorNome,
  operadorNome
}) => {
  useEffect(() => {
    if (isOpen) {
      // Disparar rajadas de confetes multicoloridos e dourados
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const colors = ['#F05A22', '#FF7744', '#FFD700', '#10B981', '#38BDF8', '#FFFFFF'];

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Som sutil de celebração (Web Audio API)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;
        
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.65);
        });
      } catch (e) {
        // Ignora
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const percentual = metaMetros > 0 ? Math.round((metrosAtingidos / metaMetros) * 100) : 100;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 12, 16, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="fade-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#0D1C24',
          border: '2px solid var(--primary)',
          borderRadius: '24px',
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 0 50px rgba(240, 90, 34, 0.4), 0 25px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Trophy Icon with Glowing Circle */}
        <div 
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            backgroundColor: 'rgba(240, 90, 34, 0.15)',
            border: '2px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(240, 90, 34, 0.35)'
          }}
        >
          <Trophy size={42} style={{ color: '#FFD700' }} />
        </div>

        {/* Badge */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(39, 174, 96, 0.15)',
            border: '1px solid rgba(39, 174, 96, 0.35)',
            color: 'var(--success)',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px'
          }}
        >
          <Sparkles size={13} />
          <span>Meta {tipoMeta === 'DIARIA' ? 'Diária' : 'Semanal'} Conquistada!</span>
        </div>

        {/* Headline */}
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px 0' }}>
          Parabéns, Equipe! 🎉
        </h2>

        {/* Description */}
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: '1.5' }}>
          {nomeServico && <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: '4px' }}>{nomeServico}</strong>}
          A meta de <strong style={{ color: 'var(--primary)' }}>{metaMetros} metros</strong> foi atingida e superada com <strong style={{ color: 'var(--success)' }}>{metrosAtingidos} metros</strong> perfurados!
        </p>

        {/* Stats Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Metragem Total</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              {metrosAtingidos}m
            </span>
            <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              <Zap size={11} /> {percentual}% da meta
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Frente de Trabalho</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '130px' }}>
              {navegadorNome || 'Navegador'}
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '130px' }}>
              {operadorNome || 'Operador'}
            </span>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '14px',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(240, 90, 34, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={18} />
          <span>Continuar Produzindo</span>
        </button>
      </div>
    </div>,
    document.body
  );
};
