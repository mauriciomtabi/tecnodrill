import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Sparkles, CheckCircle2, X, Zap } from 'lucide-react';

interface MetaCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  metaMetros: number;
  metrosAtingidos: number;
  tipoMeta: 'DIARIA' | 'SEMANAL';
  nomeServico?: string;
  navegadorNome?: string;
  operadorNome?: string;
}

export const MetaCelebration: React.FC<MetaCelebrationProps> = ({
  isOpen,
  onClose,
  metaMetros,
  metrosAtingidos,
  tipoMeta,
  nomeServico,
  navegadorNome,
  operadorNome
}) => {
  useEffect(() => {
    if (isOpen) {
      // Disparar rajadas de confetes multicoloridos e dourados
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const colors = ['#F05A22', '#FF7744', '#FFD700', '#10B981', '#38BDF8', '#FFFFFF'];

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Som sutil de celebração (usando Web Audio API para zero dependência externa)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;
        
        // Acorde triunfal simples (Dó - Mi - Sol - Dó Maior)
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.65);
        });
      } catch (e) {
        // Ignora caso áudio esteja bloqueado pelo browser
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const percentual = metaMetros > 0 ? Math.round((metrosAtingidos / metaMetros) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1F2730] to-[#12161A] border-2 border-[#F05A22] rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(240,90,34,0.4)] bounce-in overflow-hidden">
        
        {/* Background Glow Accents */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#F05A22]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Trophy Icon with Pulse */}
        <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#F05A22]/30 rounded-full animate-ping opacity-75" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#F05A22] to-[#FF8844] flex items-center justify-center text-white shadow-xl shadow-[#F05A22]/40">
            <Trophy className="w-11 h-11 text-yellow-200 drop-shadow-md" />
          </div>
        </div>

        {/* Title & Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold uppercase tracking-wider mb-2 border border-emerald-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          Meta {tipoMeta === 'DIARIA' ? 'Diária' : 'Semanal'} Conquistada!
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
          Parabéns, Equipe! 🎉
        </h2>

        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
          {nomeServico ? <span className="font-semibold text-white block mb-1">{nomeServico}</span> : null}
          A meta estipulada de <strong className="text-[#F05A22]">{metaMetros} metros</strong> foi atingida e superada com <strong className="text-emerald-400">{metrosAtingidos} metros</strong> perfurados!
        </p>

        {/* Stats Card */}
        <div className="grid grid-cols-2 gap-3 bg-[#161B22] p-4 rounded-2xl border border-white/10 mb-6">
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400 font-medium">Metragem Realizada</span>
            <span className="text-2xl font-black text-white">{metrosAtingidos}m</span>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <Zap className="w-3 h-3" /> {percentual}% da meta
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-l border-white/10 pl-3">
            <span className="text-xs text-gray-400 font-medium">Frente em Ação</span>
            <span className="text-xs font-bold text-[#F05A22] truncate max-w-[140px]">
              {navegadorNome ? `Nav: ${navegadorNome}` : 'Navegador'}
            </span>
            <span className="text-[11px] text-gray-300 truncate max-w-[140px]">
              {operadorNome ? `Op: ${operadorNome}` : 'Operador'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full btn-primary py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#F05A22]/30 active:scale-98 transition-all"
        >
          <CheckCircle2 className="w-5 h-5" />
          Continuar Produzindo
        </button>
      </div>
    </div>
  );
};
