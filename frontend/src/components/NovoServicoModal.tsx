import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Servico, CenarioFinanceiro, Usuario } from '../types';
import { ApiService } from '../services/api';
import { X, Check, Search, ChevronDown, Calendar, TrendingUp, Clock, Edit, UserCheck, HardHat } from 'lucide-react';

interface NovoServicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (servicoData: Partial<Servico>) => Promise<void>;
  initialData?: Servico | null;
  loading?: boolean;
}

const UFS_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const NovoServicoModal: React.FC<NovoServicoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  loading = false
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Lista de Usuários do Sistema
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [navegadorId, setNavegadorId] = useState<string>('');
  const [operadorId, setOperadorId] = useState<string>('');

  // Step 1: Informações Gerais
  const [nome, setNome] = useState('');
  const [cliente, setCliente] = useState('');
  
  // UF Searchable State
  const [uf, setUf] = useState('SP');
  const [ufSearch, setUfSearch] = useState('SP');
  const [ufDropdownOpen, setUfDropdownOpen] = useState(false);
  const ufContainerRef = useRef<HTMLDivElement>(null);

  // Cidade Searchable State
  const [cidade, setCidade] = useState('');
  const [cidadeSearch, setCidadeSearch] = useState('');
  const [cidadesList, setCidadesList] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [cidadeDropdownOpen, setCidadeDropdownOpen] = useState(false);
  const cidadeContainerRef = useRef<HTMLDivElement>(null);

  const [localizacao, setLocalizacao] = useState('');
  const [descricao, setDescricao] = useState('');

  // Step 2: Metragem (1000 inicial), Meta Diária (100 inicial) e Modelo de Retorno Financeiro
  const [metragemPrevista, setMetragemPrevista] = useState('1000');
  const [metaDiaria, setMetaDiaria] = useState('100');
  const [cenario, setCenario] = useState<CenarioFinanceiro>('VALOR_METRO');

  // Valores de cada modelo
  const [valorMetro, setValorMetro] = useState('180');
  const [fator, setFator] = useState('2.85');
  const [diametroMm, setDiametroMm] = useState('150');
  const [valorFechado, setValorFechado] = useState('50000');

  // Carregar usuários para seleção de equipe
  useEffect(() => {
    if (isOpen) {
      ApiService.getUsuarios()
        .then(data => {
          setUsuarios(data);
          // Set initial defaults if creating new
          if (!initialData) {
            const nav = data.find(u => u.perfil === 'NAVEGADOR');
            if (nav) setNavegadorId(nav.id);
            const op = data.find(u => u.perfil === 'OPERADOR');
            if (op) setOperadorId(op.id);
          }
        })
        .catch(err => console.error('Erro ao carregar usuários:', err));
    }
  }, [isOpen]);

  // Carregar dados iniciais ao abrir para edição ou resetar para novo cadastro
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNome(initialData.nome || '');
        setCliente(initialData.cliente || '');
        setDescricao(initialData.descricao || '');
        setLocalizacao(initialData.local || '');
        setNavegadorId(initialData.navegador_id || '');
        setOperadorId(initialData.operador_id || '');
        setMetragemPrevista(String(initialData.metragem_prevista_total || 1000));
        setMetaDiaria(String(initialData.meta_metros || 100));
        setCenario(initialData.cenario_financeiro || 'VALOR_METRO');
        setValorMetro(String(initialData.valor_metro || 180));
        setFator(String(initialData.fator_financeiro || 2.85));
        setDiametroMm(String(initialData.diametro_furo_mm || 150));
        setValorFechado(String(initialData.valor_total_fechado || 50000));
      } else {
        setNome('');
        setCliente('');
        setLocalizacao('');
        setDescricao('');
        setMetragemPrevista('1000');
        setMetaDiaria('100');
        setCenario('VALOR_METRO');
        setValorMetro('180');
        setFator('2.85');
        setDiametroMm('150');
        setValorFechado('50000');
      }
      setCurrentStep(1);
      setFormError(null);
    }
  }, [isOpen, initialData]);

  // Carregar cidades do IBGE sempre que a UF mudar
  useEffect(() => {
    if (!uf) return;
    setLoadingCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.map((c: any) => c.nome).sort((a: string, b: string) => a.localeCompare(b));
          setCidadesList(names);
          if (names.length > 0) {
            if (!cidade || !names.includes(cidade)) {
              setCidade(names[0]);
              setCidadeSearch(names[0]);
            }
          }
        }
      })
      .catch(() => {
        setCidadesList(['São Paulo', 'Santos', 'Campinas', 'Guarulhos', 'São Bernardo do Campo']);
      })
      .finally(() => setLoadingCidades(false));
  }, [uf]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ufContainerRef.current && !ufContainerRef.current.contains(event.target as Node)) {
        setUfDropdownOpen(false);
      }
      if (cidadeContainerRef.current && !cidadeContainerRef.current.contains(event.target as Node)) {
        setCidadeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSelectUf = (selectedUf: string) => {
    setUf(selectedUf);
    setUfSearch(selectedUf);
    setUfDropdownOpen(false);
  };

  const handleSelectCidade = (selectedCidade: string) => {
    setCidade(selectedCidade);
    setCidadeSearch(selectedCidade);
    setCidadeDropdownOpen(false);
  };

  const filteredUfs = UFS_LIST.filter(u => 
    u.toLowerCase().includes(ufSearch.toLowerCase())
  );

  const filteredCidades = cidadesList.filter(c => 
    c.toLowerCase().includes(cidadeSearch.toLowerCase())
  );

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cliente.trim()) {
      setFormError('Preencha os campos obrigatórios: Nome do Serviço e Cliente.');
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const mTotal = Number(metragemPrevista) || 1000;
    const mDia = Number(metaDiaria) || 100;

    const navObj = usuarios.find(u => u.id === navegadorId);
    const opObj = usuarios.find(u => u.id === operadorId);

    try {
      const localCompleto = cidade 
        ? `${cidade} - ${uf} • ${localizacao.trim()}`
        : localizacao.trim() || 'Brasil';

      await onSave({
        nome: nome.toUpperCase().trim(),
        cliente: cliente.trim(),
        local: localCompleto,
        descricao: descricao.trim() || undefined,
        navegador_id: navegadorId || undefined,
        navegador_nome: navObj?.nome || undefined,
        operador_id: operadorId || undefined,
        operador_nome: opObj?.nome || undefined,
        cenario_financeiro: cenario,
        valor_metro: Number(valorMetro) || 0,
        fator_financeiro: Number(fator) || 0,
        diametro_furo_mm: Number(diametroMm) || 0,
        valor_total_fechado: Number(valorFechado) || 0,
        metragem_prevista_total: mTotal,
        tipo_meta: 'DIARIA',
        meta_metros: mDia
      });
      onClose();
      setCurrentStep(1);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar serviço.');
    }
  };

  const valorUnitarioEstimado = () => {
    if (cenario === 'VALOR_METRO') {
      return Number(valorMetro) || 0;
    }
    if (cenario === 'FATOR_DIAMETRO_METRO') {
      return (Number(fator) || 0) * (Number(diametroMm) || 0);
    }
    if (cenario === 'VALOR_FECHADO') {
      const m = Number(metragemPrevista) || 1;
      return (Number(valorFechado) || 0) / m;
    }
    return 0;
  };

  const retornoPrevistoTotal = () => {
    const m = Number(metragemPrevista) || 0;
    if (cenario === 'VALOR_FECHADO') return Number(valorFechado) || 0;
    return m * valorUnitarioEstimado();
  };

  const navegadoresList = usuarios.filter(u => u.perfil === 'NAVEGADOR' || u.perfil === 'ADMIN' || u.perfil === 'GESTOR');
  const operadoresList = usuarios.filter(u => u.perfil === 'OPERADOR' || u.perfil === 'ADMIN' || u.perfil === 'GESTOR');

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 12, 16, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#0D1C24',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          boxSizing: 'border-box'
        }}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              {initialData ? `Editar Serviço (${initialData.id})` : 'Novo Serviço'}
            </h2>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {currentStep === 1 
                ? 'Passo 1 de 2: Informações, Equipe e Localização' 
                : 'Passo 2 de 2: Metas de Perfuração & Retorno Financeiro'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          
          {formError && (
            <div 
              style={{
                backgroundColor: 'rgba(231, 76, 60, 0.15)',
                border: '1px solid var(--danger)',
                color: '#FADBD8',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '16px'
              }}
            >
              {formError}
            </div>
          )}

          {/* PASSO 1: INFORMAÇÕES GERAIS, EQUIPE E LOCALIZAÇÃO */}
          {currentStep === 1 && (
            <form id="step1-form" onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Nome do Serviço */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="ex: Travessia Rodovia BR-101 KM 48"
                  required
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* Cliente */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Cliente / Contratante *
                </label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="ex: Sabesp, Enel, Comgás..."
                  required
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* SELEÇÃO DE EQUIPE (NAVEGADOR E OPERADOR) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Navegador *
                  </label>
                  <select
                    value={navegadorId}
                    onChange={(e) => setNavegadorId(e.target.value)}
                    style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                  >
                    <option value="">Selecione o Navegador</option>
                    {navegadoresList.map(u => (
                      <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Operador *
                  </label>
                  <select
                    value={operadorId}
                    onChange={(e) => setOperadorId(e.target.value)}
                    style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                  >
                    <option value="">Selecione o Operador</option>
                    {operadoresList.map(u => (
                      <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* UF e Cidade do IBGE Pesquisáveis */}
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px' }}>
                
                {/* Campo UF */}
                <div ref={ufContainerRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    UF *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={ufSearch}
                      onChange={(e) => {
                        setUfSearch(e.target.value.toUpperCase());
                        setUfDropdownOpen(true);
                      }}
                      onFocus={() => setUfDropdownOpen(true)}
                      placeholder="UF"
                      maxLength={2}
                      style={{ fontSize: '13px', textTransform: 'uppercase', fontWeight: 700, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                    <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>

                  {ufDropdownOpen && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '180px',
                        overflowY: 'auto',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        zIndex: 99999,
                        marginTop: '4px',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                    >
                      {filteredUfs.map((item) => (
                        <div
                          key={item}
                          onClick={() => handleSelectUf(item)}
                          style={{
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            fontWeight: uf === item ? 700 : 400,
                            color: uf === item ? 'var(--primary)' : 'var(--text-main)',
                            backgroundColor: uf === item ? 'rgba(240, 90, 34, 0.1)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>{item}</span>
                          {uf === item && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Campo Cidade */}
                <div ref={cidadeContainerRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Cidade (IBGE {uf}) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={cidadeSearch}
                      onChange={(e) => {
                        setCidadeSearch(e.target.value);
                        setCidadeDropdownOpen(true);
                      }}
                      onFocus={() => setCidadeDropdownOpen(true)}
                      placeholder={loadingCidades ? 'Carregando cidades...' : 'Digite para pesquisar a cidade...'}
                      disabled={loadingCidades}
                      style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', paddingRight: '30px' }}
                    />
                    <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>

                  {cidadeDropdownOpen && !loadingCidades && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        zIndex: 99999,
                        marginTop: '4px',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                    >
                      {filteredCidades.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Nenhuma cidade encontrada
                        </div>
                      ) : (
                        filteredCidades.slice(0, 50).map((item) => (
                          <div
                            key={item}
                            onClick={() => handleSelectCidade(item)}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12.5px',
                              fontWeight: cidade === item ? 700 : 400,
                              color: cidade === item ? 'var(--primary)' : 'var(--text-main)',
                              backgroundColor: cidade === item ? 'rgba(240, 90, 34, 0.1)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <span>{item}</span>
                            {cidade === item && <Check size={12} />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Endereço / Referência */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Endereço / Referência do Trecho
                </label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={(e) => setLocalizacao(e.target.value)}
                  placeholder="ex: Av. Ana Costa, 1500 - Gonzaga"
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* Observações / Descrição */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Observações Gerais do Serviço (Opcional)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes adicionais, licenças ambientais, interferências previstas..."
                  rows={2}
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'none' }}
                />
              </div>

            </form>
          )}

          {/* PASSO 2: METAS E RETORNO FINANCEIRO */}
          {currentStep === 2 && (
            <form id="step2-form" onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Row 1: Metragem Total (Inicial: 1000) e Meta Diária (Inicial: 100) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* Metragem Prevista */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Metragem Prevista (m) *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      value={metragemPrevista}
                      onChange={(e) => setMetragemPrevista(e.target.value)}
                      min="1"
                      required
                      style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>m</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Total planejado para a obra
                  </span>
                </div>

                {/* Meta Diária */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Meta Diária (m) *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      value={metaDiaria}
                      onChange={(e) => setMetaDiaria(e.target.value)}
                      min="1"
                      required
                      style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>m/dia</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Dispara celebração em campo
                  </span>
                </div>

              </div>

              {/* Row 2: Seleção do Modelo de Retorno Financeiro */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Modelo de Retorno Financeiro *
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  
                  {/* Opção 1: Valor Fixo por Metro */}
                  <div
                    onClick={() => setCenario('VALOR_METRO')}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'VALOR_METRO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '11.5px', color: cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                        R$ / Metro
                      </strong>
                      <div 
                        style={{ 
                          width: '14px', 
                          height: '14px', 
                          borderRadius: '50%', 
                          border: `2px solid ${cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--text-muted)'}`,
                          backgroundColor: cenario === 'VALOR_METRO' ? 'var(--primary)' : 'transparent'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Preço fixo por metro perfurado
                    </span>
                  </div>

                  {/* Opção 2: Fator × Diâmetro × Metro */}
                  <div
                    onClick={() => setCenario('FATOR_DIAMETRO_METRO')}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'FATOR_DIAMETRO_METRO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '11.5px', color: cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                        Fator × Diâmetro
                      </strong>
                      <div 
                        style={{ 
                          width: '14px', 
                          height: '14px', 
                          borderRadius: '50%', 
                          border: `2px solid ${cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--text-muted)'}`,
                          backgroundColor: cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'transparent'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Fator × Diâm(mm) × Metros
                    </span>
                  </div>

                  {/* Opção 3: Valor Fechado da Obra */}
                  <div
                    onClick={() => setCenario('VALOR_FECHADO')}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'VALOR_FECHADO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '11.5px', color: cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--text-main)' }}>
                        Valor Fechado
                      </strong>
                      <div 
                        style={{ 
                          width: '14px', 
                          height: '14px', 
                          borderRadius: '50%', 
                          border: `2px solid ${cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--text-muted)'}`,
                          backgroundColor: cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'transparent'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Contrato por preço global
                    </span>
                  </div>

                </div>
              </div>

              {/* Row 3: Inputs específicos do modelo selecionado */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                
                {cenario === 'VALOR_METRO' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      VALOR POR METRO (R$) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={valorMetro}
                        onChange={(e) => setValorMetro(e.target.value)}
                        placeholder="180.00"
                        required
                        style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                )}

                {cenario === 'FATOR_DIAMETRO_METRO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                        FATOR FINANCEIRO *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={fator}
                        onChange={(e) => setFator(e.target.value)}
                        placeholder="2.85"
                        required
                        style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                        DIÂMETRO DO FURO (MM) *
                      </label>
                      <input
                        type="number"
                        value={diametroMm}
                        onChange={(e) => setDiametroMm(e.target.value)}
                        placeholder="150"
                        required
                        style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                )}

                {cenario === 'VALOR_FECHADO' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      VALOR GLOBAL DO CONTRATO (R$) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={valorFechado}
                        onChange={(e) => setValorFechado(e.target.value)}
                        placeholder="50000.00"
                        required
                        style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Resumo do Cálculo em Tempo Real */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Faturamento Previsto Total:
                  </span>
                  <strong style={{ fontSize: '15px', color: 'var(--success)', fontWeight: 800 }}>
                    R$ {retornoPrevistoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>

              </div>

            </form>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {currentStep === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="step1-form"
                className="header-action-btn"
                style={{ padding: '9px 20px', fontSize: '13px' }}
              >
                <span>Avançar para Metas</span>
                <span>→</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ← Voltar
              </button>

              <button
                type="submit"
                form="step2-form"
                disabled={loading}
                className="header-action-btn"
                style={{ padding: '9px 22px', fontSize: '13px' }}
              >
                {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar Serviço'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};
