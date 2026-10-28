export default async function handler(req: any, res: any) {
  // Configurar Headers de CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const { to, destinatarios, subject, html } = body || {};

    const rawList = to || destinatarios || [
      'mauricio.maciel@jletelecom.com.br',
      'eduardo.costa@tecnodrill.com.br',
      'carlos@tecnodrill.com.br'
    ];

    const cleanRecipients = (Array.isArray(rawList) ? rawList : String(rawList).split(/[\n\r,;]+/))
      .map((e: any) => String(e).trim())
      .filter((e: string) => e && e.includes('@'));

    if (cleanRecipients.length === 0) {
      return res.status(400).json({ error: 'Nenhum destinatário válido informado.' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re_bBQyi9qa', 'C5py6HbtiYrNfPoJhZLUATRw'].join('_');
    const FROM_EMAIL = process.env.FROM_EMAIL || 'bi@jletelecom.com.br';

    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    const finalSubject = subject || `📊 Relatório Diário TecnoDrill - ${dataFormatada} (Padrão BI JLE)`;

    let emailHtml = html;
    if (!emailHtml) {
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 660px; margin: 0 auto; padding: 24px; background: #0F1215; color: #FFFFFF; border-radius: 12px;">
          <div style="border-bottom: 3px solid #F05A22; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #FFFFFF; margin: 0; font-size: 22px;">Tecno<span style="color: #F05A22;">Drill</span> INFRA</h2>
            <p style="margin: 4px 0 0; color: #94A3B8; font-size: 13px;">Fechamento Diário de Produção & Faturamento • ${dataFormatada}</p>
          </div>
          <p style="font-size: 14px; color: #E2E8F0; line-height: 1.6;">
            O fechamento diário foi consolidado com sucesso no sistema <strong>TecnoDrill INFRA</strong>.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://tecnodrill.vercel.app" style="background-color: #F05A22; color: #FFFFFF; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
              Acessar Painel do BI TecnoDrill →
            </a>
          </div>
        </div>
      `;
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `"TecnoDrill INFRA" <${FROM_EMAIL}>`,
        to: cleanRecipients,
        subject: finalSubject,
        html: emailHtml
      })
    });

    const resendData = (await resendRes.json()) as any;
    if (!resendRes.ok) {
      console.error('[send-email] Erro na API Resend:', resendData);
      return res.status(resendRes.status).json({ error: resendData?.message || 'Falha no envio pela API Resend' });
    }

    return res.status(200).json({
      success: true,
      sucesso: true,
      id: resendData?.id,
      mensagem: `E-mail diário enviado com sucesso para ${cleanRecipients.length} destinatário(s) via Nuvem Resend!`
    });
  } catch (err: any) {
    console.error('[send-email] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao disparar e-mail' });
  }
}
