import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario } from '../types';
import { ApiService } from '../services/api';
import { OfflineSyncService } from '../services/offlineSync';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  theme: 'light' | 'dark';
  isOffline: boolean;
  isLoading: boolean;
  login: (identificador: string, pass: string) => Promise<void>;
  logout: () => void;
  toggleTheme: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  syncOfflineData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('tecnodrill_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Sincronização offline
  const syncOfflineData = async () => {
    if (!navigator.onLine) return;
    const { syncedCount, errors } = await OfflineSyncService.syncQueue();
    if (syncedCount > 0) {
      showToast(`${syncedCount} apontamento(s) sincronizado(s) com sucesso!`, 'success');
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('tecnodrill_token');
    const savedUser = localStorage.getItem('tecnodrill_usuario');
    const savedTheme = (localStorage.getItem('tecnodrill_theme') as 'light' | 'dark') || 'dark';

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {}
    }

    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setIsLoading(false);

    const handleOnline = () => {
      setIsOffline(false);
      showToast('Conexão restabelecida! Sincronizando...', 'info');
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      showToast('Você está offline. Os lançamentos serão salvos em cache.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const login = async (identificador: string, pass: string) => {
    const res = await ApiService.login(identificador, pass);
    setToken(res.token);
    setUser(res.usuario);
    showToast(`Bem-vindo, ${res.usuario.nome}!`, 'success');
  };

  const logout = () => {
    ApiService.logout();
    setToken(null);
    setUser(null);
    showToast('Sessão encerrada.', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        theme,
        isOffline,
        isLoading,
        login,
        logout,
        toggleTheme,
        showToast,
        syncOfflineData
      }}
    >
      {children}

      {/* Toast Notifications */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-sm font-medium animate-fade-in ${
              t.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
                : t.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                : 'bg-[#1F2730]/95 text-white border-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-[#F05A22] shrink-0" />}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-gray-400 hover:text-white ml-2 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
