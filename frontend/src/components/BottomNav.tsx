import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  HardHat, 
  Radio, 
  FileSpreadsheet, 
  Plus, 
  Zap, 
  TrendingUp 
} from 'lucide-react';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onQuickAddBarra?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPath, onNavigate, onQuickAddBarra }) => {
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
        padding: '0 8px',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.25)'
      }}
    >
      <style>{`
        @media (max-width: 1023px) {
          .bottom-nav {
            display: flex !important;
          }
        }
      `}</style>

      {/* Item 1: Dashboard ou Obras */}
      {isGestor ? (
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
            currentPath === 'dashboard' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
          }`}
        >
          <BarChart3 size={20} />
          <span className="text-[10px]">Dashboard</span>
        </button>
      ) : (
        <button
          onClick={() => onNavigate('obras')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
            currentPath === 'obras' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
          }`}
        >
          <HardHat size={20} />
          <span className="text-[10px]">Serviços</span>
        </button>
      )}

      {/* Item 2: Obras / Finanças */}
      {isGestor && (
        <button
          onClick={() => onNavigate('obras')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
            currentPath === 'obras' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
          }`}
        >
          <HardHat size={20} />
          <span className="text-[10px]">Obras</span>
        </button>
      )}

      {/* Centered Action Button: + 3m Apontamento */}
      <button
        onClick={() => {
          onNavigate('campo');
          if (onQuickAddBarra) onQuickAddBarra();
        }}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(240, 90, 34, 0.5)',
          marginTop: '-24px',
          border: '3px solid var(--bg-sidebar)'
        }}
        className="active:scale-95 transition-transform"
        title="Lançar Nova Barra (+3m)"
      >
        <Radio size={22} className="animate-pulse" />
        <span className="text-[8px] font-black tracking-tighter uppercase -mt-0.5">+3M</span>
      </button>

      {/* Item 3: Campo */}
      <button
        onClick={() => onNavigate('campo')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
          currentPath === 'campo' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
        }`}
      >
        <Zap size={20} />
        <span className="text-[10px]">Sonda 3m</span>
      </button>

      {/* Item 4: Ficha Oficial */}
      <button
        onClick={() => onNavigate('relatorios')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
          currentPath === 'relatorios' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
        }`}
      >
        <FileSpreadsheet size={20} />
        <span className="text-[10px]">Ficha PDF</span>
      </button>
    </nav>
  );
};
