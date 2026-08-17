import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Servico, CenarioFinanceiro } from '../types';
import { X, Check, Search, ChevronDown, Calendar, TrendingUp, Clock, Edit } from 'lucide-react';

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

  // Carregar dados iniciais ao abrir para edição ou resetar para novo cadastro
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNome(initialData.nome || '');
        setCliente(initialData.cliente || '');
        setDescricao(initialData.descricao || '');
        setLocalizacao(initialData.local || '');
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

    try {
      const localCompleto = cidade 
        ? `${cidade} - ${uf} • ${localizacao.trim()}`
        : localizacao.trim() || 'Brasil';

      await onSave({
        nome: nome.toUpperCase().trim(),
        cliente: cliente.trim(),
        local: localCompleto,
        descricao: descricao.trim() || undefined,
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

  // Cálculo prévio do valor por metro estimado
  const valorUnitarioEstimado = () => {
    if (cenario === 'VALOR_METRO') {
      return Number(valorMetro) || 0;
    }
    if (cenario === 'FATOR_DIAMETRO_METRO') {
      return (Number(fator) || 0) * (Number(diametroMm) || 0);
    }
    if (cenario === 'VALOR_FECHADO') {
      const total = Number(metragemPrevista) || 1;
      return (Number(valorFechado) || 0) / total;
    }
    return 0;
  };

  // Cálculo da Projeção de Término em Dias Úteis
  const calculateProjection = () => {
    const mTotal = Number(metragemPrevista) || 0;
    const mDia = Number(metaDiaria) || 1;
    if (mTotal <= 0 || mDia <= 0) return null;

    const diasUteis = Math.ceil(mTotal / mDia);

    const data = new Date();
    let diasAdicionados = 0;
    while (diasAdicionados < diasUteis) {
      data.setDate(data.getDate() + 1);
      const dayOfWeek = data.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        diasAdicionados++;
      }
    }

    const dataFormatada = data.toLocaleDateString('pt-BR');
    return {
      diasUteis,
      dataEstimada: dataFormatada
    };
  };

  const projection = calculateProjection();

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(5px)',
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
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          margin: 'auto'
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
                ? 'Passo 1 de 2: Informações e Localização do Serviço' 
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

          {/* PASSO 1: INFORMAÇÕES GERAIS E LOCALIZAÇÃO */}
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

                  {/* Dropdown UF */}
                  {ufDropdownOpen && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 99999,
                        marginTop: '4px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                      }}
                    >
                      {filteredUfs.length === 0 ? (
                        <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>Não encontrado</div>
                      ) : (
                        filteredUfs.map(u => (
                          <div
                            key={u}
                            onClick={() => handleSelectUf(u)}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: uf === u ? 800 : 500,
                              color: uf === u ? 'var(--primary)' : 'var(--text-main)',
                              backgroundColor: uf === u ? 'rgba(240, 90, 34, 0.1)' : 'transparent',
                              cursor: 'pointer'
                            }}
                          >
                            {u}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Campo Cidade */}
                <div ref={cidadeContainerRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Cidade *
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
                      placeholder={loadingCidades ? 'Carregando cidades...' : 'Digite para buscar a cidade...'}
                      required
                      style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                    <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>

                  {/* Dropdown Cidades */}
                  {cidadeDropdownOpen && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 99999,
                        marginTop: '4px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                      }}
                    >
                      {loadingCidades ? (
                        <div style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Carregando IBGE...</div>
                      ) : filteredCidades.length === 0 ? (
                        <div style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Nenhuma cidade encontrada</div>
                      ) : (
                        filteredCidades.slice(0, 50).map(c => (
                          <div
                            key={c}
                            onClick={() => handleSelectCidade(c)}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: cidade === c ? 800 : 500,
                              color: cidade === c ? 'var(--primary)' : 'var(--text-main)',
                              backgroundColor: cidade === c ? 'rgba(240, 90, 34, 0.1)' : 'transparent',
                              cursor: 'pointer'
                            }}
                          >
                            {c}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Endereço / Ponto de Referência */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Endereço / Ponto de Referência (Opcional)
                </label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={(e) => setLocalizacao(e.target.value)}
                  placeholder="ex: Av. Paulista, altura do nº 1000"
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* Observações / Descrição */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Observações Gerais (Opcional)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes adicionais sobre solo, interferências..."
                  rows={2}
                  style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', resize: 'none' }}
                />
              </div>

            </form>
          )}

          {/* PASSO 2: METRAGEM, META DIÁRIA & MODELO FINANCEIRO */}
          {currentStep === 2 && (
            <form id="step2-form" onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Metragem Total e Meta Diária */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* 1. Metragem Total (1000m Inicial) */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Metragem Total da Obra (Metros) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={metragemPrevista}
                    onChange={(e) => setMetragemPrevista(e.target.value)}
                    required
                    style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                  />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Extensão total do furo/canalização
                  </span>
                </div>

                {/* 2. Meta Diária (100m Inicial) */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Meta Diária de Produção (m/dia) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={metaDiaria}
                    onChange={(e) => setMetaDiaria(e.target.value)}
                    required
                    style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                  />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Produção estimada por dia de trabalho
                  </span>
                </div>

              </div>

              {/* Informativo de Projeção de Término do Serviço */}
              {projection && (
                <div 
                  style={{
                    backgroundColor: 'rgba(240, 90, 34, 0.08)',
                    border: '1px solid rgba(240, 90, 34, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(240, 90, 34, 0.2)', color: 'var(--primary)' }}>
                      <Clock size={16} />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', display: 'block' }}>
                        Projeção Estimada de Conclusão
                      </span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        {projection.diasUteis} {projection.diasUteis === 1 ? 'dia útil' : 'dias úteis'} de operação
                      </strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>Término Previsto:</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {projection.dataEstimada}
                    </strong>
                  </div>
                </div>
              )}

              {/* Modelo de Retorno Financeiro */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Escolha o Modelo de Retorno Financeiro
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  
                  {/* Opção 1: Valor por Metro */}
                  <div
                    onClick={() => setCenario('VALOR_METRO')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'VALOR_METRO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <strong style={{ fontSize: '12px', color: cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      Valor por Metro
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      R$ fixo por metro perfurado
                    </span>
                  </div>

                  {/* Opção 2: Fator x Diâmetro */}
                  <div
                    onClick={() => setCenario('FATOR_DIAMETRO_METRO')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'FATOR_DIAMETRO_METRO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <strong style={{ fontSize: '12px', color: cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      Fator × Diâmetro
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      Fator × Diâmetro (mm)
                    </span>
                  </div>

                  {/* Opção 3: Valor Fechado */}
                  <div
                    onClick={() => setCenario('VALOR_FECHADO')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: cenario === 'VALOR_FECHADO' ? 'rgba(240, 90, 34, 0.08)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <strong style={{ fontSize: '12px', color: cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      Valor Fechado
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      Valor total global da obra
                    </span>
                  </div>

                </div>

                {/* Campos Específicos do Modelo Selecionado */}
                {cenario === 'VALOR_METRO' && (
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Valor por Metro Perfurado (R$/m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorMetro}
                      onChange={(e) => setValorMetro(e.target.value)}
                      placeholder="180.00"
                      required
                      style={{ fontSize: '14px', fontWeight: 700, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  </div>
                )}

                {cenario === 'FATOR_DIAMETRO_METRO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Fator Financeiro (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={fator}
                        onChange={(e) => setFator(e.target.value)}
                        placeholder="2.85"
                        required
                        style={{ fontSize: '14px', fontWeight: 700, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Diâmetro do Furo (mm)
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={diametroMm}
                        onChange={(e) => setDiametroMm(e.target.value)}
                        placeholder="150"
                        required
                        style={{ fontSize: '14px', fontWeight: 700, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                )}

                {cenario === 'VALOR_FECHADO' && (
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Valor Global Fechado da Obra (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorFechado}
                      onChange={(e) => setValorFechado(e.target.value)}
                      placeholder="50000.00"
                      required
                      style={{ fontSize: '14px', fontWeight: 700, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  </div>
                )}

              </div>

            </form>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)'
          }}
        >
          {currentStep === 1 ? (
            <div>
              <button
                type="button"
                onClick={onClose}
                style={{ fontSize: '12.5px', color: 'var(--text-muted)', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="btn-secondary"
              style={{ fontSize: '12.5px', padding: '8px 16px' }}
            >
              ← Voltar ao Passo 1
            </button>
          )}

          {currentStep === 1 ? (
            <button
              type="submit"
              form="step1-form"
              className="btn-primary"
              style={{ fontSize: '13px', fontWeight: 700, padding: '9px 22px' }}
            >
              Avançar para Metas →
            </button>
          ) : (
            <button
              type="submit"
              form="step2-form"
              disabled={loading}
              className="btn-primary"
              style={{ fontSize: '13px', fontWeight: 700, padding: '9px 24px' }}
            >
              {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar Serviço'}
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};
