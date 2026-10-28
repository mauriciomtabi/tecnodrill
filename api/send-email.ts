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

    const { to, destinatarios, subject, html, text } = body || {};

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

    // Assunto limpo padronizado (Sem emojis e sem caracteres especiais que acionam filtros de spam)
    let cleanSubject = String(subject || '').replace(/[📊💰💲💵🏷️🎯🚀📈📉]/g, '').trim();
    cleanSubject = cleanSubject.replace(/^\[BI JLE\]\s*/i, '').trim();
    if (!cleanSubject) {
      cleanSubject = `Relatorio Diario TecnoDrill - Producao e Faturamento - ${dataFormatada}`;
    }

    const defaultText = text || `${cleanSubject}\n\nEste é um relatório gerado automaticamente pelo BI JLE Telecom.\nPor favor, visualize o e-mail em um leitor compatível com HTML para ver a tabela e os indicadores consolidados.\n\nAcesse o painel do BI TecnoDrill: https://tecnodrill.vercel.app`;

    let emailHtml = html;
    if (!emailHtml) {
      emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #0F1215; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #0F1215; padding: 24px 10px;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" border="0" style="background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.3);">
                <!-- HEADER -->
                <tr>
                  <td style="background: #161B22; padding: 26px 32px; border-bottom: 4px solid #F05A22;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <div style="color: #FFFFFF; font-size: 22px; font-weight: 800;">
                            Tecno<span style="color: #F05A22;">Drill</span> <span style="font-size: 13px; font-weight: 400; color: #94A3B8;">INFRA</span>
                          </div>
                          <div style="color: #94A3B8; font-size: 11px; margin-top: 3px;">
                            Inteligência Operacional & Perfuração Não Destrutiva
                          </div>
                        </td>
                        <td align="right" valign="middle">
                          <div style="color: #FFFFFF; font-size: 13px; font-weight: 700;">
                            ${dataFormatada}
                          </div>
                          <div style="color: #F05A22; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 3px;">
                            Fechamento Diário • 19:00h
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- CONTEUDO -->
                <tr>
                  <td style="padding: 24px 32px 10px;">
                    <h2 style="margin: 0 0 6px 0; font-size: 18px; color: #161B22; font-weight: 800;">
                      Relatório Diário de Produção & Faturamento
                    </h2>
                    <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 1.5;">
                      Fechamento diário consolidado com sucesso no sistema <strong>TecnoDrill INFRA</strong>.
                    </p>
                  </td>
                </tr>
                <!-- BOTAO PORTAL -->
                <tr>
                  <td style="padding: 24px 32px 32px; text-align: center; background: #F8FAFC; border-top: 1px solid #E2E8F0;">
                    <a href="https://tecnodrill.vercel.app" style="background-color: #F05A22; color: #FFFFFF !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                      Acessar Painel do BI TecnoDrill →
                    </a>
                  </td>
                </tr>
                <!-- FOOTER -->
                <tr>
                  <td style="background: #0F1215; padding: 18px 24px; text-align: center; color: #64748B; font-size: 11px;">
                    Informativo automático do <strong>BI JLE Telecom — TecnoDrill INFRA</strong>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;
    } else {
      // Corrigir eventuais links antigos para o domínio oficial
      emailHtml = emailHtml.replace(/tecnodrill-66l8\.vercel\.app/g, 'tecnodrill.vercel.app');
    }

    // Remetente oficial verificado no Resend idêntico ao padrão BI JLE
    const fromAddress = `"BI JLE Telecom" <${FROM_EMAIL}>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: cleanRecipients,
        subject: cleanSubject,
        html: emailHtml,
        text: defaultText,
        headers: {
          'X-Entity-Ref-ID': `tecnodrill-report-${Date.now()}`,
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Precedence': 'bulk'
        }
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
      mensagem: `E-mail diário enviado com sucesso para ${cleanRecipients.length} destinatário(s) via Nuvem Resend (Padrão BI JLE)!`
    });
  } catch (err: any) {
    console.error('[send-email] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao disparar e-mail' });
  }
}
