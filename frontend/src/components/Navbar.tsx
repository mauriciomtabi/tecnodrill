import React from 'react';
import { Usuario } from '../types';
import { ApiService } from '../services/api';
import { 
  HardHat, 
  BarChart3, 
  FileSpreadsheet, 
  Radio, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Sparkles,
  PlusCircle
} from 'lucide-react';

interface NavbarProps {
  usuario: Usuario;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNovoServico: () => void;
  onLogout: () => void;
  isOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  usuario,
  activeTab,
  setActiveTab,
  onNovoServico,
  onLogout,
  isOnline
}) => {
  const isGestor = usuario.perfil === 'GESTOR' || usuario.perfil === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-[#0F1215]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab(isGestor ? 'dashboard' : 'campo')}>
          <img 
            src="/logo.png" 
            alt="TecnoDrill INFRA" 
            className="h-9 w-auto object-contain drop-shadow-md"
            onError={(e) => {
              // fallback if logo fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-white">
                Tecno<span className="text-[#F05A22]">Drill</span>
              </span>
              <span className="bg-[#F05A22]/20 text-[#F05A22] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#F05A22]/30">
                INFRA
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase -mt-0.5">
              MND & Canalização
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#161B22] p-1 rounded-xl border border-white/5">
          {isGestor && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#F05A22] text-white shadow-lg shadow-[#F05A22]/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard Gestor
            </button>
          )}

          <button
            onClick={() => setActiveTab('campo')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'campo'
                ? 'bg-[#F05A22] text-white shadow-lg shadow-[#F05A22]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" />
            Apontamento Campo (3m)
          </button>

          <button
            onClick={() => setActiveTab('relatorios')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'relatorios'
                ? 'bg-[#F05A22] text-white shadow-lg shadow-[#F05A22]/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ficha Oficial & PDF
          </button>
        </nav>

        {/* Right Actions: Offline pill, User details, New Service Button, Logout */}
        <div className="flex items-center gap-3">
          {/* Online/Offline status */}
          <div 
            title={isOnline ? 'Online (Conectado)' : 'Modo Offline (Dados em Cache)'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Quick Create Service (Gestor only) */}
          {isGestor && (
            <button
              onClick={onNovoServico}
              className="flex items-center gap-1.5 bg-[#F05A22] hover:bg-[#D94814] text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Obra / Serviço</span>
            </button>
          )}

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 bg-[#1F2730] px-3 py-1.5 rounded-xl border border-white/5">
            <div className="w-7 h-7 rounded-lg bg-[#F05A22]/20 border border-[#F05A22]/40 flex items-center justify-center text-[#F05A22] font-bold text-xs">
              {usuario.nome.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-white leading-tight">{usuario.nome.split(' ')[0]}</span>
              <span className="text-[10px] text-[#F05A22] font-semibold uppercase">{usuario.perfil}</span>
            </div>
            <button
              onClick={onLogout}
              title="Sair da Conta"
              className="text-gray-400 hover:text-rose-400 p-1 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Submenu Bar */}
      <div className="flex md:hidden mt-2.5 pt-2 border-t border-white/5 justify-around">
        {isGestor && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'dashboard' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Gestor
          </button>
        )}
        <button
          onClick={() => setActiveTab('campo')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-2 rounded ${
            activeTab === 'campo' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
          }`}
        >
          <Radio className="w-4 h-4" />
          Campo 3m
        </button>
        <button
          onClick={() => setActiveTab('relatorios')}
          className={`flex flex-col items-center gap-1 text-xs py-1 px-2 rounded ${
            activeTab === 'relatorios' ? 'text-[#F05A22] font-bold' : 'text-gray-400'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Ficha Oficial
        </button>
      </div>
    </header>
  );
};
