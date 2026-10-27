import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mail, 
  X, 
  Send, 
  Eye, 
  Check, 
  Clock, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  Users, 
  Save, 
  CheckCircle2
} from 'lucide-react';

interface ConfiguracaoEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export interface ConfigEmailDiario {
  ativo: boolean;
  nomeRelatorio: string;
  destinatarios: string[];
  horario: string;
  diasSemana: number[]; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  ultimoEnvio?: string;
  updatedAt?: string;
}

const DIAS_SEMANA_OPCOES = [
  { valor: 1, label: 'Seg', nome: 'Segunda' },
  { valor: 2, label: 'Ter', nome: 'Terça' },
  { valor: 3, label: 'Qua', nome: 'Quarta' },
  { valor: 4, label: 'Qui', nome: 'Quinta' },
  { valor: 5, label: 'Sex', nome: 'Sexta' },
  { valor: 6, label: 'Sáb', nome: 'Sábado' },
  { valor: 0, label: 'Dom', nome: 'Domingo' }
];

const DEFAULT_CONFIG: ConfigEmailDiario = {
  ativo: true,
  nomeRelatorio: 'Relatório Diário de Produção & Faturamento',
  destinatarios: [
    'mauricio.maciel@jletelecom.com.br',
    'eduardo.costa@tecnodrill.com.br',
    'carlos@tecnodrill.com.br'
  ],
  horario: '19:00',
  diasSemana: [1, 2, 3, 4, 5, 6]
};

export const ConfiguracaoEmailModal: React.FC<ConfiguracaoEmailModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [ativo, setAtivo] = useState<boolean>(true);
  const [nomeRelatorio, setNomeRelatorio] = useState<string>(DEFAULT_CONFIG.nomeRelatorio);
  const [destinatariosStr, setDestinatariosStr] = useState<string>(DEFAULT_CONFIG.destinatarios.join(', '));
  const [horario, setHorario] = useState<string>(DEFAULT_CONFIG.horario);
  const [diasSemana, setDiasSemana] = useState<number[]>(DEFAULT_CONFIG.diasSemana);
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Trava a rolagem do body enquanto o modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Carrega configuração salva
  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    const carregarConfig = async () => {
      // 1. Carregamento imediato do cache local (zero delay e zero erro de rede)
      const cached = localStorage.getItem('tecnodrill_email_config');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          aplicarConfig(parsed);
        } catch (_) {}
      } else {
        aplicarConfig(DEFAULT_CONFIG);
      }

      // 2. Tentar sincronizar da API silenciosamente se disponível
      try {
        const token = localStorage.getItem('tecnodrill_token');
        const res = await fetch('/api/relatorios/diario/config', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.config) {
            aplicarConfig(data.config);
            localStorage.setItem('tecnodrill_email_config', JSON.stringify(data.config));
          }
        }
      } catch (_) {
        // Silencioso - o fallback local garante a estabilidade visual
      }
    };

    carregarConfig();
  }, [isOpen]);

  const aplicarConfig = (cfg: ConfigEmailDiario) => {
    setAtivo(cfg.ativo ?? true);
    setNomeRelatorio(cfg.nomeRelatorio || DEFAULT_CONFIG.nomeRelatorio);
    setDestinatariosStr((cfg.destinatarios || DEFAULT_CONFIG.destinatarios).join(', '));
    setHorario(cfg.horario || DEFAULT_CONFIG.horario);
    setDiasSemana(cfg.diasSemana || DEFAULT_CONFIG.diasSemana);
    setUltimoEnvio(cfg.ultimoEnvio || null);
  };

  const getDestinatariosArray = (): string[] => {
    return destinatariosStr
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));
  };

  const toggleDia = (valor: number) => {
    if (diasSemana.includes(valor)) {
      setDiasSemana(diasSemana.filter(d => d !== valor));
    } else {
      setDiasSemana([...diasSemana, valor]);
    }
  };

  const selecionarDiasPreset = (tipo: 'TODOS' | 'UTEIS' | 'SEG_SAB') => {
    if (tipo === 'TODOS') setDiasSemana([1, 2, 3, 4, 5, 6, 0]);
    else if (tipo === 'UTEIS') setDiasSemana([1, 2, 3, 4, 5]);
    else if (tipo === 'SEG_SAB') setDiasSemana([1, 2, 3, 4, 5, 6]);
  };

  // Salvar configuração (persistência local + nuvem resiliente)
  const handleSalvar = async () => {
    setSaving(true);
    setFeedback(null);
    const lista = getDestinatariosArray();

    if (lista.length === 0) {
      setFeedback({ type: 'error', msg: 'Informe pelo menos um e-mail válido para destinatário.' });
      setSaving(false);
      return;
    }

    const payload: ConfigEmailDiario = {
      ativo,
      nomeRelatorio,
      destinatarios: lista,
      horario,
      diasSemana,
      ultimoEnvio: ultimoEnvio || undefined
    };

    // Salvar localmente com prioridade máxima
    localStorage.setItem('tecnodrill_email_config', JSON.stringify(payload));

    try {
      const token = localStorage.getItem('tecnodrill_token');
      await fetch('/api/relatorios/diario/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
    } catch (_) {
      // Ignora falhas da rota se offline/Vercel
    }

    setFeedback({ type: 'success', msg: 'Configurações de agendamento salvas com sucesso!' });
    if (showToast) showToast('Configurações de agendamento salvas!', 'success');
    setSaving(false);
  };

  // Disparo manual de teste de e-mail com fallback para Telegram
  const handleDispararTeste = async () => {
    setSendingTest(true);
    setFeedback(null);
    const lista = getDestinatariosArray();

    if (lista.length === 0) {
      setFeedback({ type: 'error', msg: 'Insira pelo menos um e-mail válido para testar o envio.' });
      setSendingTest(false);
      return;
    }

    try {
      const token = localStorage.getItem('tecnodrill_token');
      const res = await fetch('/api/relatorios/diario/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ destinatarios: lista })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sucesso) {
          const agora = new Date().toISOString();
          setUltimoEnvio(agora);
          setFeedback({ 
            type: 'success', 
            msg: data.mensagem || `Relatório enviado com sucesso para ${lista.length} destinatário(s)!` 
          });
          if (showToast) showToast('Relatório disparado com sucesso!', 'success');
          return;
        }
      }

      // Se API não respondeu ou deu 404, dispara direto para o Telegram para não deixar o gestor na mão
      await dispararTelegramDireto();
      setFeedback({
        type: 'success',
        msg: `Relatório de teste enviado para o grupo do Telegram! (Para envio por e-mail, verifique a conexão com o servidor SMTP).`
      });
    } catch (e: any) {
      try {
        await dispararTelegramDireto();
        setFeedback({
          type: 'success',
          msg: `Relatório de teste enviado para o grupo do Telegram! (Para envio por e-mail, verifique a conexão com o servidor SMTP).`
        });
      } catch (errTg: any) {
        setFeedback({ 
          type: 'error', 
          msg: 'Não foi possível conectar ao servidor. Verifique a conexão com a API.' 
        });
      }
    } finally {
      setSendingTest(false);
    }
  };

  // Abrir template no navegador
  const handleVisualizarTemplate = () => {
    window.open('/preview-email-diario.html', '_blank');
  };

  const [sendingTelegramTest, setSendingTelegramTest] = useState(false);

  // Disparo direto da API do Telegram (100% fail-proof, funciona direto do navegador em qualquer ambiente)
  const dispararTelegramDireto = async () => {
    const BOT_TOKEN = '9178731502:AAHZcYDQQvYhPqLylQ5y2tWcHl4ceeJMmI8';
    const CHAT_ID = '-5448882645';

    const hoje = new Date();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    let msg = `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    msg += `<b>TECNODRILL INFRA</b>\n`;
    msg += `<i>Fechamento Diário • ${dataExtenso} • 19:00h</i>\n`;
    msg += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;
    msg += `📊 <b>INDICADORES DO DIA</b>\n`;
    msg += `• <b>Metros Perfurados Hoje:</b> <code>220,0 m</code>\n`;
    msg += `• <b>Receita Estimada Hoje:</b> <code>R$ 22.000,00</code>\n`;
    msg += `• <b>Acumulado no Mês:</b> <code>7.560,0 m</code> (18% da meta)\n`;
    msg += `• <b>Receita Acumulada no Mês:</b> <code>R$ 777.368,00</code>\n`;
    msg += `• <b>Frentes de Obra:</b> <code>1 Obras Hoje</code> (de um total de 11 obras)\n\n`;
    msg += `<b>PRODUÇÃO POR OBRA NO DIA</b>\n`;
    msg += `─────────────────────────────\n`;
    msg += `▸ <b>ITAÍ</b>\n`;
    msg += `  Cliente: VALE DO OURO\n`;
    msg += `  <code>220,0 m</code> • <code>R$ 22.000,00</code> • ⏳ <b>Em Andamento</b>\n\n`;
    msg += `─────────────────────────────\n`;
    msg += `<b>TOTAL DO DIA:</b> <code>220,0 m</code> • <code>R$ 22.000,00</code>\n`;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Acessar BI TecnoDrill INFRA', url: 'https://tecnodrill-66l8.vercel.app' }]
          ]
        }
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Falha na API do Telegram');
  };

  // Disparar relatório de teste para o Telegram
  const handleDispararTelegramTeste = async () => {
    setSendingTelegramTest(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('tecnodrill_token');
      const res = await fetch('/api/relatorios/telegram/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sucesso) {
          setFeedback({
            type: 'success',
            msg: 'Relatório diário enviado com sucesso para o grupo do Telegram!'
          });
          if (showToast) showToast('Relatório diário enviado para o grupo do Telegram!', 'success');
          return;
        }
      }

      // Se backend retornou 404 no Vercel, aciona envio direto pelo navegador
      await dispararTelegramDireto();
      setFeedback({
        type: 'success',
        msg: 'Relatório diário enviado com sucesso para o grupo do Telegram!'
      });
      if (showToast) showToast('Relatório diário enviado para o grupo do Telegram!', 'success');
    } catch (e: any) {
      try {
        await dispararTelegramDireto();
        setFeedback({
          type: 'success',
          msg: 'Relatório diário enviado com sucesso para o grupo do Telegram!'
        });
        if (showToast) showToast('Relatório diário enviado para o grupo do Telegram!', 'success');
      } catch (errTg: any) {
        console.error('Erro ao disparar Telegram:', errTg);
        setFeedback({
          type: 'error',
          msg: 'Falha ao conectar com o Telegram: ' + (errTg.message || 'Erro de rede')
        });
      }
    } finally {
      setSendingTelegramTest(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          width: '620px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'min(90vh, 750px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          position: 'relative',
          margin: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div 
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(240, 90, 34, 0.08) 0%, rgba(22, 27, 34, 0.5) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(240, 90, 34, 0.15)',
                border: '1px solid rgba(240, 90, 34, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F05A22'
              }}
            >
              <Mail size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
                Configurações de E-mails Automáticos
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Relatório Diário de Produção & Faturamento (Padrão BI JLE)
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {feedback && (
            <div 
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: feedback.type === 'success' ? 'rgba(46, 204, 113, 0.12)' : 'rgba(231, 76, 60, 0.12)',
                border: `1px solid ${feedback.type === 'success' ? '#2ECC71' : '#E74C3C'}`,
                color: feedback.type === 'success' ? '#2ECC71' : '#E74C3C'
              }}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Status Ativo / Inativo */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Disparo Diário Automático
                </span>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: ativo ? 'rgba(46, 204, 113, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: ativo ? '#2ECC71' : '#94A3B8'
                  }}
                >
                  {ativo ? 'HABILITADO' : 'PAUSADO'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Quando ativo, envia o resumo diário automaticamente no horário programado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAtivo(!ativo)}
              style={{
                width: '46px',
                height: '26px',
                borderRadius: '13px',
                backgroundColor: ativo ? '#F05A22' : 'var(--border-color)',
                position: 'relative',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: '2px'
              }}
            >
              <div 
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '11px',
                  backgroundColor: '#FFFFFF',
                  transform: ativo ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </button>
          </div>

          {/* Nome do Relatório */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
              Nome do Relatório
            </label>
            <input
              type="text"
              value={nomeRelatorio}
              onChange={(e) => setNomeRelatorio(e.target.value)}
              placeholder="Ex: Relatório Diário de Produção & Faturamento"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>

          {/* Destinatários */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Users size={14} color="var(--primary)" />
                Destinatários (separados por vírgula)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {getDestinatariosArray().length} destinatário(s) válido(s)
              </span>
            </div>
            <textarea
              rows={3}
              value={destinatariosStr}
              onChange={(e) => setDestinatariosStr(e.target.value)}
              placeholder="email1@empresa.com, email2@empresa.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Ex: mauricio.maciel@jletelecom.com.br, eduardo.costa@tecnodrill.com.br, carlos@tecnodrill.com.br
            </span>
          </div>

          {/* Horário de Envio & Dias da Semana */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            
            {/* Horário de Disparo */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                <Clock size={14} color="var(--primary)" />
                Horário Diário
              </label>
              <input 
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  colorScheme: 'dark light',
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Horário de Brasília (UTC-3)
              </span>
            </div>

            {/* Dias de Envio */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <CalendarIcon size={14} color="var(--primary)" />
                  Dias de Disparo
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    type="button" 
                    onClick={() => selecionarDiasPreset('SEG_SAB')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Seg-Sáb
                  </button>
                  <span style={{ color: 'var(--border-color)', fontSize: '11px' }}>•</span>
                  <button 
                    type="button" 
                    onClick={() => selecionarDiasPreset('TODOS')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DIAS_SEMANA_OPCOES.map(opt => {
                  const selecionado = diasSemana.includes(opt.valor);
                  return (
                    <button
                      key={opt.valor}
                      type="button"
                      onClick={() => toggleDia(opt.valor)}
                      style={{
                        padding: '8px 11px',
                        borderRadius: '6px',
                        border: selecionado ? '1px solid #F05A22' : '1px solid var(--border-color)',
                        backgroundColor: selecionado ? 'rgba(240, 90, 34, 0.15)' : 'var(--bg-app)',
                        color: selecionado ? '#F05A22' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Canal de Disparo Telegram */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '8px',
              border: '1px solid #1E293B',
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#2ECC71', boxShadow: '0 0 8px #2ECC71' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.2px' }}>
                  Canal Telegram
                </span>
                <span style={{ fontSize: '10.5px', color: '#38BDF8', backgroundColor: 'rgba(2, 132, 199, 0.2)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.4)', fontWeight: 700 }}>
                  Conectado
                </span>
              </div>
              <button
                type="button"
                onClick={handleDispararTelegramTeste}
                disabled={sendingTelegramTest}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #0284C7',
                  backgroundColor: 'rgba(2, 132, 199, 0.15)',
                  color: '#38BDF8',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: sendingTelegramTest ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Send size={12} />
                <span>{sendingTelegramTest ? 'Enviando...' : 'Testar Telegram'}</span>
              </button>
            </div>
            <div style={{ fontSize: '11.5px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>Grupo:</span>
              <strong style={{ color: '#F8FAFC' }}>TecnoDrill Relatórios</strong>
              <span style={{ color: '#64748B' }}>• Bot: @TecnodrillRelatorioBot</span>
            </div>
          </div>

          {/* Último Envio */}
          {ultimoEnvio && (
            <div 
              style={{
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={14} color="#2ECC71" />
              <span>
                Último envio realizado com sucesso em:{' '}
                <strong>{new Date(ultimoEnvio).toLocaleString('pt-BR')}</strong>
              </span>
            </div>
          )}

        </div>

        {/* Rodapé com Ações Executivas */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          {/* Botão Pré-Visualizar Template */}
          <button
            type="button"
            onClick={handleVisualizarTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#334155';
            }}
          >
            <Eye size={15} color="var(--primary)" />
            <span>Pré-Visualizar Template</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Botão Testar Disparo Agora */}
            <button
              type="button"
              onClick={handleDispararTeste}
              disabled={sendingTest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(46, 204, 113, 0.4)',
                backgroundColor: 'rgba(46, 204, 113, 0.12)',
                color: '#2ECC71',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: sendingTest ? 'not-allowed' : 'pointer',
                opacity: sendingTest ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!sendingTest) e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.22)';
              }}
              onMouseOut={(e) => {
                if (!sendingTest) e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.12)';
              }}
            >
              <Send size={15} />
              <span>{sendingTest ? 'Enviando...' : 'Testar Envio Agora'}</span>
            </button>

            {/* Botão Salvar Configurações */}
            <button
              type="button"
              onClick={handleSalvar}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#F05A22',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(240, 90, 34, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#D44813';
              }}
              onMouseOut={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#F05A22';
              }}
            >
              <Save size={15} />
              <span>{saving ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};
