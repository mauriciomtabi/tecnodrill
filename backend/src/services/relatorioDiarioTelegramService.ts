import fs from 'fs';
import path from 'path';
import { DadosFechamentoDiario, RelatorioDiarioEmailService } from './relatorioDiarioEmailService';

export interface ConfigTelegram {
  ativo: boolean;
  botToken: string;
  chatId: string;
  chatNome?: string;
  ultimoEnvio?: string;
  updatedAt?: string;
}

const DEFAULT_TELEGRAM_CONFIG: ConfigTelegram = {
  ativo: true,
  botToken: process.env.TELEGRAM_BOT_TOKEN || '9178731502:AAHZcYDQQvYhPqLylQ5y2tWcHl4ceeJMmI8',
  chatId: process.env.TELEGRAM_CHAT_ID || '-5448882645',
  chatNome: 'TecnoDrill Relatórios'
};

function getTelegramConfigFilePath(): string {
  const candidates = [
    path.join(process.cwd(), 'backend', 'data', 'tecnodrill_telegram_config.json'),
    path.join(process.cwd(), 'data', 'tecnodrill_telegram_config.json'),
    path.join(__dirname, '..', '..', 'data', 'tecnodrill_telegram_config.json'),
    path.join('/tmp', 'tecnodrill_telegram_config.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export class RelatorioDiarioTelegramService {
  /**
   * Obtém as configurações salvas do Telegram
   */
  public static getConfigTelegram(): ConfigTelegram {
    try {
      const configPath = getTelegramConfigFilePath();
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return { ...DEFAULT_TELEGRAM_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[TelegramService] Erro ao ler config, usando default:', e);
    }
    return DEFAULT_TELEGRAM_CONFIG;
  }

  /**
   * Atualiza e persiste as configurações do Telegram
   */
  public static salvarConfigTelegram(novaConfig: Partial<ConfigTelegram>): ConfigTelegram {
    const atual = this.getConfigTelegram();
    const mesclada: ConfigTelegram = {
      ...atual,
      ...novaConfig,
      updatedAt: new Date().toISOString()
    };
    try {
      const configPath = getTelegramConfigFilePath();
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(mesclada, null, 2), 'utf-8');
    } catch (e) {
      console.error('[TelegramService] Erro ao salvar config:', e);
      try {
        const tmpPath = path.join('/tmp', 'tecnodrill_telegram_config.json');
        fs.writeFileSync(tmpPath, JSON.stringify(mesclada, null, 2), 'utf-8');
      } catch (_) {}
    }
    return mesclada;
  }

  /**
   * Detecta o Chat ID do grupo a partir do histórico de updates do bot
   */
  public static async detectarChatId(botToken?: string): Promise<{ sucesso: boolean; chatId?: string; chatTitle?: string; mensagem: string }> {
    const token = botToken || this.getConfigTelegram().botToken || '9178731502:AAHZcYDQQvYhPqLylQ5y2tWcHl4ceeJMmI8';
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data: any = await res.json();
      if (data.ok && data.result && data.result.length > 0) {
        for (let i = data.result.length - 1; i >= 0; i--) {
          const upd = data.result[i];
          const chat = upd.message?.chat || upd.my_chat_member?.chat || upd.channel_post?.chat;
          if (chat) {
            const chatId = String(chat.id);
            const chatTitle = chat.title || chat.first_name || 'Chat Telegram';
            this.salvarConfigTelegram({ chatId, chatNome: chatTitle });
            return {
              sucesso: true,
              chatId,
              chatTitle,
              mensagem: `Chat encontrado: ${chatTitle} (ID: ${chatId})`
            };
          }
        }
      }
      return {
        sucesso: false,
        mensagem: 'Nenhum update recente encontrado no Telegram. Promova o bot a Administrador do grupo ou digite /start no grupo.'
      };
    } catch (e: any) {
      return {
        sucesso: false,
        mensagem: `Erro ao consultar updates da API Telegram: ${e.message}`
      };
    }
  }

  /**
   * Constrói a mensagem corporativa formatada para o Telegram
   */
  public static formatarMensagemTelegram(dados: DadosFechamentoDiario): string {
    const dataExtenso = dados.dataExtenso;
    const horario = dados.horarioFechamento;
    const metrosHoje = dados.totalMetrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
    const receitaHoje = dados.totalReceitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const acumuladoMes = dados.acumuladoMesMetros.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
    const receitaAcumuladaMes = dados.acumuladoMesReceita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const pctMeta = dados.percentualMetaMensal;
    const obrasComProd = dados.totalObrasComProducaoHoje;
    const obrasEmAberto = dados.totalObrasEmAberto;

    let msg = `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
    msg += `<b>TECNODRILL INFRA</b>\n`;
    msg += `<i>Fechamento Diário • ${dataExtenso} • ${horario}</i>\n`;
    msg += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;

    msg += `📊 <b>INDICADORES DO DIA</b>\n`;
    msg += `• <b>Metros Perfurados Hoje:</b> <code>${metrosHoje} m</code>\n`;
    msg += `• <b>Receita Estimada Hoje:</b> <code>${receitaHoje}</code>\n`;
    msg += `• <b>Acumulado no Mês:</b> <code>${acumuladoMes} m</code> (${pctMeta}% da meta)\n`;
    msg += `• <b>Receita Acumulada no Mês:</b> <code>${receitaAcumuladaMes}</code>\n`;
    msg += `• <b>Frentes de Obra:</b> <code>${obrasComProd} Obras Hoje</code> (de um total de ${obrasEmAberto} obras)\n\n`;

    msg += `<b>PRODUÇÃO POR OBRA NO DIA</b>\n`;
    msg += `─────────────────────────────\n`;

    if (dados.obras.length === 0) {
      msg += `<i>Nenhuma produção registrada nesta data até o momento.</i>\n`;
    } else {
      for (const o of dados.obras) {
        const m = o.metrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1 });
        const r = o.receitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const tagStatus = o.metaBatida ? '✅ Meta Batida' : '⏳ Em Andamento';
        msg += `▸ <b>${o.nome}</b>\n`;
        msg += `  Cliente: ${o.cliente}\n`;
        msg += `  <code>${m} m</code> • <code>${r}</code> • <b>${tagStatus}</b>\n\n`;
      }
    }

    msg += `─────────────────────────────\n`;
    msg += `<b>TOTAL DO DIA:</b> <code>${metrosHoje} m</code> • <code>${receitaHoje}</code>\n`;

    return msg;
  }

  /**
   * Envia o relatório diário para o Telegram via Bot HTTP API
   */
  public static async enviarRelatorioTelegram(
    chatIdCustom?: string,
    botTokenCustom?: string,
    dataRef?: string
  ): Promise<{ sucesso: boolean; mensagem: string; dados?: any }> {
    const config = this.getConfigTelegram();
    const token = botTokenCustom || config.botToken || process.env.TELEGRAM_BOT_TOKEN || '9178731502:AAHZcYDQQvYhPqLylQ5y2tWcHl4ceeJMmI8';
    const chatId = chatIdCustom || config.chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        sucesso: false,
        mensagem: 'Token do Bot ou Chat ID do grupo ainda não configurados para o Telegram.'
      };
    }

    const dados = await RelatorioDiarioEmailService.getDadosFechamentoDiario(dataRef);
    const texto = this.formatarMensagemTelegram(dados);

    const payload = {
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📊 Acessar BI TecnoDrill INFRA',
              url: 'https://tecnodrill.vercel.app'
            }
          ]
        ]
      }
    };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson: any = await res.json();
      if (!resJson.ok) {
        throw new Error(resJson.description || 'Erro desconhecido da API Telegram');
      }

      this.salvarConfigTelegram({ ultimoEnvio: new Date().toISOString() });

      return {
        sucesso: true,
        mensagem: 'Relatório diário enviado com sucesso para o Telegram!',
        dados
      };
    } catch (err: any) {
      console.error('[TelegramService] Erro ao enviar mensagem:', err);
      return {
        sucesso: false,
        mensagem: `Falha no envio Telegram: ${err.message || 'Erro de conexão'}`
      };
    }
  }
}
