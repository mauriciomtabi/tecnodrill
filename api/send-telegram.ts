import { getDadosCompletosSupabase, formatMeters, formatCurrency } from './send-email';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9178731502:AAHZcYDQQvYhPqLylQ5y2tWcHl4ceeJMmI8';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5448882645';

export function buildTelegramMessage(dados: any): string {
  const temProdHoje = dados.totalMetrosHoje > 0;
  const metrosHojeStr = formatMeters(dados.totalMetrosHoje);
  const receitaHojeStr = formatCurrency(dados.totalReceitaHoje);
  const acumuladoMesStr = formatMeters(dados.acumuladoMesMetros);
  const receitaAcumuladaMesStr = formatCurrency(dados.acumuladoMesReceita);

  let msg = `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n`;
  msg += `<b>TECNODRILL INFRA</b>\n`;
  msg += `<i>Relatório Diário • ${dados.dataExtenso} • ${dados.horarioEnvio}</i>\n`;
  msg += `<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n`;

  msg += `📊 <b>INDICADORES CONSOLIDADOS</b>\n`;
  msg += `• <b>Produção Hoje:</b> <code>${metrosHojeStr}m</code> (${receitaHojeStr})\n`;
  if (!temProdHoje) {
    msg += `• <b>Status Hoje:</b> ⏱️ <i>Produção em andamento em campo. Fechamento consolidado às 19:00h.</i>\n`;
  }
  msg += `• <b>Acumulado no Mês:</b> <code>${acumuladoMesStr}m</code> (${dados.percentualMetaMensal}% da meta)\n`;
  msg += `• <b>Receita Acumulada no Mês:</b> <code>${receitaAcumuladaMesStr}</code>\n`;
  msg += `• <b>Frentes Cadastradas:</b> <code>${dados.totalObrasCadastradas} Obras</code>\n\n`;

  // Histórico dos Últimos 5 Dias
  if (dados.ultimos5Dias && dados.ultimos5Dias.length > 0) {
    let tot5m = 0;
    let tot5r = 0;
    msg += `📈 <b>HISTÓRICO DOS ÚLTIMOS 5 DIAS</b>\n`;
    msg += `─────────────────────────────\n`;
    for (const d of dados.ultimos5Dias) {
      tot5m += d.metros;
      tot5r += d.receita;
      msg += `📅 <b>${d.dataFormatada} (${d.diaSemana})</b>\n`;
      msg += `  Produção: <code>${formatMeters(d.metros)}m</code> • <code>${formatCurrency(d.receita)}</code>\n`;
      msg += `  Frentes: <i>${d.obrasFormatadas}</i>\n\n`;
    }
    msg += `📊 <b>TOTAL 5 DIAS:</b> <code>${formatMeters(tot5m)}m</code> • <code>${formatCurrency(tot5r)}</code>\n`;
    msg += `<i>Média diária: ${formatMeters(tot5m / dados.ultimos5Dias.length)}m/dia</i>\n\n`;
  }

  // Detalhamento por obra da última produção fechada ou de hoje
  const obrasDetalhadas = temProdHoje ? dados.obrasHoje : (dados.ultimoDiaFechado ? dados.ultimoDiaFechado.obras : []);
  const tituloDet = temProdHoje
    ? `PRODUÇÃO POR OBRA HOJE (${dados.dataStr})`
    : `DETALHAMENTO DA ÚLTIMA PRODUÇÃO (${dados.ultimoDiaFechado?.dataFormatada || 'ANTERIOR'})`;

  msg += `📋 <b>${tituloDet}</b>\n`;
  msg += `─────────────────────────────\n`;

  if (!obrasDetalhadas || obrasDetalhadas.length === 0) {
    msg += `<i>Nenhum apontamento nesta data até o momento.</i>\n`;
  } else {
    for (const o of obrasDetalhadas) {
      const mStr = formatMeters(o.metros);
      const rStr = formatCurrency(o.receita);
      const tag = o.metaBatida ? '✅ Meta Batida' : '⏳ Em Andamento';
      msg += `▸ <b>${o.nome}</b>\n`;
      msg += `  Cliente: ${o.cliente || 'Tecnodrill'}\n`;
      msg += `  <code>${mStr}m</code> • <code>${rStr}</code> • <b>${tag}</b>\n\n`;
    }
  }

  const totMetros = obrasDetalhadas.reduce((a: number, b: any) => a + (b.metros || 0), 0);
  const totReceita = obrasDetalhadas.reduce((a: number, b: any) => a + (b.receita || 0), 0);
  msg += `─────────────────────────────\n`;
  msg += `<b>TOTAL:</b> <code>${formatMeters(totMetros)}m</code> • <code>${formatCurrency(totReceita)}</code>\n`;

  return msg;
}

export async function enviarRelatorioTelegramExec(options?: {
  chatId?: string;
  botToken?: string;
  dataRef?: string;
}): Promise<{ sucesso: boolean; id?: number; error?: string; dados?: any; mensagem?: string }> {
  try {
    const { chatId, botToken, dataRef } = options || {};

    const token = botToken || DEFAULT_BOT_TOKEN;
    const targetChatId = chatId || DEFAULT_CHAT_ID;

    if (!token || !targetChatId) {
      return { sucesso: false, error: 'Token ou Chat ID do Telegram não configurados.' };
    }

    const dados = await getDadosCompletosSupabase(dataRef);
    const mensagemTexto = buildTelegramMessage(dados);

    const payload = {
      chat_id: targetChatId,
      text: mensagemTexto,
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

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tgData: any = await tgRes.json();

    if (!tgData.ok) {
      console.error('[send-telegram] Erro API Telegram:', tgData);
      return {
        sucesso: false,
        error: tgData.description || 'Falha ao entregar mensagem no Telegram'
      };
    }

    return {
      sucesso: true,
      id: tgData.result?.message_id,
      dados,
      mensagem: 'Relatório diário com histórico dos últimos 5 dias enviado com sucesso para o grupo do Telegram!'
    };
  } catch (err: any) {
    console.error('[send-telegram] Erro interno no envio:', err);
    return {
      sucesso: false,
      error: err.message || 'Erro interno no envio Telegram'
    };
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { }
    }

    const payload = {
      ...(body || {}),
      dataRef: req.query?.data || body?.dataRef
    };

    const resultado = await enviarRelatorioTelegramExec(payload);

    if (!resultado.sucesso) {
      return res.status(502).json({
        success: false,
        sucesso: false,
        error: resultado.error
      });
    }

    return res.status(200).json({
      success: true,
      sucesso: true,
      id: resultado.id,
      dados: resultado.dados,
      mensagem: resultado.mensagem
    });
  } catch (err: any) {
    console.error('[send-telegram] Erro interno:', err);
    return res.status(500).json({
      success: false,
      sucesso: false,
      error: err.message || 'Erro interno no envio Telegram'
    });
  }
}

