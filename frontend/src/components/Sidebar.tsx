import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  HardHat, 
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

const toTitleCase = (str: string) => {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, collapsed, onToggleCollapse }) => {
  const { user, logout, theme, toggleTheme } = useAuth();

  if (!user) return null;
  const isGestor = user.perfil === 'GESTOR' || user.perfil === 'ADMIN';

  const menuItems = isGestor
    ? [
        { path: '/app/obras', label: 'Serviços', icon: HardHat },
        { path: '/app/usuarios', label: 'Usuários', icon: Users },
      ]
    : [
        { path: '/tecnico/obras', label: 'Serviços', icon: HardHat },
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
                borderRadius: '6px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '6px',
                backgroundColor: 'rgba(255,255,255,0.04)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <ChevronLeft size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={onToggleCollapse}
            title="Expandir Menu"
            style={{
              padding: '8px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* 2. NAVIGATION LINKS */}
      <nav style={{ flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const isActive = currentPath.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '12px 0' : '10px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
                textAlign: 'left',
                borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* 3. SIDEBAR FOOTER (PADRÃO JLE COM BOTÃO SAIR ABAIXO DO CLARO/ESCURO) */}
      <div 
        style={{
          padding: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* User Card */}
        {!collapsed ? (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.04)'
            }}
          >
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                flexShrink: 0
              }}
            >
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {toTitleCase(user.nome)}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {user.perfil}
              </span>
            </div>
          </div>
        ) : (
          <div 
            title={`${toTitleCase(user.nome)} (${user.perfil})`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              margin: '0 auto'
            }}
          >
            {user.nome.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px',
            padding: '9px 10px',
            borderRadius: '6px',
            color: 'var(--text-muted)',
            width: '100%',
            backgroundColor: 'rgba(255,255,255,0.02)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FFFFFF';
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
          }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          {!collapsed && <span style={{ fontSize: '12px', fontWeight: 500 }}>Modo {theme === 'light' ? 'Escuro' : 'Claro'}</span>}
        </button>

        {/* Logout Button (ABAIXO DO MODO CLARO/ESCURO) */}
        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px',
            padding: '9px 10px',
            borderRadius: '6px',
            color: '#E74C3C',
            width: '100%',
            backgroundColor: 'rgba(231, 76, 60, 0.08)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(231, 76, 60, 0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(231, 76, 60, 0.08)';
          }}
        >
          <LogOut size={16} />
          {!collapsed && <span style={{ fontSize: '12px', fontWeight: 700 }}>Sair</span>}
        </button>
      </div>
    </aside>
  );
};
