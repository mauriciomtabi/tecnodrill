import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  HardHat, 
  Radio, 
  Users, 
  Sun, 
  Moon, 
  LogOut, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, collapsed, onToggleCollapse }) => {
  const { user, logout, theme, toggleTheme } = useAuth();

  if (!user) return null;
  const isGestor = user.perfil === 'GESTOR' || user.perfil === 'ADMIN';

  const menuItems = isGestor
    ? [
        { path: '/app/obras', label: 'Serviços', icon: HardHat },
        { path: '/app/campo', label: 'Apontamento', icon: Radio },
        { path: '/app/usuarios', label: 'Usuários', icon: Users },
      ]
    : [
        { path: '/tecnico/obras', label: 'Meus Serviços', icon: HardHat },
        { path: '/tecnico/campo', label: 'Apontamento', icon: Radio },
      ];

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)',
        backgroundColor: 'var(--bg-sidebar)',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '4px 0 10px rgba(0, 0, 0, 0.15)'
      }}
    >
      {/* 1. SIDEBAR HEADER (Logo perfeitamente centralizado) */}
      <div 
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0' : '0 12px 0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {!collapsed ? (
          <>
            <div 
              onClick={() => onNavigate(isGestor ? '/app/obras' : '/tecnico/obras')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                flex: 1,
                overflow: 'hidden'
              }}
            >
              <img 
                src="/logo.png" 
                alt="TecnoDrill INFRA" 
                style={{ 
                  height: '44px', 
                  maxWidth: '165px', 
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }} 
              />
            </div>

            <button
              onClick={onToggleCollapse}
              title="Recolher Menu"
              style={{
                padding: '6px',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              className="hover:text-white hover:bg-white/10"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <div 
            onClick={onToggleCollapse}
            title="Expandir Menu"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '100%',
              height: '100%',
              cursor: 'pointer'
            }}
          >
            <img 
              src="/logo-icon.png" 
              alt="TecnoDrill" 
              style={{ 
                width: '38px', 
                height: '38px', 
                objectFit: 'contain',
                display: 'block'
              }} 
            />
          </div>
        )}
      </div>

      {/* 2. NAVIGATION LINKS */}
      <div style={{ flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '10px 0' : '10px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius-sm)',
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13.5px',
                boxShadow: isActive ? '0 2px 8px rgba(240, 90, 34, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
              className={!isActive ? 'hover:text-white hover:bg-white/5' : ''}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* 3. USER FOOTER INFO & THEME TOGGLE */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* User Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '6px 0' : '6px 8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)'
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: 'rgba(240, 90, 34, 0.2)',
              border: '1px solid rgba(240, 90, 34, 0.4)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            {user.nome.charAt(0)}
          </div>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
              <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.nome}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                {user.perfil}
              </span>
            </div>
          )}
        </div>

        {/* Controls: Theme & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <button
            onClick={toggleTheme}
            style={{
              padding: '6px 8px',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px'
            }}
            className="hover:text-white hover:bg-white/10"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {!collapsed && <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
          </button>

          <button
            onClick={logout}
            style={{
              padding: '6px 8px',
              color: '#F87171',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px'
            }}
            className="hover:bg-rose-500/10"
            title="Sair do Sistema"
          >
            <LogOut size={15} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
