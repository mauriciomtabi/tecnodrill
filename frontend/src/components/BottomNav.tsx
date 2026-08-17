import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  HardHat, 
  Users, 
  Camera, 
  Trophy,
  Plus
} from 'lucide-react';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onQuickAddBarra?: () => void;
  onOpenNovoServico?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  currentPath, 
  onNavigate, 
  onQuickAddBarra,
  onOpenNovoServico 
}) => {
  const { user } = useAuth();

  if (!user) return null;
  const isGestor = user.perfil === 'GESTOR' || user.perfil === 'ADMIN';

  return (
    <nav
      className="bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border-color)',
        display: 'none',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
        padding: '0 12px',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.35)'
      }}
    >
      <style>{`
        @media (max-width: 1023px) {
          .bottom-nav {
            display: flex !important;
          }
        }
      `}</style>

      {/* 1. LADO ESQUERDO: SERVIÇOS */}
      <button
        onClick={() => onNavigate(isGestor ? '/app/obras' : '/tecnico/obras')}
        title="Serviços"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentPath.includes('/obras') || currentPath === '/' ? 'var(--primary)' : 'var(--text-muted)',
          padding: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <HardHat size={24} />
      </button>

      {/* 2. CENTRO: BOTÃO PRINCIPAL FLUTUANTE COM CONTORNO CLARO (56px) */}
      <button
        onClick={() => {
          if (onQuickAddBarra) {
            onQuickAddBarra();
          } else if (isGestor && onOpenNovoServico) {
            onOpenNovoServico();
          }
        }}
        title="Novo Registro Fotográfico"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: '#FFFFFF',
          border: '3.5px solid #FFFFFF',
          transform: 'translateY(-16px)',
          boxShadow: '0 4px 18px rgba(240, 90, 34, 0.65), 0 0 12px rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          padding: 0,
          boxSizing: 'border-box',
          transition: 'transform 0.2s ease'
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(-16px) scale(0.92)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(-16px) scale(1)'}
      >
        <Camera size={26} strokeWidth={2.2} />
      </button>

      {/* 3. LADO DIREITO: PERFORMANCE & METAS */}
      <button
        onClick={() => onNavigate('/app/performance')}
        title="Performance & Metas"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: currentPath === '/app/performance' ? 'var(--primary)' : 'var(--text-muted)',
          padding: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <Trophy size={24} />
      </button>

      {/* 4. SE FOR GESTOR: USUÁRIOS */}
      {isGestor && (
        <button
          onClick={() => onNavigate('/app/usuarios')}
          title="Gestão de Usuários"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentPath.includes('/app/usuarios') ? 'var(--primary)' : 'var(--text-muted)',
            padding: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Users size={24} />
        </button>
      )}
    </nav>
  );
};
