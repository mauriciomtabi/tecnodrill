import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Veiculo,
  TipoVeiculo,
  Servico,
  PlanoPreventiva,
  DocumentoVeiculo,
  EspecificacoesVeiculo,
} from '../types';
import { ManutencaoService } from '../services/manutencaoService';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Camera,
  FileText,
  Trash2,
  Star,
  Plus,
  Wrench,
  Save,
} from 'lucide-react';

interface VeiculoFormModalProps {
  isOpen: boolean;
  veiculo?: Veiculo | null;
  servicos: Servico[];
  planos: PlanoPreventiva[];
  onClose: () => void;
  onSaved: (veiculo: Veiculo) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const VeiculoFormModal: React.FC<VeiculoFormModalProps> = ({
  isOpen,
  veiculo,
  servicos,
  planos,
  onClose,
  onSaved,
}) => {
  const { showToast } = useAuth();
  const isEdit = Boolean(veiculo?.id);

  const [tipo, setTipo] = useState<TipoVeiculo>('PERFURATRIZ');
  const [nome, setNome] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [placa, setPlaca] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [leituraAtual, setLeituraAtual] = useState('0');
  const [servicoId, setServicoId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [fotoPrincipal, setFotoPrincipal] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoVeiculo[]>([]);
  const [specs, setSpecs] = useState<EspecificacoesVeiculo>({});
  const [planoInicialId, setPlanoInicialId] = useState('');

  const [novoDocTipo, setNovoDocTipo] = useState('CRLV');
  const [novoDocValidade, setNovoDocValidade] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (veiculo) {
      setTipo(veiculo.tipo);
      setNome(veiculo.nome || '');
      setCodigoInterno(veiculo.codigo_interno || '');
      setMarca(veiculo.marca || '');
      setModelo(veiculo.modelo || '');
      setAno(veiculo.ano ? String(veiculo.ano) : '');
      setPlaca(veiculo.placa || '');
      setNumeroSerie(veiculo.numero_serie || '');
      setLeituraAtual(String(veiculo.leitura_atual ?? 0));
      setServicoId(veiculo.servico_id || '');
      setObservacoes(veiculo.observacoes || '');
      setFotoPrincipal(veiculo.foto_principal_url || '');
      setFotos(veiculo.fotos || []);
      setDocumentos(veiculo.documentos || []);
      setSpecs(veiculo.especificacoes || {});
      setPlanoInicialId('');
    } else {
      setTipo('PERFURATRIZ');
      setNome('');
      setCodigoInterno('');
      setMarca('');
      setModelo('');
      setAno('');
      setPlaca('');
      setNumeroSerie('');
      setLeituraAtual('0');
      setServicoId('');
      setObservacoes('');
      setFotoPrincipal('');
      setFotos([]);
      setDocumentos([]);
      setSpecs({});
      const defaultPlano = planos.find((p) => p.tipo_veiculo === 'PERFURATRIZ');
      setPlanoInicialId(defaultPlano?.id || '');
    }
  }, [isOpen, veiculo, planos]);

  useEffect(() => {
    if (!isEdit && isOpen) {
      const match = planos.find((p) => p.tipo_veiculo === tipo);
      setPlanoInicialId(match?.id || '');
    }
  }, [tipo, isEdit, isOpen, planos]);

  if (!isOpen) return null;

  const handleAddFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const converted = await Promise.all(files.map(fileToBase64));
      setFotos((prev) => {
        const next = [...prev, ...converted];
        if (!fotoPrincipal && next.length > 0) {
          setFotoPrincipal(next[0]);
        }
        return next;
      });
    } catch {
      showToast('Erro ao carregar foto(s).', 'error');
    }
    e.target.value = '';
  };

  const handleRemoveFoto = (url: string) => {
    setFotos((prev) => {
      const filtered = prev.filter((f) => f !== url);
      if (fotoPrincipal === url) {
        setFotoPrincipal(filtered[0] || '');
      }
      return filtered;
    });
  };

  const handleUploadDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const pasta = veiculo?.id || `temp_${Date.now()}`;
      const url = await ManutencaoService.uploadArquivoFrota(file, pasta, `doc_${novoDocTipo.toLowerCase()}`);
      const novoDoc: DocumentoVeiculo = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nome: file.name,
        tipo: novoDocTipo,
        url,
        validade: novoDocValidade || undefined,
        criado_em: new Date().toISOString(),
      };
      setDocumentos((prev) => [...prev, novoDoc]);
      setNovoDocValidade('');
      showToast('Documento anexado!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao anexar documento.', 'error');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      showToast('Informe o nome/identificação do veículo.', 'error');
      return;
    }

    setSaving(true);
    try {
      const saved = await ManutencaoService.saveVeiculo({
        id: veiculo?.id,
        tipo,
        nome: nome.trim(),
        codigo_interno: codigoInterno,
        marca,
        modelo,
        ano: ano ? Number(ano) : null,
        placa,
        numero_serie: numeroSerie,
        leitura_atual: Number(leituraAtual || 0),
        servico_id: servicoId || null,
        foto_principal_url: fotoPrincipal,
        fotos,
        documentos,
        especificacoes: specs,
        observacoes,
      });

      if (!isEdit && planoInicialId) {
        const plano = planos.find((p) => p.id === planoInicialId);
        if (plano && plano.itens.length > 0) {
          await ManutencaoService.aplicarPlanoAoVeiculo(
            saved.id,
            plano.itens,
            Number(leituraAtual || 0)
          );
        }
      }

      showToast(
        isEdit ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!',
        'success'
      );
      onSaved(saved);
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar veículo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const planosCompativeis = planos.filter((p) => p.tipo_veiculo === tipo);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '9px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    fontSize: '13.5px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '5px',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          padding: '22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
            {isEdit ? 'Editar Veículo / Equipamento' : 'Novo Veículo / Equipamento'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', color: 'var(--text-muted)', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Tipo e Identificação */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Tipo *</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoVeiculo)}
                disabled={isEdit}
                style={inputStyle}
              >
                <option value="PERFURATRIZ">Perfuratriz (Horímetro)</option>
                <option value="CAMINHAO">Caminhão (Km)</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Nome / Identificação *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={tipo === 'PERFURATRIZ' ? 'Ex: Perfuratriz Vermeer D24x40 #01' : 'Ex: Caminhão Munck MB 1620'}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Código Interno / Frota</label>
              <input type="text" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} placeholder="Ex: PF-01" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Marca</label>
              <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Vermeer / Mercedes" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Modelo</label>
              <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex: D24x40 S3" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ano</label>
              <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2022" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>{tipo === 'CAMINHAO' ? 'Placa' : 'Placa (se houver)'}</label>
              <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC1D23" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nº de Série / Chassi</label>
              <input type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="Opcional" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                {tipo === 'PERFURATRIZ' ? 'Horímetro Atual (h) *' : 'Odômetro Atual (km) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={leituraAtual}
                onChange={(e) => setLeituraAtual(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Obra / Serviço Alocado</label>
              <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} style={inputStyle}>
                <option value="">Sem obra vinculada (Base/Pátio)</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.cliente})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Aplicar Plano Padrão na Criação */}
          {!isEdit && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(240, 90, 34, 0.08)',
                border: '1px solid rgba(240, 90, 34, 0.25)',
              }}
            >
              <label style={{ ...labelStyle, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wrench size={14} /> Aplicar Plano Padrão de Preventiva ao Cadastrar
              </label>
              <select
                value={planoInicialId}
                onChange={(e) => setPlanoInicialId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Não aplicar plano agora (configurar manualmente depois)</option>
                {planosCompativeis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.itens.length} itens)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fotos do Veículo */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Fotos do Veículo
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Adicione foto de capa e galeria (clique na estrela para definir a foto principal).
                </div>
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '9px',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Camera size={15} />
                Adicionar Fotos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleAddFotos}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {fotos.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                Nenhuma foto adicionada ainda.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '10px' }}>
                {fotos.map((url, idx) => {
                  const isCapa = url === fotoPrincipal;
                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        aspectRatio: '4/3',
                        border: isCapa ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      }}
                    >
                      <img src={url} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setFotoPrincipal(url)}
                        title="Definir como foto principal"
                        style={{
                          position: 'absolute',
                          top: '5px',
                          left: '5px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: isCapa ? 'var(--primary)' : 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Star size={13} fill={isCapa ? '#fff' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFoto(url)}
                        title="Remover foto"
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(231, 76, 60, 0.85)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documentos Anexos */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Documentos (CRLV, Seguro, Manual, Notas)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
              <select
                value={novoDocTipo}
                onChange={(e) => setNovoDocTipo(e.target.value)}
                style={{ ...inputStyle, width: '140px' }}
              >
                <option value="CRLV">CRLV</option>
                <option value="SEGURO">Seguro</option>
                <option value="MANUAL">Manual</option>
                <option value="NOTA">Nota Fiscal</option>
                <option value="OUTRO">Outro</option>
              </select>
              <input
                type="date"
                value={novoDocValidade}
                onChange={(e) => setNovoDocValidade(e.target.value)}
                title="Validade (opcional)"
                style={{ ...inputStyle, width: '160px' }}
              />
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  borderRadius: '9px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: uploadingDoc ? 'wait' : 'pointer',
                }}
              >
                <Plus size={15} />
                {uploadingDoc ? 'Enviando...' : 'Anexar PDF/Foto'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadingDoc}
                  onChange={handleUploadDocumento}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {documentos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {documentos.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12.5px',
                    }}
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600 }}
                    >
                      <FileText size={15} />
                      <span>[{doc.tipo}] {doc.nome}</span>
                      {doc.validade && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>• Val: {doc.validade}</span>}
                    </a>
                    <button
                      type="button"
                      onClick={() => setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))}
                      style={{ background: 'transparent', color: '#E74C3C', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Especificações Técnicas */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
              Especificações Técnicas (Óleos e Filtros)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Óleo do Motor</label>
                <input
                  type="text"
                  value={specs.oleo_motor || ''}
                  onChange={(e) => setSpecs({ ...specs, oleo_motor: e.target.value })}
                  placeholder="Ex: 15W40"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Óleo Hidráulico</label>
                <input
                  type="text"
                  value={specs.oleo_hidraulico || ''}
                  onChange={(e) => setSpecs({ ...specs, oleo_hidraulico: e.target.value })}
                  placeholder="Ex: ISO VG 68"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Filtro de Óleo</label>
                <input
                  type="text"
                  value={specs.filtro_oleo || ''}
                  onChange={(e) => setSpecs({ ...specs, filtro_oleo: e.target.value })}
                  placeholder="Código do filtro"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Filtro de Ar</label>
                <input
                  type="text"
                  value={specs.filtro_ar || ''}
                  onChange={(e) => setSpecs({ ...specs, filtro_ar: e.target.value })}
                  placeholder="Código do filtro"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Filtro de Combustível</label>
                <input
                  type="text"
                  value={specs.filtro_combustivel || ''}
                  onChange={(e) => setSpecs({ ...specs, filtro_combustivel: e.target.value })}
                  placeholder="Código do filtro"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Filtro Hidráulico</label>
                <input
                  type="text"
                  value={specs.filtro_hidraulico || ''}
                  onChange={(e) => setSpecs({ ...specs, filtro_hidraulico: e.target.value })}
                  placeholder="Código do filtro"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <label style={labelStyle}>Observações Gerais</label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes adicionais do veículo/equipamento..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
              }}
            >
              <Save size={17} />
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Veículo'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
