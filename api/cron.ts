import { enviarRelatorioEmailExec } from './send-email';
import { enviarRelatorioTelegramExec } from './send-telegram';

export default async function handler(req: any, res: any) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { }
    }

    const dataRef = req.query?.data || body?.dataRef || undefined;
    console.log(`⏰ [Vercel Cron 19h] Disparando rotina diária automatizada (DataRef: ${dataRef || 'hoje'})...`);

    // Disparar E-mail e Telegram simultaneamente
    const [emailRes, telegramRes] = await Promise.allSettled([
      enviarRelatorioEmailExec({ dataRef }),
      enviarRelatorioTelegramExec({ dataRef })
    ]);

    const emailResult = emailRes.status === 'fulfilled'
      ? emailRes.value
      : { sucesso: false, error: (emailRes as any).reason?.message || 'Falha no disparo do e-mail' };

    const telegramResult = telegramRes.status === 'fulfilled'
      ? telegramRes.value
      : { sucesso: false, error: (telegramRes as any).reason?.message || 'Falha no disparo do Telegram' };

    console.log('📬 [Cron] E-mail:', emailResult.sucesso ? 'Sucesso' : emailResult.error);
    console.log('📱 [Cron] Telegram:', telegramResult.sucesso ? 'Sucesso' : telegramResult.error);

    const isOk = emailResult.sucesso || telegramResult.sucesso;

    return res.status(isOk ? 200 : 500).json({
      status: isOk ? 'ok' : 'error',
      executadoEm: new Date().toISOString(),
      email: emailResult,
      telegram: telegramResult
    });
  } catch (err: any) {
    console.error('❌ [Cron] Erro fatal na execução:', err);
    return res.status(500).json({ error: 'Erro crítico no cron diário', details: err.message });
  }
}
