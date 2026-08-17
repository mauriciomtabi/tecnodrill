import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, HardHat, Radio } from 'lucide-react';

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
      setErrorMsg(err.message || 'Falha ao autenticar.');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0E11] relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F05A22]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#141A21] border border-[#26313D] rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <img src="/logo.png" alt="TecnoDrill INFRA" className="h-12 w-auto object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Tecno<span className="text-[#F05A22]">Drill</span> INFRA
          </h1>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
            Sistema de Canalização, MND & Metas
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase">
              Usuário ou E-mail
            </label>
            <div className="relative">
              <input
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="eduardo ou marcelo"
                required
                className="pl-10 text-sm font-medium"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-10 pr-10 text-sm font-medium"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-white p-0.5"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Acessar Painel TecnoDrill</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        {/* Quick Access Profiles for Pair Testing */}
        <div className="mt-8 pt-6 border-t border-[#26313D]">
          <span className="text-[11px] font-bold text-gray-400 uppercase block text-center mb-3">
            Acesso Rápido por Perfil:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('eduardo', 'Gestor@123')}
              className="btn-secondary text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5"
            >
              <HardHat size={14} className="text-[#F05A22]" />
              <span>Eduardo (Gestor)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('carlos', 'Gestor@123')}
              className="btn-secondary text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5"
            >
              <HardHat size={14} className="text-[#F05A22]" />
              <span>Carlos (Gestor)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('marcelo', 'Tecno@123')}
              className="btn-secondary text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5"
            >
              <Radio size={14} className="text-emerald-400" />
              <span>Marcelo (Navegador)</span>
            </button>

            <button
              onClick={() => handleQuickLogin('antonio', 'Tecno@123')}
              className="btn-secondary text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5"
            >
              <Radio size={14} className="text-blue-400" />
              <span>Antônio (Operador)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
