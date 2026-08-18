import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, KeyRound, Eye, EyeOff, Check, AlertCircle, ShieldAlert, LogOut } from 'lucide-react';

interface PrimeiroAcessoModalProps {
  isOpen: boolean;
}

export const PrimeiroAcessoModal: React.FC<PrimeiroAcessoModalProps> = ({ isOpen }) => {
  const { user, trocarSenhaPrimeiroAcesso, logout } = useAuth();
  
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const senhaTrim = novaSenha.trim();
    const confTrim = confirmarSenha.trim();

    if (senhaTrim.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (senhaTrim !== confTrim) {
      setErrorMsg('As senhas digitadas não coincidem. Verifique a confirmação.');
      return;
    }

    if (senhaTrim === 'Tecno@123' || senhaTrim === 'Gestor@123' || senhaTrim === '123456') {
      setErrorMsg('Por favor, escolha uma senha pessoal diferente da senha padrão inicial.');
      return;
    }

    setLoading(true);
    try {
      await trocarSenhaPrimeiroAcesso(senhaTrim);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir senha no primeiro acesso.');
    } finally {
      setLoading(false);
    }
  };

  const isMinLength = novaSenha.trim().length >= 6;
  const isMatch = novaSenha.trim().length > 0 && novaSenha.trim() === confirmarSenha.trim();
  const isDifferentFromDefault = novaSenha.trim() !== 'Tecno@123' && novaSenha.trim() !== 'Gestor@123' && novaSenha.trim() !== '123456';

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* Background Decorative Gradients */}
      <div 
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240, 90, 34, 0.15) 0%, transparent 70%)',
          top: '-150px',
          right: '-150px',
          pointerEvents: 'none'
        }} 
      />
      <div 
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(39, 174, 96, 0.1) 0%, transparent 70%)',
          bottom: '-100px',
          left: '-100px',
          pointerEvents: 'none'
        }} 
      />

      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color)',
          padding: '34px 28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxSizing: 'border-box'
        }}
      >
        {/* Brand Header: Logo */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/logo.png" 
            alt="TecnoDrill INFRA" 
            style={{ height: '48px', maxWidth: '200px', width: 'auto', objectFit: 'contain' }} 
          />
        </div>

        {/* Header com Ícone e Destaque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(240, 90, 34, 0.18)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Troca de Senha Obrigatória
            </h2>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Primeiro acesso de <strong>{user.nome}</strong>
            </span>
          </div>
        </div>

        {/* Mensagem Explicativa */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'rgba(240, 90, 34, 0.08)',
            border: '1px solid rgba(240, 90, 34, 0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-main)',
            lineHeight: '1.45'
          }}
        >
          🔒 Por motivos de segurança, você precisa cadastrar uma nova senha pessoal para ter acesso ao sistema TecnoDrill.
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(231, 76, 60, 0.15)',
              border: '1px solid var(--danger)',
              borderRadius: '6px',
              color: '#FADBD8',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário de Redefinição */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Nova Senha *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNovaSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha (mínimo 6 dígitos)"
                required
                style={{
                  paddingLeft: '38px',
                  paddingRight: '38px',
                  fontSize: '13px',
                  height: '42px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
              <KeyRound size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <button
                type="button"
                onClick={() => setShowNovaSenha(!showNovaSenha)}
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
                {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Confirmar Nova Senha *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmarSenha ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha exatamente igual"
                required
                style={{
                  paddingLeft: '38px',
                  paddingRight: '38px',
                  fontSize: '13px',
                  height: '42px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
              <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
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
                {showConfirmarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Checklist visual de requisitos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isMinLength ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={12} style={{ opacity: isMinLength ? 1 : 0.4 }} />
              <span>Mínimo de 6 caracteres</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isMatch ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={12} style={{ opacity: isMatch ? 1 : 0.4 }} />
              <span>As senhas coincidem</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDifferentFromDefault && isMinLength ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={12} style={{ opacity: isDifferentFromDefault && isMinLength ? 1 : 0.4 }} />
              <span>Diferente da senha padrão</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={loading || !isMinLength || !isMatch}
              className="btn-primary"
              style={{
                height: '44px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (!isMinLength || !isMatch || loading) ? 0.6 : 1,
                cursor: (!isMinLength || !isMatch || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Salvando Senha...' : 'Definir Nova Senha e Continuar'}
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
                padding: '6px',
                cursor: 'pointer'
              }}
            >
              <LogOut size={13} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
