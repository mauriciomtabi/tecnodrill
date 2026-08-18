import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { ObrasList } from './pages/ObrasList';
import { ObraDetalhes } from './pages/ObraDetalhes';
import { UsuariosPage } from './pages/UsuariosPage';
import { PerformancePage } from './pages/PerformancePage';
import { NovoServicoModal } from './components/NovoServicoModal';
import { RodEntryModal } from './components/RodEntryModal';
import { MetaCelebration } from './components/MetaCelebration';
import { PwaInstall } from './components/PwaInstall';
import { PrimeiroAcessoModal } from './components/PrimeiroAcessoModal';
import { ApiService } from './services/api';
import { Servico, Furo, Barra } from './types';
import { LogOut } from 'lucide-react';

export const App: React.FC = () => {
  const { user, token, isLoading, showToast, logout } = useAuth();
  
  const [currentPath, setCurrentPath] = useState('');
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('tecnodrill_sidebar_collapsed') === 'true';
  });
  const [pageTitle, setPageTitle] = useState('TecnoDrill INFRA');
  const [pageSubtitle, setPageSubtitle] = useState('');

  // Modal Novo Serviço (Gestor)
  const [showNovoServicoModal, setShowNovoServicoModal] = useState(false);
  const [creatingServico, setCreatingServico] = useState(false);

  // Modal Novo Registro Direto (Câmera / Botão Central)
  const [showDirectRodModal, setShowDirectRodModal] = useState(false);
  const [activeFuro, setActiveFuro] = useState<Furo | null>(null);
  const [activeBarraCount, setActiveBarraCount] = useState<number>(1);
  const [savingDirectRod, setSavingDirectRod] = useState(false);

  // Celebração de Meta
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    metaMetros: number;
    metrosAtingidos: number;
    tipoMeta: 'DIARIA' | 'SEMANAL';
    nomeServico: string;
  }>({ metaMetros: 54, metrosAtingidos: 54, tipoMeta: 'DIARIA', nomeServico: '' });

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

      const initialPath = savedPath && savedPath !== '/app/campo' && savedPath !== '/tecnico/campo'
        ? savedPath 
        : defaultRoute;

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

  // Acionamento direto do formulário de novo registro pelo botão central da Câmera
  const handleOpenDirectRodModal = async () => {
    try {
      const servicos = await ApiService.getServicos();
      if (servicos.length === 0) {
        showToast('Nenhum serviço ativo encontrado para realizar apontamentos.', 'info');
        return;
      }

      // Escolher o serviço atualmente selecionado ou o primeiro disponível
      const targetServicoId = selectedObraId || servicos[0].id;
      const furos = await ApiService.getFuros(targetServicoId);

      let furoToUse: Furo;
      if (furos.length > 0) {
        furoToUse = furos[0];
      } else {
        furoToUse = await ApiService.createFuro({
          servico_id: targetServicoId,
          navegador_nome: user?.nome || 'Navegador',
          operador_nome: 'Operador',
          status: 'EM_EXECUCAO'
        });
      }

      const barras = await ApiService.getBarras(furoToUse.id);
      setActiveFuro(furoToUse);
      setActiveBarraCount(barras.length + 1);
      setShowDirectRodModal(true);
    } catch (err: any) {
      showToast('Erro ao preparar formulário de registro.', 'error');
    }
  };

  const handleSubmitDirectRod = async (barraData: Partial<Barra>) => {
    if (!activeFuro) return;
    setSavingDirectRod(true);
    try {
      const res = await ApiService.addBarra(activeFuro.id, barraData);

      const servico = await ApiService.getServico(activeFuro.servico_id);
      const metaTotal = servico.meta_metros || 100;
      const totalMetros = res.barra.metros_acumulados;

      if (res.celebrarMeta) {
        setCelebrationData({
          metaMetros: metaTotal,
          metrosAtingidos: totalMetros,
          tipoMeta: servico.tipo_meta || 'DIARIA',
          nomeServico: servico.nome
        });
        setCelebrationOpen(true);
      }

      // Redireciona para o detalhe da obra caso não esteja
      if (selectedObraId !== activeFuro.servico_id) {
        setSelectedObraId(activeFuro.servico_id);
        setCurrentPath('/app/obras/detalhe');
      }

      return res;
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar apontamento.', 'error');
      throw err;
    } finally {
      setSavingDirectRod(false);
    }
  };

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

  if (user.trocar_senha_primeiro_acesso) {
    return <PrimeiroAcessoModal isOpen={true} />;
  }

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
            servicoId={selectedObraId || 'TD-01'}
            onBack={() => handleNavigate(user.perfil === 'OPERADOR' || user.perfil === 'NAVEGADOR' ? '/tecnico/obras' : '/app/obras')}
            onVerFichaOficial={() => {}}
          />
        );

      case '/app/usuarios':
        return (
          <UsuariosPage
            setHeaderInfo={setHeaderInfo}
          />
        );

      case '/app/performance':
        return (
          <PerformancePage
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
        {/* MOBILE TOP HEADER COM BOTÃO DE SAIR NO CANTO SUPERIOR DIREITO */}
        <header className="mobile-top-header">
          <div 
            className="mobile-top-brand"
            onClick={() => handleNavigate(user?.perfil === 'GESTOR' || user?.perfil === 'ADMIN' ? '/app/obras' : '/tecnico/obras')}
          >
            <img src="/logo.png" alt="TecnoDrill" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
                Tecno<span style={{ color: 'var(--primary)' }}>Drill</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {user?.perfil} • {user?.nome?.split(' ')[0]}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mobile-logout-btn"
            title="Sair do sistema"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </header>

        {renderActivePage()}
      </main>

      {/* 3. MOBILE BOTTOM NAVIGATION (Abre direto o formulário de foto/novo registro) */}
      <BottomNav
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onQuickAddBarra={handleOpenDirectRodModal}
        onOpenNovoServico={() => setShowNovoServicoModal(true)}
      />

      {/* 4. MODAL NOVO SERVIÇO (Gestor) */}
      <NovoServicoModal
        isOpen={showNovoServicoModal}
        onClose={() => setShowNovoServicoModal(false)}
        onSave={handleCreateServico}
        loading={creatingServico}
      />

      {/* 5. MODAL NOVO REGISTRO DIRETO (3 PASSOS JLE) */}
      <RodEntryModal
        isOpen={showDirectRodModal}
        onClose={() => setShowDirectRodModal(false)}
        nextBarraNumber={activeBarraCount}
        onSubmit={handleSubmitDirectRod}
        loading={savingDirectRod}
      />

      {/* 6. MODAL CELEBRAÇÃO DE META */}
      <MetaCelebration
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        metaMetros={celebrationData.metaMetros}
        metrosAtingidos={celebrationData.metrosAtingidos}
        tipoMeta={celebrationData.tipoMeta}
        nomeServico={celebrationData.nomeServico}
      />

      {/* 7. DETECÇÃO & INSTALAÇÃO DO PWA */}
      <PwaInstall />
    </div>
  );
};

export default App;
