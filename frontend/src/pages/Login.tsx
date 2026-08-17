import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, ArrowRight, HardHat, Radio, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!identificador.trim() || !senha) {
      setErrorMsg('Informe o usuário/e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      await login(identificador.trim(), senha);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userIdent: string, pass: string) => {
    setIdentificador(userIdent);
    setSenha(pass);
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(userIdent, pass);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

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
          background: 'radial-gradient(circle, rgba(240, 90, 34, 0.12) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(39, 174, 96, 0.08) 0%, transparent 70%)',
          bottom: '-100px',
          left: '-100px',
          pointerEvents: 'none'
        }} 
      />

      {/* Main Login Card */}
      <div 
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 30px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxSizing: 'border-box'
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <img 
            src="/logo.png" 
            alt="TecnoDrill INFRA" 
            style={{ height: '48px', maxWidth: '200px', width: 'auto', objectFit: 'contain' }} 
          />
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            Sistema de Canalização, MND & Metas
          </p>
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Usuário ou E-mail
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="ex: eduardo ou marcelo"
                required
                style={{
                  paddingLeft: '38px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  height: '42px',
                  boxSizing: 'border-box'
                }}
              />
              <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  paddingLeft: '38px',
                  paddingRight: '38px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  height: '42px',
                  boxSizing: 'border-box'
                }}
              />
              <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  padding: '2px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '12px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px',
              boxShadow: '0 4px 15px rgba(240, 90, 34, 0.35)'
            }}
          >
            {loading ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Acessar Painel TecnoDrill</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Access Profiles */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', textAlign: 'center', marginBottom: '10px' }}>
            Acesso Rápido por Perfil:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => handleQuickLogin('eduardo', 'Gestor@123')}
              className="btn-secondary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '8px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <HardHat size={13} style={{ color: 'var(--primary)' }} />
              <span>Eduardo (Gestor)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('carlos', 'Gestor@123')}
              className="btn-secondary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '8px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <HardHat size={13} style={{ color: 'var(--primary)' }} />
              <span>Carlos (Gestor)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('marcelo', 'Tecno@123')}
              className="btn-secondary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '8px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Radio size={13} style={{ color: 'var(--primary-light)' }} />
              <span>Marcelo (Navegador)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('antonio', 'Tecno@123')}
              className="btn-secondary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '8px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <User size={13} style={{ color: 'var(--success)' }} />
              <span>Antônio (Operador)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
