import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { ObrasList } from './pages/ObrasList';
import { ObraDetalhes } from './pages/ObraDetalhes';
import { CampoNavigator } from './pages/CampoNavigator';
import { UsuariosPage } from './pages/UsuariosPage';
import { NovoServicoModal } from './components/NovoServicoModal';
import { ApiService } from './services/api';
import { Servico } from './types';

export const App: React.FC = () => {
  const { user, token, isLoading, showToast } = useAuth();
  
  const [currentPath, setCurrentPath] = useState('');
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('tecnodrill_sidebar_collapsed') === 'true';
  });
  const [pageTitle, setPageTitle] = useState('TecnoDrill INFRA');
  const [pageSubtitle, setPageSubtitle] = useState('');

  // Modal Novo Serviço
  const [showNovoServicoModal, setShowNovoServicoModal] = useState(false);
  const [creatingServico, setCreatingServico] = useState(false);

  useEffect(() => {
    localStorage.setItem('tecnodrill_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const setHeaderInfo = (title: string, subtitle: string) => {
    setPageTitle(title);
    setPageSubtitle(subtitle);
  };

  // Sincronizar rotas baseadas no perfil do usuário
  useEffect(() => {
    if (isLoading) return;

    if (user) {
      const savedPath = localStorage.getItem('tecnodrill_current_path');
      const savedObraId = localStorage.getItem('tecnodrill_selected_obra_id');

      const defaultRoute = (user.perfil === 'OPERADOR' || user.perfil === 'NAVEGADOR')
        ? '/tecnico/obras'
        : '/app/obras';

      const initialPath = savedPath || defaultRoute;
      setCurrentPath(initialPath);
      setSelectedObraId(savedObraId || null);
    } else {
      localStorage.removeItem('tecnodrill_current_path');
      localStorage.removeItem('tecnodrill_selected_obra_id');
      setCurrentPath('/login');
      setSelectedObraId(null);
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (user && currentPath) {
      localStorage.setItem('tecnodrill_current_path', currentPath);
      if (selectedObraId) {
        localStorage.setItem('tecnodrill_selected_obra_id', selectedObraId);
      } else {
        localStorage.removeItem('tecnodrill_selected_obra_id');
      }
    }
  }, [currentPath, selectedObraId, user]);

  const handleNavigate = (path: string) => {
    if (path.startsWith('/app/obras/') || path.startsWith('/tecnico/obras/')) {
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      setSelectedObraId(id);
      setCurrentPath('/app/obras/detalhe');
    } else {
      setCurrentPath(path);
      if (path !== '/app/obras/detalhe') {
        setSelectedObraId(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!user || !token) {
    return <Login />;
  }

  const handleCreateServico = async (servicoData: Partial<Servico>) => {
    setCreatingServico(true);
    try {
      const novo = await ApiService.createServico(servicoData);
      showToast(`Serviço ${novo.nome} criado com sucesso!`, 'success');
      setShowNovoServicoModal(false);
      handleNavigate(`/app/obras/${novo.id}`);
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar serviço.', 'error');
    } finally {
      setCreatingServico(false);
    }
  };

  const renderActivePage = () => {
    switch (currentPath) {
      case '/app/obras':
      case '/tecnico/obras':
        return (
          <ObrasList
            setHeaderInfo={setHeaderInfo}
            onSelectServico={(id) => handleNavigate(`/app/obras/${id}`)}
            onOpenNovoServicoModal={() => setShowNovoServicoModal(true)}
          />
        );

      case '/app/obras/detalhe':
        return (
          <ObraDetalhes
            setHeaderInfo={setHeaderInfo}
            servicoId={selectedObraId || 'TD-OBRA-01'}
            onBack={() => handleNavigate(user.perfil === 'OPERADOR' || user.perfil === 'NAVEGADOR' ? '/tecnico/obras' : '/app/obras')}
            onVerFichaOficial={() => {}}
          />
        );

      case '/app/campo':
      case '/tecnico/campo':
        return (
          <CampoNavigator
            servicoIdProp={selectedObraId || undefined}
            onVerFichaOficial={() => {}}
          />
        );

      case '/app/usuarios':
        return (
          <UsuariosPage
            setHeaderInfo={setHeaderInfo}
          />
        );

      default:
        return (
          <ObrasList
            setHeaderInfo={setHeaderInfo}
            onSelectServico={(id) => handleNavigate(`/app/obras/${id}`)}
            onOpenNovoServicoModal={() => setShowNovoServicoModal(true)}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* 1. DESKTOP SIDEBAR (Layout Idêntico ao App JLE) */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {/* 2. RESPONSIVE MAIN CONTENT */}
      <main className={`main-content${sidebarCollapsed ? ' collapsed' : ''}`}>
        {renderActivePage()}
      </main>

      {/* 3. MOBILE BOTTOM NAVIGATION */}
      <BottomNav
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onQuickAddBarra={() => handleNavigate('/app/campo')}
      />

      {/* 4. MODAL NOVO SERVIÇO (2 Passos Idêntico ao App JLE) */}
      <NovoServicoModal
        isOpen={showNovoServicoModal}
        onClose={() => setShowNovoServicoModal(false)}
        onSave={handleCreateServico}
        loading={creatingServico}
      />
    </div>
  );
};

export default App;
