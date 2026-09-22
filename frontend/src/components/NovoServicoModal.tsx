import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Servico, CenarioFinanceiro, Usuario, TipoServico } from '../types';
import { ApiService, sanitizeLocalidade } from '../services/api';
import { generateWatermarkPreview } from '../utils/watermark';
import { useModalBackButton } from '../hooks/useModalBackButton';
import { X, Check, Search, ChevronDown, Calendar, TrendingUp, Clock, Edit, UserCheck, HardHat, Upload, Eye, Image as ImageIcon, Minus, Plus } from 'lucide-react';

interface NovoServicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (servicoData: Partial<Servico>) => Promise<void>;
  initialData?: Servico | null;
  loading?: boolean;
}

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

export const UFS_LIST = ESTADOS_BRASIL.map(e => e.sigla);


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
  const [logoCliente, setLogoCliente] = useState<string | null>(null);
  const [logoEscala, setLogoEscala] = useState<number>(1.0);
  const [showWatermarkPreviewModal, setShowWatermarkPreviewModal] = useState<boolean>(false);
  const [previewWatermarkUrl, setPreviewWatermarkUrl] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Trata botão nativo de voltar do celular
  useModalBackButton(
    isOpen, 
    showWatermarkPreviewModal ? () => setShowWatermarkPreviewModal(false) : onClose, 
    'novoServico'
  );
  
  // UF State
  const [uf, setUf] = useState('SP');
  const [ufSearch, setUfSearch] = useState('SP');


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
  const [tipoServico, setTipoServico] = useState<TipoServico>('TELECOM');
  const [minFotosRegistro, setMinFotosRegistro] = useState('2');
  const [osObrigatoria, setOsObrigatoria] = useState(false);

  // Projeção de Custos Diários
  const [custoEquipeDiario, setCustoEquipeDiario] = useState('0');
  const [custoCombustivelDiario, setCustoCombustivelDiario] = useState('0');
  const [custoEquipamentoDiario, setCustoEquipamentoDiario] = useState('0');
  const [custoOutrosDiario, setCustoOutrosDiario] = useState('0');

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
          if (initialData) {
            const nav = data.find(u => u.id === initialData.navegador_id || (initialData.navegador_nome && u.nome.toLowerCase() === initialData.navegador_nome.toLowerCase()));
            if (nav) setNavegadorId(nav.id);
            else if (initialData.navegador_id) setNavegadorId(initialData.navegador_id);

            const op = data.find(u => u.id === initialData.operador_id || (initialData.operador_nome && u.nome.toLowerCase() === initialData.operador_nome.toLowerCase()));
            if (op) setOperadorId(op.id);
            else if (initialData.operador_id) setOperadorId(initialData.operador_id);
          } else {
            const nav = data.find(u => u.perfil === 'NAVEGADOR');
            if (nav) setNavegadorId(nav.id);
            const op = data.find(u => u.perfil === 'OPERADOR');
            if (op) setOperadorId(op.id);
          }
        })
        .catch(err => console.error('Erro ao carregar usuários:', err));
    }
  }, [isOpen, initialData]);

  // Carregar dados iniciais ao abrir para edição ou resetar para novo cadastro
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNome(initialData.nome || '');
        setCliente(initialData.cliente || '');
        setLogoCliente(initialData.logo_cliente || null);
        setLogoEscala(initialData.logo_escala ? Number(initialData.logo_escala) : 1.0);
        
        let defaultTipo: TipoServico = 'TELECOM';
        if (initialData.nome && initialData.nome.toUpperCase().includes('SANEAMENTO')) {
          defaultTipo = 'SANEAMENTO';
        } else if (initialData.nome && initialData.nome.toUpperCase().includes('RODOVIA')) {
          defaultTipo = 'RODOVIA';
        }
        setTipoServico(initialData.tipo_servico || defaultTipo);

        setMinFotosRegistro(String(initialData.min_fotos_registro || 2));
        setOsObrigatoria(initialData.os_obrigatoria ?? (initialData.tipo_servico === 'SANEAMENTO'));
        setCustoEquipeDiario(String(initialData.custo_equipe_diario || 0));
        setCustoCombustivelDiario(String(initialData.custo_combustivel_diario || 0));
        setCustoEquipamentoDiario(String(initialData.custo_equipamento_diario || 0));
        setCustoOutrosDiario(String(initialData.custo_outros_diario || 0));
        setDescricao(initialData.descricao || '');

        // Recuperar UF e Cidade do initialData ou analisar o campo local ("Cidade - UF • Detalhes")
        let initUf = (initialData.uf || '').trim().toUpperCase();
        let initCidade = (initialData.cidade || '').trim();
        let initLocal = sanitizeLocalidade(initialData.local, initCidade, initUf);

        if (!initUf || !initCidade) {
          // Extrair todas as ocorrências de "Cidade - UF" no texto local
          const matches = Array.from(initLocal.matchAll(/([^-•\n]+?)\s*-\s*([A-Za-z]{2})/g));
          if (matches.length > 0) {
            // Se houver mais de uma, pega a última ocorrência legítima
            const last = matches[matches.length - 1];
            if (!initCidade) initCidade = last[1].trim();
            if (!initUf) initUf = last[2].trim().toUpperCase();
          }
        }

        const finalUf = initUf || 'SP';
        const finalCidade = initCidade || '';

        setUf(finalUf);
        setUfSearch(finalUf);
        setCidade(finalCidade);
        setCidadeSearch(finalCidade);

        // Remove repetições de "Cidade - UF" da localizacao interna para não acumular
        let cleanDetail = initLocal;
        if (finalCidade && finalUf) {
          const pattern = new RegExp(`${finalCidade}\\s*-\\s*${finalUf}`, 'gi');
          cleanDetail = cleanDetail.replace(pattern, '');
        }
        cleanDetail = cleanDetail
          .split('•')
          .map(p => p.trim())
          .filter(Boolean)
          .join(' • ');

        setLocalizacao(cleanDetail);

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
        setLogoCliente(null);
        setLogoEscala(1.0);
        setTipoServico('TELECOM');
        setMinFotosRegistro('2');
        setOsObrigatoria(false);
        setCustoEquipeDiario('0');
        setCustoCombustivelDiario('0');
        setCustoEquipamentoDiario('0');
        setCustoOutrosDiario('0');
        setUf('SP');
        setUfSearch('SP');
        setCidade('');
        setCidadeSearch('');
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
      setShowWatermarkPreviewModal(false);
    }
  }, [isOpen, initialData]);

  // Carregar cidades do IBGE sempre que a UF mudar
  useEffect(() => {
    if (!uf) return;
    setLoadingCidades(true);
    let isMounted = true;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (Array.isArray(data)) {
          const names = data.map((c: any) => c.nome).sort((a: string, b: string) => a.localeCompare(b));
          setCidadesList(names);
          // Jamais sobrescrever a cidade existente se ela já tiver sido informada
          setCidade(current => (current && current.trim() !== '' ? current : ''));
          setCidadeSearch(current => (current && current.trim() !== '' ? current : ''));
        }
      })
      .catch(() => {
        if (isMounted) setCidadesList(['São Paulo', 'Santos', 'Campinas', 'Guarulhos', 'São Bernardo do Campo']);
      })
      .finally(() => {
        if (isMounted) setLoadingCidades(false);
      });

    return () => { isMounted = false; };
  }, [uf]);

  // Fechar dropdown de cidades ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cidadeContainerRef.current && !cidadeContainerRef.current.contains(event.target as Node)) {
        setCidadeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSelectCidade = (selectedCidade: string) => {
    setCidade(selectedCidade);
    setCidadeSearch(selectedCidade);
    setCidadeDropdownOpen(false);
  };


  const filteredCidades = cidadesList.filter(c => 
    c.toLowerCase().includes(cidadeSearch.toLowerCase())
  );

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoCliente(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewWatermark = async (overrideScale?: number) => {
    const scaleToUse = overrideScale !== undefined ? overrideScale : logoEscala;
    setLoadingPreview(true);
    setShowWatermarkPreviewModal(true);
    try {
      const preview = await generateWatermarkPreview(
        logoCliente || null,
        (cidade || cidadeSearch).trim() || 'Novo Hamburgo',
        (uf || 'RS').trim().toUpperCase(),
        scaleToUse
      );
      setPreviewWatermarkUrl(preview);
    } catch (err) {
      console.error('Erro ao gerar preview da marca d água:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUpdateLogoEscala = async (newScale: number) => {
    const clamped = Math.max(0.4, Math.min(3.0, Number(newScale.toFixed(2))));
    setLogoEscala(clamped);
    if (showWatermarkPreviewModal) {
      try {
        const preview = await generateWatermarkPreview(
          logoCliente || null,
          (cidade || cidadeSearch).trim() || 'Novo Hamburgo',
          (uf || 'RS').trim().toUpperCase(),
          clamped
        );
        setPreviewWatermarkUrl(preview);
      } catch (err) {
        console.error('Erro ao atualizar preview com nova escala:', err);
      }
    }
  };

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

    const navObj = usuarios.find(u => u.id === navegadorId || (navegadorId && u.nome.toLowerCase() === navegadorId.toLowerCase()));
    const opObj = usuarios.find(u => u.id === operadorId || (operadorId && u.nome.toLowerCase() === operadorId.toLowerCase()));

    const navIdFinal = navObj?.id || navegadorId || undefined;
    const navNomeFinal = navObj?.nome || (navegadorId && !navObj ? navegadorId : undefined);
    const opIdFinal = opObj?.id || operadorId || undefined;
    const opNomeFinal = opObj?.nome || (operadorId && !opObj ? operadorId : undefined);

    try {
      const finalUf = (uf || 'SP').trim().toUpperCase();
      const finalCidade = (cidade || cidadeSearch).trim();

      // Remove repetições de cidade - uf do detalhe complementar
      let cleanDetail = (localizacao || '');
      if (finalCidade && finalUf) {
        cleanDetail = cleanDetail.replace(new RegExp(`${finalCidade}\\s*-\\s*${finalUf}`, 'gi'), '');
      }
      cleanDetail = cleanDetail
        .split('•')
        .map(p => p.trim())
        .filter(Boolean)
        .join(' • ');

      const rawLocal = finalCidade 
        ? `${finalCidade} - ${finalUf}${cleanDetail ? ` • ${cleanDetail}` : ''}`
        : cleanDetail || 'Brasil';

      const localCompleto = sanitizeLocalidade(rawLocal, finalCidade, finalUf);

      await onSave({
        nome: nome.toUpperCase().trim(),
        cliente: cliente.trim(),
        logo_cliente: logoCliente || undefined,
        logo_escala: logoEscala,
        local: localCompleto,
        cidade: finalCidade || undefined,
        uf: finalUf,
        descricao: descricao.trim() || undefined,
        tipo_servico: tipoServico,
        min_fotos_registro: Math.max(1, Number(minFotosRegistro) || 2),
        os_obrigatoria: osObrigatoria,
        navegador_id: navIdFinal,
        navegador_nome: navNomeFinal,
        operador_id: opIdFinal,
        operador_nome: opNomeFinal,
        cenario_financeiro: cenario,
        valor_metro: Number(valorMetro) || 0,
        fator_financeiro: Number(fator) || 0,
        diametro_furo_mm: 0,
        valor_total_fechado: Number(valorFechado) || 0,
        metragem_prevista_total: mTotal,
        tipo_meta: 'DIARIA',
        meta_metros: mDia,
        custo_equipe_diario: Number(custoEquipeDiario) || 0,
        custo_combustivel_diario: Number(custoCombustivelDiario) || 0,
        custo_equipamento_diario: Number(custoEquipamentoDiario) || 0,
        custo_outros_diario: Number(custoOutrosDiario) || 0
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

  const custoDiarioTotal = () => {
    return (Number(custoEquipeDiario) || 0) + 
           (Number(custoCombustivelDiario) || 0) + 
           (Number(custoEquipamentoDiario) || 0) + 
           (Number(custoOutrosDiario) || 0);
  };

  const diasEstimadosObra = () => {
    const mTotal = Number(metragemPrevista) || 1;
    const mDia = Number(metaDiaria) || 100;
    return Math.max(1, Math.ceil(mTotal / (mDia > 0 ? mDia : 100)));
  };

  const custoTotalProjetado = () => {
    return custoDiarioTotal() * diasEstimadosObra();
  };

  const margemEstimada = () => {
    return retornoPrevistoTotal() - custoTotalProjetado();
  };

  const margemPercentual = () => {
    const ret = retornoPrevistoTotal();
    if (ret <= 0) return 0;
    return (margemEstimada() / ret) * 100;
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

              {/* LOGO DO CLIENTE (OPCIONAL) PARA MARCA D'ÁGUA */}
              <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                border: '1px dashed var(--border-color)', 
                borderRadius: '8px', 
                padding: '12px 14px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={14} color="var(--primary)" />
                    Logo do Cliente na Marca d'Água (Opcional)
                  </label>
                  {logoCliente && (
                    <button
                      type="button"
                      onClick={() => setLogoCliente(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remover Logo
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {logoCliente ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      backgroundColor: '#fff', 
                      padding: '6px 10px', 
                      borderRadius: '6px' 
                    }}>
                      <img 
                        src={logoCliente} 
                        alt="Logo Cliente" 
                        style={{ maxHeight: '36px', maxWidth: '120px', objectFit: 'contain' }} 
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Padrão: Logo TecnoDrill será utilizado nas fotos de campo.
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <label 
                      className="btn-secondary" 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        cursor: 'pointer', 
                        fontSize: '11.5px', 
                        padding: '6px 12px',
                        margin: 0
                      }}
                    >
                      <Upload size={13} />
                      <span>{logoCliente ? 'Alterar Logo' : 'Enviar Logo (.png, .jpg)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        style={{ display: 'none' }} 
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handlePreviewWatermark()}
                      disabled={loadingPreview}
                      className="btn-secondary"
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '11.5px', 
                        padding: '6px 12px',
                        borderColor: 'var(--primary)',
                        color: 'var(--primary)'
                      }}
                    >
                      <Eye size={13} />
                      <span>{loadingPreview ? 'Gerando...' : 'Visualizar Marca d\'Água'}</span>
                    </button>
                  </div>
                </div>

                {/* Controles de Escala / Tamanho do Logo no Passo 1 */}
                {logoCliente && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                        Tamanho da Logo na Imagem:
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>
                        {Math.round(logoEscala * 100)}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateLogoEscala(logoEscala - 0.1)}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '12px', lineHeight: 1 }}
                        title="Diminuir"
                      >
                        <Minus size={13} />
                      </button>

                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.05"
                        value={logoEscala}
                        onChange={(e) => handleUpdateLogoEscala(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />

                      <button
                        type="button"
                        onClick={() => handleUpdateLogoEscala(logoEscala + 0.1)}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '12px', lineHeight: 1 }}
                        title="Aumentar"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {[
                        { label: 'Pequeno (70%)', val: 0.7 },
                        { label: 'Normal (100%)', val: 1.0 },
                        { label: 'Médio (140%)', val: 1.4 },
                        { label: 'Grande (180%)', val: 1.8 },
                        { label: 'Extra Grande (220%)', val: 2.2 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => handleUpdateLogoEscala(preset.val)}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '3px 7px',
                            borderRadius: '4px',
                            border: Math.abs(logoEscala - preset.val) < 0.05 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: Math.abs(logoEscala - preset.val) < 0.05 ? 'rgba(240, 90, 34, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            color: Math.abs(logoEscala - preset.val) < 0.05 ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TIPO DE SERVIÇO E MÍNIMO DE FOTOS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tipo de Serviço *
                  </label>
                  <select
                    value={tipoServico}
                    onChange={(e) => setTipoServico(e.target.value as TipoServico)}
                    style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                    required
                  >
                    <option value="SANEAMENTO">💧 Saneamento</option>
                    <option value="RODOVIA">🛣️ Rodovia</option>
                    <option value="TELECOM">📡 Telecom</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Mínimo Fotos / Registro *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={minFotosRegistro}
                    onChange={(e) => setMinFotosRegistro(e.target.value)}
                    placeholder="2"
                    required
                    style={{ fontSize: '13px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                  />
                </div>
              </div>

              {/* OBRIGATORIEDADE DE NÚMERO DE OS */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Nº da OS no Formulário de Campo
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {osObrigatoria ? '⚠️ Obrigatório: técnicos devem informar a OS para cada registro.' : 'Opcional: técnicos podem registrar sem preencher a OS.'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setOsObrigatoria(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      border: !osObrigatoria ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: !osObrigatoria ? 'rgba(240, 90, 34, 0.15)' : 'transparent',
                      color: !osObrigatoria ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Opcional
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsObrigatoria(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      border: osObrigatoria ? '1.5px solid var(--danger)' : '1px solid var(--border-color)',
                      backgroundColor: osObrigatoria ? 'rgba(231, 76, 60, 0.15)' : 'transparent',
                      color: osObrigatoria ? '#FF7675' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Obrigatório *
                  </button>
                </div>
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

              {/* UF e Cidade do IBGE */}
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                
                {/* Campo UF */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    UF *
                  </label>
                  <select
                    value={uf}
                    onChange={(e) => {
                      const selectedUf = e.target.value;
                      setUf(selectedUf);
                      setUfSearch(selectedUf);
                      if (selectedUf !== uf) {
                        setCidade('');
                        setCidadeSearch('');
                      }
                    }}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '10px 8px',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                    required
                  >
                    {ESTADOS_BRASIL.map(item => (
                      <option 
                        key={item.sigla} 
                        value={item.sigla}
                        style={{ backgroundColor: '#0D1C24', color: 'var(--text-main)' }}
                      >
                        {item.sigla} - {item.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campo Cidade */}
                <div ref={cidadeContainerRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    CIDADE *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={cidadeSearch}
                      onChange={(e) => {
                        setCidade(e.target.value);
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
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      💡 O diâmetro do furo/tubulação será informado pelo técnico em cada registro de campo.
                    </span>
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

              {/* SESSÃO: PROJEÇÃO DE CUSTOS E MARGEM */}
              <div style={{ 
                marginTop: '14px',
                backgroundColor: 'var(--bg-app)', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: '#E67E22', textTransform: 'uppercase' }}>
                    <span>📉</span> Projeção de Custos Diários
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ~{diasEstimadosObra()} dias previstos
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      EQUIPE (R$/DIA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoEquipeDiario}
                      onChange={(e) => setCustoEquipeDiario(e.target.value)}
                      placeholder="0.00"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      COMBUSTÍVEL (R$/DIA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoCombustivelDiario}
                      onChange={(e) => setCustoCombustivelDiario(e.target.value)}
                      placeholder="0.00"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      EQUIPAMENTO / LOCAÇÃO (R$/DIA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoEquipamentoDiario}
                      onChange={(e) => setCustoEquipamentoDiario(e.target.value)}
                      placeholder="0.00"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', padding: '8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      OUTROS CUSTOS (R$/DIA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoOutrosDiario}
                      onChange={(e) => setCustoOutrosDiario(e.target.value)}
                      placeholder="0.00"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', padding: '8px' }}
                    />
                  </div>
                </div>

                {/* Resumo Financeiro Consolidado: Custo Total, Receita e Margem */}
                <div style={{ 
                  marginTop: '14px', 
                  paddingTop: '12px', 
                  borderTop: '1px dashed var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Custo Diário Total:</span>
                    <strong style={{ color: '#E67E22' }}>
                      R$ {custoDiarioTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Custo Projetado Total (~{diasEstimadosObra()} dias):</span>
                    <strong style={{ color: '#E74C3C' }}>
                      R$ {custoTotalProjetado().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    fontSize: '13px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: margemEstimada() >= 0 ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                    border: `1px solid ${margemEstimada() >= 0 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      Margem Estimada ({margemPercentual().toFixed(1)}%):
                    </span>
                    <strong style={{ 
                      fontSize: '15px', 
                      fontWeight: 900, 
                      color: margemEstimada() >= 0 ? 'var(--success)' : 'var(--danger)' 
                    }}>
                      R$ {margemEstimada().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
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

        {/* MODAL DE PREVIEW DA MARCA D'ÁGUA */}
        {showWatermarkPreviewModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '16px'
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '620px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Pré-visualização da Marca d'Água
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {logoCliente ? 'Exibindo com Logo Personalizado do Cliente' : 'Exibindo com Logo Padrão da TecnoDrill'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWatermarkPreviewModal(false)}
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '20px', textAlign: 'center', overflowY: 'auto' }}>
                {previewWatermarkUrl ? (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'inline-block', maxWidth: '100%' }}>
                    <img 
                      src={previewWatermarkUrl} 
                      alt="Pré-visualização da Marca d'Água" 
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '50vh', objectFit: 'contain' }} 
                    />
                  </div>
                ) : (
                  <div style={{ padding: '30px', color: 'var(--text-muted)' }}>
                    Carregando pré-visualização...
                  </div>
                )}
              </div>

              {/* Controles Interativos para Aumentar / Diminuir tamanho do Logo */}
              <div
                style={{
                  margin: '0 20px 16px 20px',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                      Ajustar Tamanho da Logo:
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', minWidth: '46px' }}>
                      {Math.round(logoEscala * 100)}%
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Visualização em tempo real
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleUpdateLogoEscala(logoEscala - 0.1)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '13px', lineHeight: 1 }}
                    title="Diminuir"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={logoEscala}
                    onChange={(e) => handleUpdateLogoEscala(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />

                  <button
                    type="button"
                    onClick={() => handleUpdateLogoEscala(logoEscala + 0.1)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '13px', lineHeight: 1 }}
                    title="Aumentar"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Atalhos rápidos */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Pequeno (70%)', val: 0.7 },
                    { label: 'Normal (100%)', val: 1.0 },
                    { label: 'Médio (140%)', val: 1.4 },
                    { label: 'Grande (180%)', val: 1.8 },
                    { label: 'Extra Grande (220%)', val: 2.2 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleUpdateLogoEscala(preset.val)}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: Math.abs(logoEscala - preset.val) < 0.05 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: Math.abs(logoEscala - preset.val) < 0.05 ? 'rgba(240, 90, 34, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: Math.abs(logoEscala - preset.val) < 0.05 ? 'var(--primary)' : 'var(--text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowWatermarkPreviewModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '12px' }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
