import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Usuario, PerfilUsuario } from '../types';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  HardHat, 
  Radio, 
  User, 
  Key, 
  X,
  Search,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Copy,
  Share2,
  Smartphone,
  Send,
  ExternalLink
} from 'lucide-react';

const toTitleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

interface UsuariosPageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
}

export const UsuariosPage: React.FC<UsuariosPageProps> = ({ setHeaderInfo }) => {
  const { user, showToast } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [perfilFilter, setPerfilFilter] = useState<string>('TODOS');

  // Modal Novo/Editar Usuário
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('OPERADOR');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formAtivo, setFormAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Redefinir Senha
  const [passwordModalUser, setPasswordModalUser] = useState<Usuario | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Modal Compartilhar Credenciais (Padrão JLE)
  const [shareCredentials, setShareCredentials] = useState<{
    nome: string;
    perfil: PerfilUsuario;
    username: string;
    senha: string;
    email?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirm delete state
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; nome: string } | null>(null);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      showToast('Erro ao carregar lista de usuários.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHeaderInfo('Gestão de Usuários', 'Controle de acessos de Gestores, Navegadores e Operadores');
    fetchUsuarios();
  }, [setHeaderInfo]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormNome('');
    setFormPerfil('OPERADOR');
    setFormUsername('');
    setFormEmail('');
    setFormSenha('Tecno@123');
    setShowPassword(false);
    setFormAtivo(true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (u: Usuario) => {
    setEditingUser(u);
    setFormNome(u.nome);
    setFormPerfil(u.perfil);
    setFormUsername(u.username);
    setFormEmail(u.email || '');
    setFormSenha(''); // Vazio significa não alterar
    setShowPassword(false);
    setFormAtivo(u.ativo);
    setFormError(null);
    setModalOpen(true);
  };

  // Auto-gerar sugestão de username ao digitar nome
  const handleNomeChange = (val: string) => {
    setFormNome(val);
    if (!editingUser) {
      const suggested = val.toLowerCase().trim().replace(/\s+/g, '.');
      setFormUsername(suggested);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formNome.trim() || !formPerfil) {
      setFormError('Nome e Perfil são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const nomeFormatado = toTitleCase(formNome.trim());
      const usernameFormatado = formUsername.trim().toLowerCase() || nomeFormatado.toLowerCase().replace(/\s+/g, '.');

      if (editingUser) {
        // Atualizar
        const payload: any = {
          nome: nomeFormatado,
          perfil: formPerfil,
          username: usernameFormatado,
          email: formEmail.trim().toLowerCase() || undefined,
          ativo: formAtivo
        };
        if (formSenha && formSenha.trim()) {
          payload.senha = formSenha.trim();
        }
        await ApiService.updateUsuario(editingUser.id, payload);
        showToast(`Usuário ${nomeFormatado} atualizado com sucesso!`, 'success');
        setModalOpen(false);
      } else {
        // Criar
        const senhaCriada = formSenha || 'Tecno@123';
        await ApiService.createUsuario({
          nome: nomeFormatado,
          perfil: formPerfil,
          username: usernameFormatado,
          email: formEmail.trim().toLowerCase() || undefined,
          senha: senhaCriada,
          ativo: formAtivo
        });
        showToast(`Novo usuário ${nomeFormatado} cadastrado com sucesso!`, 'success');
        setModalOpen(false);
        setCopied(false);
        setShareCredentials({
          nome: nomeFormatado,
          perfil: formPerfil,
          username: usernameFormatado,
          senha: senhaCriada,
          email: formEmail.trim().toLowerCase() || undefined
        });
      }
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const getAppUrl = () => {
    return window.location.origin;
  };

  const getShareText = (creds: { nome: string; perfil: PerfilUsuario; username: string; senha: string }) => {
    const appUrl = getAppUrl();
    return `🚨 *ACESSO TECNODRILL INFRA* 🚨\n\nOlá, *${creds.nome}*! Seu acesso ao sistema TecnoDrill foi configurado.\n\n🌐 *Link do App:* ${appUrl}\n👤 *Usuário:* ${creds.username}\n🔑 *Senha:* ${creds.senha}\n💼 *Perfil:* ${creds.perfil}\n\n💡 *Dica:* Abra o link pelo navegador do celular e clique em "Instalar App" para ter o aplicativo direto na tela inicial!`;
  };

  const handleCopyCredentials = () => {
    if (!shareCredentials) return;
    const text = getShareText(shareCredentials);
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Dados de acesso copiados para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleWhatsAppShare = () => {
    if (!shareCredentials) return;
    const text = encodeURIComponent(getShareText(shareCredentials));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleOpenShareForUser = (u: Usuario) => {
    setCopied(false);
    setShareCredentials({
      nome: u.nome,
      perfil: u.perfil,
      username: u.username,
      senha: 'Tecno@123', // Senha padrão ou senha redefinida
      email: u.email || undefined
    });
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPassword.trim()) return;

    setSavingPassword(true);
    try {
      await ApiService.updateUsuario(passwordModalUser.id, { senha: newPassword.trim() });
      showToast(`Senha de ${passwordModalUser.nome} alterada com sucesso!`, 'success');
      setPasswordModalUser(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao redefinir senha.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleStatus = async (u: Usuario) => {
    try {
      const novoStatus = !u.ativo;
      await ApiService.updateUsuario(u.id, { ativo: novoStatus });
      showToast(`Usuário ${u.nome} agora está ${novoStatus ? 'Ativo' : 'Inativo'}.`, 'info');
      fetchUsuarios();
    } catch (err) {
      showToast('Erro ao alterar status do usuário.', 'error');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await ApiService.deleteUsuario(deleteUserTarget.id);
      showToast(`Usuário ${deleteUserTarget.nome} removido.`, 'info');
      setDeleteUserTarget(null);
      fetchUsuarios();
    } catch (err) {
      showToast('Erro ao remover usuário.', 'error');
    }
  };

  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = 
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPerfil = perfilFilter === 'TODOS' || u.perfil === perfilFilter;
    return matchesSearch && matchesPerfil;
  });

  const getPerfilBadge = (perfil: PerfilUsuario) => {
    if (perfil === 'GESTOR' || perfil === 'ADMIN') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <HardHat size={12} />
          GESTOR
        </span>
      );
    }
    if (perfil === 'NAVEGADOR') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(41, 128, 168, 0.15)', color: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Radio size={12} />
          NAVEGADOR
        </span>
      );
    }
    return (
      <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <User size={12} />
        OPERADOR
      </span>
    );
  };

  const countGestores = usuarios.filter(u => u.perfil === 'GESTOR' || u.perfil === 'ADMIN').length;
  const countNavegadores = usuarios.filter(u => u.perfil === 'NAVEGADOR').length;
  const countOperadores = usuarios.filter(u => u.perfil === 'OPERADOR').length;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Upper Header Bar (Padrão JLE) */}
      <div className="upper-header">
        <div>
          <h1 className="header-title">Gestão de Usuários</h1>
          <p className="header-subtitle">Controle de acessos de Gestores, Navegadores e Operadores de campo</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="header-action-btn"
        >
          <UserPlus size={16} />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px', minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '12.5px', height: '38px' }}
          />
        </div>

        {/* Perfil Filter Pills with Counters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'TODOS', label: `Todos (${usuarios.length})` },
            { id: 'GESTOR', label: `Gestores (${countGestores})` },
            { id: 'NAVEGADOR', label: `Navegadores (${countNavegadores})` },
            { id: 'OPERADOR', label: `Operadores (${countOperadores})` }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPerfilFilter(p.id)}
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: perfilFilter === p.id ? 'var(--primary)' : 'var(--bg-card)',
                color: perfilFilter === p.id ? '#FFFFFF' : 'var(--text-muted)',
                border: `1px solid ${perfilFilter === p.id ? 'var(--primary)' : 'var(--border-color)'}`,
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="skeleton" style={{ width: '100%', height: '160px', borderRadius: '8px' }} />
          </div>
        ) : filteredUsuarios.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum usuário encontrado com os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Usuário</th>
                  <th style={{ padding: '10px 12px' }}>Perfil</th>
                  <th style={{ padding: '10px 12px' }}>Login (Username)</th>
                  <th style={{ padding: '10px 12px' }}>E-mail</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsuarios.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div 
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            backgroundColor: u.perfil === 'GESTOR' || u.perfil === 'ADMIN' 
                              ? 'rgba(240, 90, 34, 0.15)' 
                              : u.perfil === 'NAVEGADOR' 
                              ? 'rgba(41, 128, 168, 0.15)' 
                              : 'rgba(39, 174, 96, 0.15)',
                            color: u.perfil === 'GESTOR' || u.perfil === 'ADMIN' 
                              ? 'var(--primary)' 
                              : u.perfil === 'NAVEGADOR' 
                              ? 'var(--primary-light)' 
                              : 'var(--success)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '13px'
                          }}
                        >
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block' }}>
                            {u.nome}
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getPerfilBadge(u.perfil)}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {u.username}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {u.email || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: u.ativo ? 'rgba(39, 174, 96, 0.12)' : 'rgba(231, 76, 60, 0.12)',
                          color: u.ativo ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${u.ativo ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Clique para alternar o status do usuário"
                      >
                        {u.ativo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                      </button>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        
                        {/* Compartilhar Acesso */}
                        <button
                          onClick={() => handleOpenShareForUser(u)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--primary)',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          title="Compartilhar Dados de Acesso"
                        >
                          <Share2 size={12} />
                          <span>Acesso</span>
                        </button>

                        {/* Redefinir Senha */}
                        <button
                          onClick={() => {
                            setPasswordModalUser(u);
                            setNewPassword('');
                            setShowNewPassword(false);
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          title="Alterar Senha de Acesso"
                        >
                          <Key size={12} />
                          <span>Senha</span>
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          title="Editar Usuário"
                        >
                          <Edit size={12} />
                          <span>Editar</span>
                        </button>

                        {/* Excluir */}
                        <button
                          onClick={() => setDeleteUserTarget({ id: u.id, nome: u.nome })}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '4px',
                            color: 'var(--danger)',
                            fontSize: '11.5px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          className="hover:bg-rose-500/10"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE USUÁRIO (PADRÃO JLE) */}
      {modalOpen && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0,
            top: 0, 
            left: 0, 
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.8)', 
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
              maxWidth: '520px', 
              backgroundColor: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              padding: '24px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              margin: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {editingUser ? `Atualize as informações de ${editingUser.nome}` : 'Defina os dados de acesso e perfil do colaborador'}
                </span>
              </div>

              <button 
                type="button" 
                onClick={() => setModalOpen(false)}
                style={{ color: 'var(--text-muted)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ backgroundColor: 'rgba(231,76,60,0.15)', color: '#FADBD8', border: '1px solid var(--danger)', padding: '10px', borderRadius: '4px', fontSize: '12px', marginBottom: '14px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                  NOME COMPLETO *
                </label>
                <input 
                  type="text" 
                  value={formNome} 
                  onChange={e => handleNomeChange(e.target.value)} 
                  placeholder="ex: Eduardo Silva" 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                    PERFIL DE ACESSO *
                  </label>
                  <select 
                    value={formPerfil} 
                    onChange={e => setFormPerfil(e.target.value as PerfilUsuario)}
                    required
                  >
                    <option value="GESTOR">Gestor</option>
                    <option value="NAVEGADOR">Navegador</option>
                    <option value="OPERADOR">Operador</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                    USUÁRIO (LOGIN) *
                  </label>
                  <input 
                    type="text" 
                    value={formUsername} 
                    onChange={e => setFormUsername(e.target.value.toLowerCase().trim())} 
                    placeholder="ex: eduardo.silva" 
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)' }}>
                  E-MAIL CORPORATIVO (OPCIONAL)
                </label>
                <input 
                  type="email" 
                  value={formEmail} 
                  onChange={e => setFormEmail(e.target.value)} 
                  placeholder="ex: eduardo@tecnodrill.com.br" 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                  {editingUser ? 'NOVA SENHA (DEIXE EM BRANCO PARA MANTER)' : 'SENHA INICIAL *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={formSenha} 
                    onChange={e => setFormSenha(e.target.value)} 
                    placeholder={editingUser ? '••••••••' : 'Senha de acesso (padrão: Tecno@123)'} 
                    required={!editingUser}
                    style={{ paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px', color: 'var(--text-main)', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={formAtivo} 
                    onChange={e => setFormAtivo(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Usuário Ativo no Sistema</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="btn-primary"
                  style={{ padding: '9px 22px', fontSize: '13px', fontWeight: 700 }}
                >
                  {saving ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE COMPARTILHAMENTO DE CREDENCIAIS (PADRÃO JLE) */}
      {shareCredentials && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0,
            top: 0, 
            left: 0, 
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)', 
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
              maxWidth: '480px', 
              backgroundColor: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid rgba(240, 90, 34, 0.4)', 
              padding: '24px', 
              boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
              margin: 'auto'
            }}
          >
            {/* Header com Ícone e Destaque */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div 
                style={{ 
                  width: '44px', 
                  height: '44px', 
                  borderRadius: '12px', 
                  backgroundColor: 'rgba(240, 90, 34, 0.18)', 
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Acesso Configurado!
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Copie e envie as credenciais para o novo colaborador
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setShareCredentials(null)}
                style={{ color: 'var(--text-muted)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Card de Detalhes Visuais */}
            <div 
              style={{ 
                backgroundColor: 'var(--bg-app)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '14px 16px', 
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Nome</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{shareCredentials.nome}</strong>
                </div>
                {getPerfilBadge(shareCredentials.perfil)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Login (Usuário)</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 700, color: 'var(--primary-light)', marginTop: '2px' }}>
                    {shareCredentials.username}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Senha Inicial</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 700, color: '#F1C40F', marginTop: '2px' }}>
                    {shareCredentials.senha}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Link de Acesso</span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                  {getAppUrl()}
                </span>
              </div>
            </div>

            {/* Caixa de Texto Formatada para Copiar / WhatsApp */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Mensagem Pronta para Envio
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  Padrão WhatsApp / E-mail
                </span>
              </div>

              <pre 
                style={{ 
                  backgroundColor: 'var(--bg-app)', 
                  border: '1px dashed var(--border-color)', 
                  borderRadius: '6px', 
                  padding: '12px', 
                  fontSize: '11px', 
                  color: 'var(--text-main)', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontFamily: 'var(--font-mono)',
                  margin: 0,
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}
              >
                {getShareText(shareCredentials)}
              </pre>
            </div>

            {/* Ações de Compartilhamento */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                
                {/* Botão Copiar Dados */}
                <button 
                  type="button" 
                  onClick={handleCopyCredentials}
                  style={{ 
                    padding: '10px 14px', 
                    borderRadius: '6px', 
                    backgroundColor: copied ? '#27AE60' : 'var(--primary)', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    fontSize: '12.5px', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Dados'}</span>
                </button>

                {/* Botão WhatsApp */}
                <button 
                  type="button" 
                  onClick={handleWhatsAppShare}
                  style={{ 
                    padding: '10px 14px', 
                    borderRadius: '6px', 
                    backgroundColor: '#25D366', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    fontSize: '12.5px', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    cursor: 'pointer'
                  }}
                >
                  <Send size={15} />
                  <span>Enviar WhatsApp</span>
                </button>
              </div>

              <button 
                type="button" 
                onClick={() => setShareCredentials(null)}
                style={{ 
                  padding: '9px', 
                  borderRadius: '6px', 
                  backgroundColor: 'transparent', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-muted)', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL RÁPIDO DE REDEFINIÇÃO DE SENHA */}
      {passwordModalUser && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0,
            top: 0, 
            left: 0, 
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.8)', 
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
              maxWidth: '420px', 
              backgroundColor: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)', 
              padding: '24px', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Redefinir Senha
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Usuário: <strong>{passwordModalUser.nome}</strong> ({passwordModalUser.username})
                </span>
              </div>

              <button 
                type="button" 
                onClick={() => setPasswordModalUser(null)}
                style={{ color: 'var(--text-muted)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '11.5px', color: 'var(--text-main)' }}>
                  NOVA SENHA *
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha..."
                    required
                    style={{ paddingRight: '38px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button 
                  type="button" 
                  onClick={() => setPasswordModalUser(null)}
                  style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>

                <button 
                  type="submit" 
                  disabled={savingPassword}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '12.5px', fontWeight: 700 }}
                >
                  {savingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DIALOG - EXCLUIR USUÁRIO */}
      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        title="Excluir Usuário"
        message={`Deseja realmente remover o usuário "${deleteUserTarget?.nome}" do sistema? Esta ação revogará o acesso desta conta.`}
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
};
