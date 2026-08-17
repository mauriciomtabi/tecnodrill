import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Servico, CenarioFinanceiro } from '../types';
import { X, Check, Search, ChevronDown, Calendar, TrendingUp, Clock } from 'lucide-react';

interface NovoServicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (servicoData: Partial<Servico>) => Promise<void>;
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
    if (!nome.trim() || !cliente.trim() || !cidade.trim()) {
      setFormError('Preencha os campos obrigatórios: Nome do Serviço, Cliente e Cidade.');
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
      const localCompleto = localizacao.trim() 
        ? `${cidade} - ${uf} • ${localizacao.trim()}`
        : `${cidade} - ${uf}`;

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
        meta_metros: mDia,
        status: 'EM_ANDAMENTO'
      });
      onClose();
      setCurrentStep(1);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar serviço.');
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

    // Calcular data estimada somando dias úteis
    const data = new Date();
    let diasAdicionados = 0;
    while (diasAdicionados < diasUteis) {
      data.setDate(data.getDate() + 1);
      const dayOfWeek = data.getDay();
      // 0 = Domingo, 6 = Sábado
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        diasAdicionados++;
      }
    }

    const dataFormatada = data.toLocaleDateString('pt-BR');
    return {
      diasUteis,
      dataFormatada
    };
  };

  const proj = calculateProjection();

  return createPortal(
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0,
        top: 0, 
        left: 0, 
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
        backdropFilter: 'blur(4px)',
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
          maxWidth: '680px', 
          backgroundColor: 'var(--bg-card)', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-color)', 
          padding: '24px', 
          maxHeight: '92vh', 
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          margin: 'auto'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Cadastrar Novo Serviço
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {currentStep === 1 ? 'Passo 1: Dados do Serviço e Localização' : 'Passo 2: Metragem, Meta Diária e Modelo Financeiro'}
            </span>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {formError && (
          <div style={{ backgroundColor: 'rgba(231,76,60,0.15)', color: '#FADBD8', border: '1px solid var(--danger)', padding: '10px', borderRadius: '4px', fontSize: '12px', marginBottom: '14px' }}>
            {formError}
          </div>
        )}

        {/* PASSO 1: DADOS GERAIS */}
        {currentStep === 1 ? (
          <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, color: 'var(--text-main)', fontSize: '11.5px' }}>
                NOME DO SERVIÇO *
              </label>
              <input 
                type="text" 
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                placeholder="ex: Canalização Av. Ana Costa" 
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, color: 'var(--text-main)', fontSize: '11.5px' }}>
                CLIENTE / CONTRATANTE *
              </label>
              <input 
                type="text" 
                value={cliente} 
                onChange={e => setCliente(e.target.value)} 
                placeholder="ex: Sabesp, Vale do Ouro, Comgás" 
                required
              />
            </div>

            {/* UF E CIDADE COM PESQUISA INTERATIVA */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px' }}>
              
              {/* CAMPO UF (Pesquisável) */}
              <div ref={ufContainerRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, color: 'var(--text-main)', fontSize: '11.5px' }}>
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
                    placeholder="UF..."
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      paddingRight: '28px'
                    }}
                    required
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
                      maxHeight: '180px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      marginTop: '4px',
                      zIndex: 1000,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                    }}
                  >
                    {filteredUfs.length === 0 ? (
                      <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>Nenhuma UF</div>
                    ) : (
                      filteredUfs.map((sigla) => (
                        <div
                          key={sigla}
                          onClick={() => handleSelectUf(sigla)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: uf === sigla ? 700 : 500,
                            backgroundColor: uf === sigla ? 'rgba(240, 90, 34, 0.15)' : 'transparent',
                            color: uf === sigla ? 'var(--primary)' : 'var(--text-main)',
                            borderBottom: '1px solid rgba(255,255,255,0.03)'
                          }}
                          className="hover:bg-white/5"
                        >
                          {sigla}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* CAMPO CIDADE (Pesquisável) */}
              <div ref={cidadeContainerRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 700, color: 'var(--text-main)', fontSize: '11.5px' }}>
                  CIDADE * {loadingCidades && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>(buscando no IBGE...)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={cidadeSearch}
                    onChange={(e) => {
                      setCidadeSearch(e.target.value);
                      setCidade(e.target.value);
                      setCidadeDropdownOpen(true);
                    }}
                    onFocus={() => setCidadeDropdownOpen(true)}
                    placeholder="Digite o nome da cidade..."
                    style={{ paddingRight: '28px' }}
                    required
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
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      marginTop: '4px',
                      zIndex: 1000,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                    }}
                  >
                    {filteredCidades.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Nenhuma cidade encontrada
                      </div>
                    ) : (
                      filteredCidades.slice(0, 100).map((cid) => (
                        <div
                          key={cid}
                          onClick={() => handleSelectCidade(cid)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: cidade === cid ? 700 : 500,
                            backgroundColor: cidade === cid ? 'rgba(240, 90, 34, 0.15)' : 'transparent',
                            color: cidade === cid ? 'var(--primary)' : 'var(--text-main)',
                            borderBottom: '1px solid rgba(255,255,255,0.03)'
                          }}
                          className="hover:bg-white/5"
                        >
                          {cid}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>
                ENDEREÇO / LOCALIZAÇÃO / RUA (OPCIONAL)
              </label>
              <input 
                type="text" 
                value={localizacao} 
                onChange={e => setLocalizacao(e.target.value)} 
                placeholder="ex: Rua Sol Nascente, altura do nº 450" 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>
                DESCRIÇÃO / OBSERVAÇÕES (OPCIONAL)
              </label>
              <input 
                type="text" 
                value={descricao} 
                onChange={e => setDescricao(e.target.value)} 
                placeholder="ex: Travessia sob rodovia com tubo PEAD 150mm" 
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={onClose} 
                style={{ color: 'var(--text-muted)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700 }}
              >
                Avançar para Passo 2 →
              </button>
            </div>
          </form>
        ) : (
          /* PASSO 2: METRAGEM TOTAL, META DIÁRIA E MODELO DE RETORNO */
          <form onSubmit={handleFinalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            
            {/* 1. METRAGEM TOTAL & META DIÁRIA COM INPUTS BEM DEFINIDOS */}
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Metragem Total da Obra */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                    1. METRAGEM TOTAL DA OBRA (METROS) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      step="any"
                      value={metragemPrevista} 
                      onChange={e => setMetragemPrevista(e.target.value)} 
                      placeholder="1000" 
                      required
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        color: 'var(--primary)',
                        backgroundColor: 'var(--bg-app)',
                        border: '2px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '10px 14px'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Comprimento total previsto em contrato
                  </span>
                </div>

                {/* Meta Diária de Produção */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                    2. META DIÁRIA DE PRODUÇÃO (METROS/DIA) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      step="any"
                      value={metaDiaria} 
                      onChange={e => setMetaDiaria(e.target.value)} 
                      placeholder="100" 
                      required
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        color: 'var(--success)',
                        backgroundColor: 'var(--bg-app)',
                        border: '2px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '10px 14px'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Meta por dia para disparar a comemoração 🎉
                  </span>
                </div>
              </div>

              {/* INFORMATIVO DE PROJEÇÃO DE TÉRMINO */}
              {proj && (
                <div 
                  style={{
                    backgroundColor: 'rgba(41, 128, 168, 0.12)',
                    border: '1px solid rgba(41, 128, 168, 0.3)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(41, 128, 168, 0.2)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={16} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    Projeção de término do serviço: <strong style={{ color: 'var(--primary-light)' }}>{proj.diasUteis} dias úteis</strong> de trabalho (estimativa de conclusão para <strong>{proj.dataFormatada}</strong>).
                  </div>
                </div>
              )}

            </div>

            {/* 2. MODELO DE RETORNO FINANCEIRO (3 CARDS VISUAIS) */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '12px', color: 'var(--text-main)' }}>
                3. MODELO DE RETORNO FINANCEIRO
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                
                {/* Opção 1: Valor por Metro */}
                <div
                  onClick={() => setCenario('VALOR_METRO')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: cenario === 'VALOR_METRO' ? 'rgba(240, 90, 34, 0.12)' : 'var(--bg-input)',
                    border: `2px solid ${cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12px', color: cenario === 'VALOR_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      1. Valor por Metro
                    </strong>
                    {cenario === 'VALOR_METRO' && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Multiplica os metros pelo valor fixo em contrato (R$/m).
                  </p>
                </div>

                {/* Opção 2: (Fator x Diâmetro) x m */}
                <div
                  onClick={() => setCenario('FATOR_DIAMETRO_METRO')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: cenario === 'FATOR_DIAMETRO_METRO' ? 'rgba(240, 90, 34, 0.12)' : 'var(--bg-input)',
                    border: `2px solid ${cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--border-color)'}`,
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12px', color: cenario === 'FATOR_DIAMETRO_METRO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      2. (Fator × Diâmetro)
                    </strong>
                    {cenario === 'FATOR_DIAMETRO_METRO' && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Fator financeiro multiplicado pelo diâmetro do tubo e metros.
                  </p>
                </div>

                {/* Opção 3: Valor Fechado */}
                <div
                  onClick={() => setCenario('VALOR_FECHADO')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: cenario === 'VALOR_FECHADO' ? 'rgba(240, 90, 34, 0.12)' : 'var(--bg-input)',
                    border: `2px solid ${cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--border-color)'}`,
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12px', color: cenario === 'VALOR_FECHADO' ? 'var(--primary)' : 'var(--text-main)' }}>
                      3. Valor Fechado
                    </strong>
                    {cenario === 'VALOR_FECHADO' && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Valor total fixo acordado para a obra inteira.
                  </p>
                </div>

              </div>

              {/* Inputs específicos do modelo selecionado com bordas claras */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {cenario === 'VALOR_METRO' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                      VALOR DO METRO (R$/METRO) *
                    </label>
                    <input 
                      type="number" 
                      step="any" 
                      value={valorMetro} 
                      onChange={e => setValorMetro(e.target.value)} 
                      placeholder="ex: 180.00" 
                      required 
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        border: '2px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: 700,
                        padding: '10px 14px'
                      }}
                    />
                  </div>
                )}

                {cenario === 'FATOR_DIAMETRO_METRO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                        FATOR FINANCEIRO (R$) *
                      </label>
                      <input 
                        type="number" 
                        step="any" 
                        value={fator} 
                        onChange={e => setFator(e.target.value)} 
                        placeholder="ex: 2.85" 
                        required 
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '2px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '15px',
                          fontWeight: 700,
                          padding: '10px 14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                        DIÂMETRO DO TUBO (MM) *
                      </label>
                      <input 
                        type="number" 
                        step="any" 
                        value={diametroMm} 
                        onChange={e => setDiametroMm(e.target.value)} 
                        placeholder="ex: 150" 
                        required 
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '2px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '15px',
                          fontWeight: 700,
                          padding: '10px 14px'
                        }}
                      />
                    </div>
                  </div>
                )}

                {cenario === 'VALOR_FECHADO' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                      VALOR TOTAL FECHADO DO CONTRATO (R$) *
                    </label>
                    <input 
                      type="number" 
                      step="any" 
                      value={valorFechado} 
                      onChange={e => setValorFechado(e.target.value)} 
                      placeholder="ex: 50000.00" 
                      required 
                      style={{
                        backgroundColor: 'var(--bg-app)',
                        border: '2px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontWeight: 700,
                        padding: '10px 14px'
                      }}
                    />
                  </div>
                )}

                {/* Previsão do valor unitário */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Retorno estimado por metro executado:</span>
                  <strong style={{ color: 'var(--success)', fontSize: '14px' }}>
                    R$ {valorUnitarioEstimado().toFixed(2)} / metro
                  </strong>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                type="button" 
                onClick={() => setCurrentStep(1)} 
                style={{ color: 'var(--text-muted)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Voltar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '13px', fontWeight: 700 }}
              >
                {loading ? 'Cadastrando...' : 'Finalizar Cadastro do Serviço'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
