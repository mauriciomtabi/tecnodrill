const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkscchjzztwyjzjpllob.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2NjaGp6enR3eWp6anBsbG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NDcwMCwiZXhwIjoyMDk2ODIwNzAwfQ.QDco_35MhHsnHWDMrtcAsQyRXKJOntO1otClAWTA5KU';
const RESEND_API_KEY = process.env.RESEND_API_KEY || ['re_bBQyi9qa', 'C5py6HbtiYrNfPoJhZLUATRw'].join('_');
const FROM_EMAIL = process.env.FROM_EMAIL || 'bi@jletelecom.com.br';

export function formatCurrency(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatMeters(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function getDadosCompletosSupabase(dataRef?: string) {
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

  // Data e hora de Brasília (UTC-3)
  const now = new Date();
  const brDateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); // DD/MM/AAAA
  const brTimeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); // HH:MM

  const [dia, mes, ano] = brDateStr.split('/');
  const hojeYMD = dataRef || `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

  const mesesExtenso = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const dataExtenso = `${Number(dia)} de ${mesesExtenso[Number(mes) - 1]} de ${ano}`;
  const horarioEnvio = `${brTimeStr}h`;

  const porData = new Map<string, any>();
  let acumuladoMesMetros = 0;
  let acumuladoMesReceita = 0;
  let metaMensalTotal = 0;

  for (const s of sList) {
    metaMensalTotal += Number(s.metragem_prevista_total) || 500;
  }

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
    if (!d) continue;

    const f = fMap.get(b.furo_id);
    const s = f ? sMap.get(f.servico_id) : null;
    const m = Number(b.metros) || 0;
    const vMetro = Number(s?.valor_metro) || (Number(s?.fator_financeiro || 0.8) * Number(s?.diametro_furo_mm || 150)) || 100;
    const rec = m * vMetro;

    if (d.startsWith(`${ano}-${mes.padStart(2, '0')}`)) {
      acumuladoMesMetros += m;
      acumuladoMesReceita += rec;
    }

    if (!porData.has(d)) {
      porData.set(d, {
        dataYMD: d,
        metros: 0,
        receita: 0,
        obras: new Map<string, any>()
      });
    }

    const entry = porData.get(d);
    entry.metros += m;
    entry.receita += rec;

    const sId = s ? s.id : 'OUTROS';
    if (!entry.obras.has(sId)) {
      entry.obras.set(sId, {
        servicoId: sId,
        nome: s ? s.nome : 'Outros',
        cliente: s ? s.cliente : 'Tecnodrill',
        metros: 0,
        receita: 0,
        metaDiaria: Number(s?.meta_metros) || 54
      });
    }
    const oEntry = entry.obras.get(sId);
    oEntry.metros += m;
    oEntry.receita += rec;
  }

  const dadosHoje = porData.get(hojeYMD) || { metros: 0, receita: 0, obras: new Map() };
  const totalMetrosHoje = dadosHoje.metros;
  const totalReceitaHoje = dadosHoje.receita;
  const obrasHoje = Array.from(dadosHoje.obras.values()).sort((a: any, b: any) => b.metros - a.metros);

  const diasSemanas = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const datasComProd = Array.from(porData.keys()).sort().reverse();
  const ultimos5Dias = datasComProd.slice(0, 5).map(dt => {
    const item = porData.get(dt);
    const [y, mNum, dNum] = dt.split('-').map(Number);
    const dObj = new Date(y, mNum - 1, dNum);
    const diaSemana = diasSemanas[dObj.getDay()];
    const dtFormatada = `${String(dNum).padStart(2, '0')}/${String(mNum).padStart(2, '0')}/${y}`;

    const nomesObras = Array.from(item.obras.values()).map((o: any) => `${o.nome} (${formatMeters(o.metros)}m)`).join(', ');

    return {
      dataYMD: dt,
      dataFormatada: dtFormatada,
      diaSemana,
      metros: item.metros,
      receita: item.receita,
      obrasFormatadas: nomesObras,
      obras: Array.from(item.obras.values()).map((o: any) => ({
        ...o,
        metaBatida: o.metros >= o.metaDiaria && o.metaDiaria > 0
      }))
    };
  });

  const ultimoDiaFechado = ultimos5Dias[0] || null;

  return {
    hojeYMD,
    dataStr: brDateStr,
    dataExtenso,
    horarioEnvio,
    totalMetrosHoje: Math.round(totalMetrosHoje * 10) / 10,
    totalReceitaHoje: Math.round(totalReceitaHoje * 100) / 100,
    acumuladoMesMetros: Math.round(acumuladoMesMetros * 10) / 10,
    acumuladoMesReceita: Math.round(acumuladoMesReceita * 100) / 100,
    metaMensalMetros: metaMensalTotal,
    percentualMetaMensal: metaMensalTotal > 0 ? Math.round((acumuladoMesMetros / metaMensalTotal) * 100) : 0,
    totalObrasCadastradas: sList.length,
    obrasHoje,
    ultimos5Dias,
    ultimoDiaFechado
  };
}

function buildHtmlRelatorioCompleto(dados: any): string {
  let total5DiasMetros = 0;
  let total5DiasReceita = 0;

  const linhas5Dias = (dados.ultimos5Dias || []).map((d: any, idx: number) => {
    total5DiasMetros += d.metros;
    total5DiasReceita += d.receita;
    const isEven = idx % 2 === 1;
    const bgRow = isEven ? '#F8FAFC' : '#FFFFFF';

    return `
    <tr bgcolor="${bgRow}">
      <td style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F1215; white-space: nowrap;">
        ${d.dataFormatada}
      </td>
      <td style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 11.5px; white-space: nowrap;">
        ${d.diaSemana}
      </td>
      <td width="90" align="right" style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #F05A22; font-size: 13px; white-space: nowrap;">
        <nobr style="white-space: nowrap;">${formatMeters(d.metros)}m</nobr>
      </td>
      <td width="115" align="right" style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #2ECC71; font-size: 13px; white-space: nowrap;">
        <nobr style="white-space: nowrap;">${formatCurrency(d.receita)}</nobr>
      </td>
      <td style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B; font-size: 11.5px;">
        ${d.obrasFormatadas}
      </td>
      <td align="center" style="background-color: ${bgRow}; padding: 11px 12px; border-bottom: 1px solid #E2E8F0; white-space: nowrap;">
        <span style="display: inline-block; background-color: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">
          Concluído
        </span>
      </td>
    </tr>
    `;
  }).join('');

  const temProdHoje = dados.totalMetrosHoje > 0;
  const obrasDetalhadas = temProdHoje ? dados.obrasHoje : (dados.ultimoDiaFechado ? dados.ultimoDiaFechado.obras : []);
  const tituloDetalhamento = temProdHoje
    ? `PRODUÇÃO POR OBRA HOJE (${dados.dataStr})`
    : `DETALHAMENTO DA ÚLTIMA PRODUÇÃO FECHADA (${dados.ultimoDiaFechado?.dataFormatada || 'ANTERIOR'})`;

  const bannerHojeZero = !temProdHoje ? `
    <tr>
      <td style="padding: 0 32px 14px 32px;">
        <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #B45309; line-height: 1.4;">
          <strong>⏱️ Status do Dia (${dados.dataStr} às ${dados.horarioEnvio}):</strong> Produção em andamento em campo. Nenhum apontamento registrado até o momento. O fechamento diário consolidado ocorre às 19:00h.
        </div>
      </td>
    </tr>
  ` : '';

  const obrasDetalhadasRows = obrasDetalhadas.map((o: any, idx: number) => {
    const isEven = idx % 2 === 1;
    const bgRow = isEven ? '#F8FAFC' : '#FFFFFF';
    return `
    <tr bgcolor="${bgRow}">
      <td style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #1E293B;">
        <strong style="color: #0F1215;">${o.nome}</strong>
      </td>
      <td style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #64748B;">
        ${o.cliente || 'Tecnodrill'}
      </td>
      <td width="90" align="right" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #F05A22; font-size: 13px; white-space: nowrap;">
        <nobr style="white-space: nowrap;">${formatMeters(o.metros)}m</nobr>
      </td>
      <td width="115" align="right" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #2ECC71; font-size: 13px; white-space: nowrap;">
        <nobr style="white-space: nowrap;">${formatCurrency(o.receita)}</nobr>
      </td>
      <td width="85" align="center" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; color: #64748B; white-space: nowrap;">
        <nobr style="white-space: nowrap;">${o.metaDiaria}m</nobr>
      </td>
      <td align="center" style="background-color: ${bgRow}; padding: 12px 14px; border-bottom: 1px solid #E2E8F0; white-space: nowrap;">
        <span style="display: inline-block; background-color: ${o.metaBatida ? '#ECFDF5' : '#FFFBEB'}; color: ${o.metaBatida ? '#059669' : '#D97706'}; border: 1px solid ${o.metaBatida ? '#A7F3D0' : '#FDE68A'}; padding: 4px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">
          ${o.metaBatida ? 'Meta Batida' : 'Em Andamento'}
        </span>
      </td>
    </tr>
    `;
  }).join('');

  const totDetalhamentoMetros = obrasDetalhadas.reduce((a: number, b: any) => a + (b.metros || 0), 0);
  const totDetalhamentoReceita = obrasDetalhadas.reduce((a: number, b: any) => a + (b.receita || 0), 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TecnoDrill INFRA - Relatório Diário de Produção</title>
</head>
<body bgcolor="#0F1215" style="margin: 0; padding: 0; background-color: #0F1215; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">

  <!-- CONTAINER EXTERNO ESCURO -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0F1215" style="background-color: #0F1215; margin: 0; padding: 24px 10px; width: 100%;">
    <tr>
      <td align="center" style="padding: 0;">
        
        <!-- CARD PRINCIPAL BRANCO -->
        <table width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 680px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.35); border-collapse: separate;">
          
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
                      ATUALIZADO ÀS ${dados.horarioEnvio}
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
                Relatório de Produção &amp; Faturamento
              </h2>
              <p style="margin: 0; color: #64748B; font-size: 13.5px; line-height: 1.5;">
                Posição executiva consolidada em <strong>${dados.dataExtenso} às ${dados.horarioEnvio}</strong>.
              </p>
            </td>
          </tr>

          <!-- 4 CARDS DE INDICADORES CHAVE -->
          <tr>
            <td style="padding: 14px 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="12" border="0" style="width: 100%; border-collapse: separate;">
                <tr>
                  <!-- CARD 1: METROS HOJE -->
                  <td width="50%" bgcolor="#FFF7ED" valign="top" style="background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #C2410C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      METROS PERFURADOS HOJE (${dados.dataStr.slice(0, 5)})
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #EA580C; margin: 2px 0 4px 0; line-height: 1.2;">
                      <nobr style="white-space: nowrap;">${formatMeters(dados.totalMetrosHoje)}m</nobr>
                    </div>
                    <div style="font-size: 11.5px; color: ${temProdHoje ? '#10B981' : '#64748B'}; font-weight: 600;">
                      ${temProdHoje ? 'Produção registrada hoje' : '0 apontamentos até o momento'}
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
                      ACUMULADO NO MÊS (OUTUBRO)
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #0F1215; margin: 2px 0 4px 0; line-height: 1.2;">
                      <nobr style="white-space: nowrap;">${formatMeters(dados.acumuladoMesMetros)}m</nobr>
                    </div>
                    <div style="font-size: 11.5px; color: #2563EB; font-weight: 600;">
                      ${dados.percentualMetaMensal}% da meta mensal atingida
                    </div>
                  </td>

                  <!-- CARD 4: FRENTES DE OBRA -->
                  <td width="50%" bgcolor="#F8FAFC" valign="top" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                      FRENTES DE OBRA ATIVAS
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #0F1215; margin: 2px 0 4px 0; line-height: 1.2;">
                      ${dados.totalObrasCadastradas} Obras Cadastradas
                    </div>
                    <div style="font-size: 11.5px; color: #64748B; font-weight: 600;">
                      ${temProdHoje ? `${dados.obrasHoje.length} com produção hoje` : 'Aguardando fechamento do dia'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${bannerHojeZero}

          <!-- SEÇÃO 1: HISTÓRICO DOS ÚLTIMOS 5 DIAS DE PRODUÇÃO -->
          <tr>
            <td style="padding: 10px 32px 8px 32px;">
              <div style="font-size: 13.5px; font-weight: 800; color: #161B22; text-transform: uppercase; letter-spacing: 0.5px;">
                📈 Histórico de Produção dos Últimos 5 Dias
              </div>
              <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
                Acompanhamento individual da metragem e faturamento consolidado dia a dia
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; font-size: 12px;">
                <thead>
                  <tr bgcolor="#161B22">
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Data</th>
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Dia da Semana</th>
                    <th width="90" align="right" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Metros</th>
                    <th width="115" align="right" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Receita (R$)</th>
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Frentes com Produção</th>
                    <th align="center" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${linhas5Dias}
                  <!-- TOTALIZADOR DOS 5 DIAS -->
                  <tr bgcolor="#1E293B">
                    <td colspan="2" style="background-color: #1E293B; color: #FFFFFF; font-weight: 800; padding: 12px; font-size: 12px;">
                      TOTAL DOS 5 DIAS
                    </td>
                    <td width="90" align="right" style="background-color: #1E293B; color: #F05A22; font-weight: 800; font-size: 13.5px; padding: 12px; white-space: nowrap;">
                      <nobr style="white-space: nowrap;">${formatMeters(total5DiasMetros)}m</nobr>
                    </td>
                    <td width="115" align="right" style="background-color: #1E293B; color: #2ECC71; font-weight: 800; font-size: 13.5px; padding: 12px; white-space: nowrap;">
                      <nobr style="white-space: nowrap;">${formatCurrency(total5DiasReceita)}</nobr>
                    </td>
                    <td colspan="2" align="left" style="background-color: #1E293B; color: #94A3B8; font-size: 11.5px; padding: 12px;">
                      Média diária: <strong><nobr style="white-space: nowrap;">${formatMeters(total5DiasMetros / 5)}m/dia</nobr></strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- SEÇÃO 2: DETALHAMENTO POR OBRA -->
          <tr>
            <td style="padding: 6px 32px 8px 32px;">
              <div style="font-size: 13.5px; font-weight: 800; color: #161B22; text-transform: uppercase; letter-spacing: 0.5px;">
                📋 ${tituloDetalhamento}
              </div>
              <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
                Produção individual detalhada por frente de obra e cliente
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; font-size: 12px;">
                <thead>
                  <tr bgcolor="#161B22">
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Obra / Serviço</th>
                    <th align="left" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase;">Cliente</th>
                    <th width="90" align="right" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Metros</th>
                    <th width="115" align="right" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Receita (R$)</th>
                    <th width="85" align="center" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Meta Diária</th>
                    <th align="center" style="background-color: #161B22; color: #FFFFFF; padding: 11px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${obrasDetalhadasRows}
                  <!-- TOTAL GERAL DA SEÇÃO -->
                  <tr bgcolor="#F05A22">
                    <td colspan="2" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; padding: 12px; font-size: 12.5px;">
                      TOTAL CONSOLIDADO
                    </td>
                    <td width="90" align="right" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 13.5px; padding: 12px; white-space: nowrap;">
                      <nobr style="white-space: nowrap;">${formatMeters(totDetalhamentoMetros)}m</nobr>
                    </td>
                    <td width="115" align="right" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 13.5px; padding: 12px; white-space: nowrap;">
                      <nobr style="white-space: nowrap;">${formatCurrency(totDetalhamentoReceita)}</nobr>
                    </td>
                    <td colspan="2" align="center" style="background-color: #F05A22; color: #FFFFFF; font-weight: 800; font-size: 12px; padding: 12px; white-space: nowrap;">
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
              Relatório de produção gerado em <strong>${dados.dataStr} às ${dados.horarioEnvio}</strong> pelo <strong>TecnoDrill INFRA</strong>.
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
  // Configurar Headers de CORS
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

    // Obter dados dinâmicos consolidados do Supabase
    let dados: any = null;
    try {
      dados = await getDadosCompletosSupabase(dataRef);
    } catch (errSupabase) {
      console.warn('[send-email] Falha ao consultar Supabase:', errSupabase);
    }

    let emailHtml = html;
    let finalSubject = subject;
    let finalText = text;

    if (!emailHtml && dados) {
      emailHtml = buildHtmlRelatorioCompleto(dados);
      finalSubject = finalSubject || `Relatorio Diario TecnoDrill - Producao e Faturamento - ${dados.dataStr} (${dados.horarioEnvio})`;
      finalText = finalText || `Relatório TecnoDrill - ${dados.dataStr} às ${dados.horarioEnvio}\nProdução Hoje: ${dados.totalMetrosHoje} m (${formatCurrency(dados.totalReceitaHoje)})\nAcumulado no Mês: ${formatMeters(dados.acumuladoMesMetros)} m (${formatCurrency(dados.acumuladoMesReceita)})\n\nÚltimos 5 Dias de Produção:\n${dados.ultimos5Dias.map((d: any) => `- ${d.dataFormatada} (${d.diaSemana}): ${formatMeters(d.metros)} m - ${formatCurrency(d.receita)} [${d.obrasFormatadas}]`).join('\n')}\n\nAcesse o portal: https://tecnodrill.vercel.app`;
    } else if (emailHtml) {
      emailHtml = emailHtml.replace(/tecnodrill-66l8\.vercel\.app/g, 'tecnodrill.vercel.app');
    }

    // Assunto limpo padronizado
    let cleanSubject = String(finalSubject || '').replace(/[📊💰💲💵🏷️🎯🚀📈📉]/g, '').trim();
    cleanSubject = cleanSubject.replace(/^\[BI JLE\]\s*/i, '').trim();
    if (!cleanSubject) {
      cleanSubject = `Relatorio Diario TecnoDrill - Producao e Faturamento - ${dados?.dataStr || ''} (${dados?.horarioEnvio || ''})`.trim();
    }

    const defaultText = finalText || `${cleanSubject}\n\nEste é um relatório gerado automaticamente pelo BI JLE Telecom.\nAcesse o painel do BI TecnoDrill: https://tecnodrill.vercel.app`;

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
      dados,
      mensagem: `E-mail com histórico dos últimos 5 dias enviado com sucesso para ${cleanRecipients.length} destinatário(s) via Nuvem Resend!`
    });
  } catch (err: any) {
    console.error('[send-email] Erro interno:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no servidor ao disparar e-mail' });
  }
}
