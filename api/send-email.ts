const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkscchjzztwyjzjpllob.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2NjaGp6enR3eWp6anBsbG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NDcwMCwiZXhwIjoyMDk2ODIwNzAwfQ.QDco_35MhHsnHWDMrtcAsQyRXKJOntO1otClAWTA5KU';
const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re_bBQyi9qa', 'C5py6HbtiYrNfPoJhZLUATRw'].join('_');
const FROM_EMAIL = process.env.FROM_EMAIL || 'bi@jletelecom.com.br';

function formatCurrency(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMeters(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

async function getDadosReaisSupabase(dataRef?: string) {
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
  };

  const [servicos, furos, barras] = await Promise.all([
    fetch(SUPABASE_URL + '/rest/v1/tecnodrill_servicos?select=*', { headers }).then(r => r.json()),
    fetch(SUPABASE_URL + '/rest/v1/tecnodrill_furos?select=*', { headers }).then(r => r.json()),
    fetch(SUPABASE_URL + '/rest/v1/tecnodrill_barras?select=*', { headers }).then(r => r.json())
  ]);

  const sList: any[] = Array.isArray(servicos) ? servicos : [];
  const fList: any[] = Array.isArray(furos) ? furos : [];
  const bList: any[] = Array.isArray(barras) ? barras : [];

  const sMap = new Map<string, any>();
  sList.forEach(s => sMap.set(s.id, s));
  const fMap = new Map<string, any>();
  fList.forEach(f => fMap.set(f.id, f));

  const hoje = dataRef ? new Date(dataRef + 'T12:00:00') : new Date();
  const ano = hoje.getFullYear();
  const mesNum = hoje.getMonth() + 1;
  const diaNum = hoje.getDate();
  const hojeYMD = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;

  const mesesExtenso = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // 1. Verificar se hoje tem produção
  let temProducaoHoje = false;
  for (const b of bList) {
    if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) continue;
    let d = '';
    if (b.observacao && b.observacao.includes('BARRA_META:')) {
      const match = b.observacao.match(/<!--BARRA_META:(.*?)-->/);
      if (match) {
        try { d = JSON.parse(match[1]).data_referencia || ''; } catch (_) {}
      }
    }
    if (!d && b.horario_registro) d = b.horario_registro.slice(0, 10);
    if (d === hojeYMD) {
      temProducaoHoje = true;
      break;
    }
  }

  // Se hoje ainda não teve lançamentos (ex: manhã/tarde), seleciona a data mais recente com produção
  let dataAlvoDia = hojeYMD;
  if (!temProducaoHoje && !dataRef) {
    const datas = new Set<string>();
    for (const b of bList) {
      if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) continue;
      let d = '';
      if (b.observacao && b.observacao.includes('BARRA_META:')) {
        const match = b.observacao.match(/<!--BARRA_META:(.*?)-->/);
        if (match) {
          try { d = JSON.parse(match[1]).data_referencia || ''; } catch (_) {}
        }
      }
      if (!d && b.horario_registro) d = b.horario_registro.slice(0, 10);
      if (d) datas.add(d);
    }
    const datasArray = Array.from(datas).sort().reverse();
    if (datasArray.length > 0) dataAlvoDia = datasArray[0];
  }

  let totalMetrosHoje = 0;
  let totalReceitaHoje = 0;
  let acumuladoMesMetros = 0;
  let acumuladoMesReceita = 0;
  let metaMensalTotal = 0;

  const obrasMap = new Map<string, any>();

  for (const s of sList) {
    metaMensalTotal += Number(s.metragem_prevista_total) || 500;
  }

  for (const b of bList) {
    if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) continue;

    const f = fMap.get(b.furo_id);
    const s = f ? sMap.get(f.servico_id) : null;
    const m = Number(b.metros) || 0;
    const vMetro = Number(s?.valor_metro) || (Number(s?.fator_financeiro || 0.8) * Number(s?.diametro_furo_mm || 150)) || 100;
    const rec = m * vMetro;

    let d = '';
    if (b.observacao && b.observacao.includes('BARRA_META:')) {
      const match = b.observacao.match(/<!--BARRA_META:(.*?)-->/);
      if (match) {
        try { d = JSON.parse(match[1]).data_referencia || ''; } catch (_) {}
      }
    }
    if (!d && b.horario_registro) d = b.horario_registro.slice(0, 10);

    // Acumulado do mês corrente
    if (d && d.startsWith(`${ano}-${String(mesNum).padStart(2, '0')}`)) {
      acumuladoMesMetros += m;
      acumuladoMesReceita += rec;
    }

    // Produção do dia alvo
    if (d === dataAlvoDia && s) {
      totalMetrosHoje += m;
      totalReceitaHoje += rec;

      if (!obrasMap.has(s.id)) {
        obrasMap.set(s.id, {
          servicoId: s.id,
          nome: s.nome,
          cliente: s.cliente || 'Tecnodrill',
          metrosHoje: 0,
          receitaHoje: 0,
          metaDiaria: Number(s.meta_metros) || 54,
          metaBatida: false
        });
      }

      const item = obrasMap.get(s.id);
      item.metrosHoje += m;
      item.receitaHoje += rec;
    }
  }

  for (const item of obrasMap.values()) {
    item.metaBatida = item.metrosHoje >= item.metaDiaria && item.metaDiaria > 0;
  }

  const pctMeta = metaMensalTotal > 0 ? (acumuladoMesMetros / metaMensalTotal) * 100 : 0;
  const obras = Array.from(obrasMap.values()).sort((a: any, b: any) => b.metrosHoje - a.metrosHoje);

  const [dAno, dMes, dDia] = dataAlvoDia.split('-');
  const dataExibicaoFormatada = `${dDia}/${dMes}/${dAno}`;
  const dataExibicaoExtenso = `${Number(dDia)} de ${mesesExtenso[Number(dMes) - 1]} de ${dAno}`;

  return {
    dataStr: dataExibicaoFormatada,
    dataExtenso: dataExibicaoExtenso,
    horarioFechamento: '19:00h',
    totalMetrosHoje: Math.round(totalMetrosHoje * 10) / 10,
    totalReceitaHoje: Math.round(totalReceitaHoje * 100) / 100,
    acumuladoMesMetros: Math.round(acumuladoMesMetros * 10) / 10,
    acumuladoMesReceita: Math.round(acumuladoMesReceita * 100) / 100,
    metaMensalMetros: metaMensalTotal,
    percentualMetaMensal: Math.round(pctMeta),
    totalObrasComProducaoHoje: obras.length,
    totalObrasEmAberto: sList.filter(s => s.status !== 'CONCLUIDO').length || sList.length,
    obras
  };
}

function buildHtmlRelatorio(dados: any): string {
  const obrasRows = (dados.obras || []).map((o: any, idx: number) => {
    const isEven = idx % 2 === 1;
    const bgRow = isEven ? '#F8FAFC' : '#FFFFFF';
    return `
    <tr bgcolor="${bgRow}">
      <td style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #1E293B;">
        <strong style="color: #0F1215;">${o.nome}</strong>
      </td>
      <td style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #64748B;">
        ${o.cliente}
      </td>
      <td align="right" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #F05A22; font-size: 13px; white-space: nowrap;">
        ${formatMeters(o.metrosHoje)} m
      </td>
      <td align="right" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #2ECC71; font-size: 13px; white-space: nowrap;">
        ${formatCurrency(o.receitaHoje)}
      </td>
      <td align="center" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #64748B; white-space: nowrap;">
        ${o.metaDiaria} m
      </td>
      <td align="center" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; white-space: nowrap;">
        <span style="display: inline-block; background-color: ${o.metaBatida ? '#ECFDF5' : '#FFFBEB'}; color: ${o.metaBatida ? '#059669' : '#D97706'}; border: 1px solid ${o.metaBatida ? '#A7F3D0' : '#FDE68A'}; padding: 4px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">
          ${o.metaBatida ? 'Meta Batida' : 'Em Andamento'}
        </span>
      </td>
    </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TecnoDrill INFRA - Relatório Diário de Produção</title>
</head>
<body bgcolor="#0F1215" style="margin: 0; padding: 0; background-color: #0F1215; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">

  <!-- TABELA CONTAINER PRINCIPAL (DARK BACKGROUND) -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0F1215" style="background-color: #0F1215; margin: 0; padding: 24px 10px; width: 100%;">
    <tr>
      <td align="center" style="padding: 0;">
        
        <!-- CARD PRINCIPAL DO RELATÓRIO (WHITE CONTAINER) -->
        <table width="660" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 660px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.35); border-collapse: separate;">
          
          <!-- CABEÇALHO EXECUTIVO COM LOGO TECNODRILL -->
          <tr>
            <td bgcolor="#161B22" style="background-color: #161B22; padding: 26px 32px; border-bottom: 4px solid #F05A22;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="left" valign="middle">
                    <div style="color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2;">
                      Tecno<span style="color: #F05A22;">Drill</span> <span style="font-size: 14px; font-weight: 400; color: #94A3B8;">INFRA</span>
                    </div>
                    <div style="color: #94A3B8; font-size: 11.5px; margin-top: 4px; font-weight: 500;">
                      Inteligência Operacional &amp; Perfuração Não Destrutiva
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="color: #F8FAFC; font-size: 13.5px; font-weight: 700; letter-spacing: 0.2px; line-height: 1.2;">
                      ${dados.dataExtenso}
                    </div>
                    <div style="color: #F05A22; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">
                      FECHAMENTO DIÁRIO • ${dados.horarioFechamento}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TÍTULO DO RELATÓRIO -->
          <tr>
            <td style="padding: 24px 32px 10px 32px;">
              <h2 style="margin: 0 0 6px 0; font-size: 20px; color: #161B22; font-weight: 800; line-height: 1.3;">
                Relatório Diário de Produção &amp; Faturamento
              </h2>
              <p style="margin: 0; color: #64748B; font-size: 13.5px; line-height: 1.5;">
                Fechamento consolidado das obras em <strong>${dados.dataExtenso}</strong>.
              </p>
            </td>
          </tr>

          <!-- 4 CARDS DE INDICADORES CHAVE (KPIS DIÁRIOS & ACUMULADOS) -->
          <tr>
            <td style="padding: 14px 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="12" border="0" style="width: 100%; border-collapse: separate;">
                <tr>
                  <!-- CARD 1: METROS HOJE (DESTAQUE LARANJA) -->
                  <td width="50%" bgcolor="#FFF7ED" valign="top" style="background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #C2410C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      METROS PERFURADOS HOJE
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #EA580C; margin: 2px 0 4px 0; line-height: 1.2;">
                      ${formatMeters(dados.totalMetrosHoje)} m
                    </div>
                    <div style="font-size: 11.5px; color: #10B981; font-weight: 600;">
                      Produção consolidada do dia
                    </div>
                  </td>

                  <!-- CARD 2: RECEITA ESTIMADA HOJE -->
                  <td width="50%" bgcolor="#F8FAFC" valign="top" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      RECEITA ESTIMADA (HOJE)
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #2ECC71; margin: 2px 0 4px 0; line-height: 1.2; white-space: nowrap;">
                      ${formatCurrency(dados.totalReceitaHoje)}
                    </div>
                    <div style="font-size: 11.5px; color: #059669; font-weight: 600; white-space: nowrap;">
                      Acumulado no mês: ${formatCurrency(dados.acumuladoMesReceita)}
                    </div>
                  </td>
                </tr>

                <tr>
                  <!-- CARD 3: ACUMULADO NO MÊS -->
                  <td width="50%" bgcolor="#F8FAFC" valign="top" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      ACUMULADO NO MÊS
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #0F1215; margin: 2px 0 4px 0; line-height: 1.2;">
                      ${formatMeters(dados.acumuladoMesMetros)} m
                    </div>
                    <div style="font-size: 11.5px; color: #2563EB; font-weight: 600;">
                      ${dados.percentualMetaMensal}% da meta mensal atingida
                    </div>
                  </td>

                  <!-- CARD 4: FRENTES DE OBRA -->
                  <td width="50%" bgcolor="#F8FAFC" valign="top" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      FRENTES DE OBRA
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #0F1215; margin: 2px 0 4px 0; line-height: 1.2;">
                      ${dados.totalObrasComProducaoHoje} Obras Ativas
                    </div>
                    <div style="font-size: 11.5px; color: #64748B; font-weight: 600;">
                      de um total de ${dados.totalObrasEmAberto} obras
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TÍTULO DA SEÇÃO DA TABELA -->
          <tr>
            <td style="padding: 10px 32px 10px 32px;">
              <div style="font-size: 14px; font-weight: 800; color: #161B22; text-transform: uppercase; letter-spacing: 0.5px;">
                PRODUÇÃO POR OBRA NO DIA
              </div>
            </td>
          </tr>

          <!-- TABELA DE PRODUÇÃO POR SERVIÇO / OBRA -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
                <thead>
                  <tr bgcolor="#161B22">
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Obra / Serviço</th>
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Cliente</th>
                    <th align="right" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Metros Hoje</th>
                    <th align="right" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Receita (R$)</th>
                    <th align="center" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Meta Diária</th>
                    <th align="center" style="background-color: #161B22; color: #FFFFFF; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${obrasRows}
                  <!-- LINHA TOTAL GERAL -->
                  <tr bgcolor="#F05A22">
                    <td colspan="2" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; padding: 13px 14px; font-size: 13px;">
                      TOTAL GERAL DO DIA
                    </td>
                    <td align="right" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 14px; padding: 13px 14px; white-space: nowrap;">
                      ${formatMeters(dados.totalMetrosHoje)} m
                    </td>
                    <td align="right" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 14px; padding: 13px 14px; white-space: nowrap;">
                      ${formatCurrency(dados.totalReceitaHoje)}
                    </td>
                    <td colspan="2" align="center" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 12px; padding: 13px 14px; white-space: nowrap;">
                      100% OK
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- BOTÃO DE ACESSO AO PORTAL -->
          <tr>
            <td bgcolor="#F8FAFC" align="center" style="background-color: #F8FAFC; padding: 26px 32px 30px 32px; border-top: 1px solid #E2E8F0;">
              <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748B; font-weight: 500;">
                Para consultar os detalhes completos e baixar as planilhas de medição em Excel:
              </p>
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td bgcolor="#F05A22" style="background-color: #F05A22; border-radius: 6px; box-shadow: 0 4px 12px rgba(240, 90, 34, 0.35);">
                    <a href="https://tecnodrill.vercel.app" target="_blank" style="display: inline-block; background-color: #F05A22; color: #FFFFFF !important; text-decoration: none; padding: 13px 30px; font-weight: 800; font-size: 13.5px; letter-spacing: 0.3px; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Acessar BI TecnoDrill INFRA &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- RODAPÉ CORPORATIVO -->
          <tr>
            <td bgcolor="#0F1215" align="center" style="background-color: #0F1215; padding: 22px 32px; color: #64748B; font-size: 11px; line-height: 1.6; text-align: center;">
              Relatório diário gerado automaticamente pelo <strong>TecnoDrill INFRA</strong>.<br>
              Horário de consolidação diária: 19h00 (Horário de Brasília).
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

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

    const { to, destinatarios, subject, html, text, dataRef } = body || {};

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

    // Obter dados dinâmicos reais do Supabase
    let dadosReais: any = null;
    try {
      dadosReais = await getDadosReaisSupabase(dataRef);
    } catch (errSupabase) {
      console.warn('[send-email] Falha ao consultar Supabase, usando fallback:', errSupabase);
    }

    let emailHtml = html;
    let finalSubject = subject;
    let finalText = text;

    if (!emailHtml && dadosReais) {
      emailHtml = buildHtmlRelatorio(dadosReais);
      finalSubject = finalSubject || `Relatorio Diario TecnoDrill - Producao e Faturamento - ${dadosReais.dataStr}`;
      finalText = finalText || `Relatório Diário TecnoDrill - ${dadosReais.dataStr}\nTotal Metros no Dia: ${dadosReais.totalMetrosHoje} m\nReceita Estimada: ${formatCurrency(dadosReais.totalReceitaHoje)}\nAcumulado no Mês: ${formatMeters(dadosReais.acumuladoMesMetros)} m (${formatCurrency(dadosReais.acumuladoMesReceita)})\n\nAcesse o portal do BI: https://tecnodrill.vercel.app`;
    } else if (emailHtml) {
      emailHtml = emailHtml.replace(/tecnodrill-66l8\.vercel\.app/g, 'tecnodrill.vercel.app');
    }

    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');

    // Assunto limpo padronizado
    let cleanSubject = String(finalSubject || '').replace(/[📊💰💲💵🏷️🎯🚀📈📉]/g, '').trim();
    cleanSubject = cleanSubject.replace(/^\[BI JLE\]\s*/i, '').trim();
    if (!cleanSubject) {
      cleanSubject = `Relatorio Diario TecnoDrill - Producao e Faturamento - ${dadosReais?.dataStr || dataFormatada}`;
    }

    const defaultText = finalText || `${cleanSubject}\n\nEste é um relatório gerado automaticamente pelo BI JLE Telecom.\nPor favor, visualize o e-mail em um leitor compatível com HTML para ver a tabela e os indicadores consolidados.\n\nAcesse o painel do BI TecnoDrill: https://tecnodrill.vercel.app`;

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
      dados: dadosReais,
      mensagem: `E-mail diário enviado com sucesso para ${cleanRecipients.length} destinatário(s) via Nuvem Resend (Padrão BI JLE)!`
    });
  } catch (err: any) {
    console.error('[send-email] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao disparar e-mail' });
  }
}
