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
  ShieldCheck, 
  Radio, 
  HardHat, 
  User, 
  Key, 
  X,
  Search
} from 'lucide-react';

interface UsuariosPageProps {
  setHeaderInfo: (title: string, subtitle: string) => void;
}

export const UsuariosPage: React.FC<UsuariosPageProps> = ({ setHeaderInfo }) => {
  const { user, showToast } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [perfilFilter, setPerfilFilter] = useState<string>('TODOS');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('OPERADOR');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formAtivo, setFormAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormSenha(''); // Senha vazia significa não alterar
    setFormAtivo(u.ativo);
    setFormError(null);
    setModalOpen(true);
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
      if (editingUser) {
        // Atualizar
        const payload: any = {
          nome: formNome.trim(),
          perfil: formPerfil,
          username: formUsername.trim() || formNome.toLowerCase().replace(/\s+/g, '.'),
          email: formEmail.trim(),
          ativo: formAtivo
        };
        if (formSenha && formSenha.trim()) {
          payload.senha = formSenha.trim();
        }
        await ApiService.updateUsuario(editingUser.id, payload);
        showToast('Usuário atualizado com sucesso!', 'success');
      } else {
        // Criar
        await ApiService.createUsuario({
          nome: formNome.trim(),
          perfil: formPerfil,
          username: formUsername.trim() || formNome.toLowerCase().replace(/\s+/g, '.'),
          email: formEmail.trim(),
          senha: formSenha || 'Tecno@123',
          ativo: formAtivo
        });
        showToast('Novo usuário cadastrado com sucesso!', 'success');
      }
      setModalOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  // Confirm delete state
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; nome: string } | null>(null);

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
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(240, 90, 34, 0.15)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <HardHat size={12} />
          GESTOR
        </span>
      );
    }
    if (perfil === 'NAVEGADOR') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(41, 128, 168, 0.15)', color: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Radio size={12} />
          NAVEGADOR
        </span>
      );
    }
    return (
      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <User size={12} />
        OPERADOR
      </span>
    );
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Upper Header Bar */}
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
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px', minWidth: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '12.5px', height: '38px' }}
          />
        </div>

        {/* Perfil Filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['TODOS', 'GESTOR', 'NAVEGADOR', 'OPERADOR'].map((p) => (
            <button
              key={p}
              onClick={() => setPerfilFilter(p)}
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: perfilFilter === p ? 'var(--primary)' : 'var(--bg-card)',
                color: perfilFilter === p ? '#FFFFFF' : 'var(--text-muted)',
                border: `1px solid ${perfilFilter === p ? 'var(--primary)' : 'var(--border-color)'}`
              }}
            >
              {p === 'TODOS' ? 'Todos' : p.charAt(0) + p.slice(1).toLowerCase() + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / Grid */}
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
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum usuário encontrado com os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Usuário</th>
                  <th style={{ padding: '10px 12px' }}>Perfil</th>
                  <th style={{ padding: '10px 12px' }}>Login / Username</th>
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
                            backgroundColor: 'rgba(240, 90, 34, 0.15)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          {u.nome.charAt(0)}
                        </div>
                        <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                          {u.nome}
                        </strong>
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
                      {u.ativo ? (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} />
                          Ativo
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Editar Usuário"
                        >
                          <Edit size={13} />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => setDeleteUserTarget({ id: u.id, nome: u.nome })}
                          style={{
                            padding: '6px 8px',
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
                          <Trash2 size={14} />
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

      {/* Modal de Criação / Edição de Usuário */}
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
              maxWidth: '540px', 
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
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
              </h3>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)}
                style={{ color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ backgroundColor: 'rgba(231,76,60,0.15)', color: '#FADBD8', border: '1px solid var(--danger)', padding: '10px', borderRadius: '4px', fontSize: '12px', marginBottom: '14px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-main)' }}>
                  NOME COMPLETO *
                </label>
                <input 
                  type="text" 
                  value={formNome} 
                  onChange={e => setFormNome(e.target.value)} 
                  placeholder="ex: Eduardo Silva" 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-main)' }}>
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
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-main)' }}>
                    USUÁRIO (LOGIN) *
                  </label>
                  <input 
                    type="text" 
                    value={formUsername} 
                    onChange={e => setFormUsername(e.target.value.toLowerCase().trim())} 
                    placeholder="ex: eduardo" 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-main)' }}>
                  E-MAIL (OPCIONAL)
                </label>
                <input 
                  type="email" 
                  value={formEmail} 
                  onChange={e => setFormEmail(e.target.value)} 
                  placeholder="ex: eduardo@tecnodrill.com.br" 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--text-main)' }}>
                  {editingUser ? 'NOVA SENHA (DEIXE EM BRANCO PARA MANTER)' : 'SENHA INICIAL *'}
                </label>
                <input 
                  type="password" 
                  value={formSenha} 
                  onChange={e => setFormSenha(e.target.value)} 
                  placeholder={editingUser ? '••••••••' : 'Senha de acesso'} 
                  required={!editingUser}
                />
              </div>

              <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: 'var(--text-main)', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={formAtivo} 
                    onChange={e => setFormAtivo(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Usuário Ativo no Sistema</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '8px 14px' }}
                >
                  Cancelar
                </button>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700 }}
                >
                  {saving ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
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
