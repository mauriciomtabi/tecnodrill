import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, KeyRound, Eye, EyeOff, Check, AlertCircle, ShieldAlert, LogOut } from 'lucide-react';

interface PrimeiroAcessoModalProps {
  isOpen: boolean;
}

export const PrimeiroAcessoModal: React.FC<PrimeiroAcessoModalProps> = ({ isOpen }) => {
  const { user, trocarSenhaPrimeiroAcesso, logout, showToast } = useAuth();
  
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

    if (senhaTrim === 'Tecno@123' || senhaTrim === 'Gestor@123') {
      setErrorMsg('Por favor, escolha uma senha pessoal diferente da senha inicial padrão.');
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
  const isDifferentFromDefault = novaSenha.trim() !== 'Tecno@123' && novaSenha.trim() !== 'Gestor@123';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid rgba(240, 90, 34, 0.4)',
          padding: '30px 26px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header com Ícone e Destaque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(240, 90, 34, 0.18)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
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
            fontSize: '12.5px',
            color: 'var(--text-main)',
            lineHeight: '1.45'
          }}
        >
          🔒 Por motivos de segurança, você deve cadastrar uma nova senha pessoal para continuar navegando no sistema TecnoDrill.
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isMinLength ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={13} style={{ opacity: isMinLength ? 1 : 0.4 }} />
              <span>Mínimo de 6 caracteres</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isMatch ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={13} style={{ opacity: isMatch ? 1 : 0.4 }} />
              <span>As senhas coincidem</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDifferentFromDefault && isMinLength ? 'var(--success, #27AE60)' : 'inherit' }}>
              <Check size={13} style={{ opacity: isDifferentFromDefault && isMinLength ? 1 : 0.4 }} />
              <span>Diferente da senha padrão</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={loading || !isMinLength || !isMatch}
              className="btn-primary"
              style={{
                height: '44px',
                fontSize: '13.5px',
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
                padding: '8px',
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
