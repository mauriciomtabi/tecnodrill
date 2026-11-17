import ExcelJS from 'exceljs';
import { Servico, Barra } from '../types';
import { parseBarraObservacao, calcularValorMetroBarra } from '../services/api';
import { TECNODRILL_LOGO_BASE64 } from './tecnodrillLogoBase64';

export const MESES_NOMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

// Paleta Oficial TecnoDrill
const COLOR_TECNODRILL_ORANGE = 'FFF05A22';
const COLOR_TECNODRILL_DARK = 'FF161B22';
const COLOR_WHITE = 'FFFFFFFF';
const COLOR_ZEBRA_LIGHT = 'FFF8F9FA';
const COLOR_BORDER_LIGHT = 'FFE2E8F0';
const COLOR_BORDER_HEADER = 'FF334155';

export interface ItemMedicaoFuro {
  data: string;
  dataRaw: Date;
  mesAnoKey: string;
  mesNome: string;
  ano: string;
  os: string;
  medidaMts: number;
  diametro: number;
  valorMetro: number;
  valorTotal: number;
  observacao: string;
}

export interface ItemMedicaoConsolidado extends ItemMedicaoFuro {
  servicoId: string;
  servicoNome: string;
}

export interface ItemMedicaoDetalhado {
  servicoId: string;
  servicoNome: string;
  furoId: string;
  barraId: string;
  registroLabel: string;
  numeroBarra: number;
  data: string;
  horario: string;
  dataRaw: Date;
  mesAnoKey: string;
  mesNome: string;
  ano: string;
  os: string;
  medidaMts: number;
  diametro: number;
  valorMetro: number;
  valorTotal: number;
  observacao: string;
  registradoPor: string;
}

/**
 * Sanitiza o nome de uma aba para os padrões exigidos pelo Excel (máx 31 chars, sem caracteres especiais)
 */
export function sanitizarNomeAba(nome: string): string {
  const limpo = (nome || 'SERVICO')
    .replace(/[\\/*?[\]:]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return limpo.slice(0, 31) || 'SERVICO';
}

/**
 * Extrai e formata a data da barra garantindo preservação estrita do fuso horário local
 * Evita o clássico bug de deslocamento em -1 dia ao fazer new Date("YYYY-MM-DD") em UTC-3
 */
export function extrairDataBarra(b: Barra, meta?: any): {
  diaStr: string;
  mesStr: string;
  anoStr: string;
  dataFormatada: string;
  mesAnoKey: string;
  mesNome: string;
  horarioStr: string;
  dataRaw: Date;
} {
  const dateCandidates = [
    b.data_referencia,
    meta?.data_referencia,
    b.data_registro,
    b.horario_registro,
    b.created_at
  ];

  let y = 0;
  let m = 0;
  let d = 0;
  let horarioStr = '';
  let dateObj = new Date();

  // Extrair horário se disponível
  const timeCandidate = b.horario_registro || b.created_at;
  if (timeCandidate && String(timeCandidate).includes('T')) {
    try {
      const parsedTime = new Date(timeCandidate);
      if (!isNaN(parsedTime.getTime())) {
        horarioStr = parsedTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (_) {}
  }

  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    const str = String(candidate).trim();

    // 1. Formato estrito YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      y = parseInt(ymdMatch[1], 10);
      m = parseInt(ymdMatch[2], 10);
      d = parseInt(ymdMatch[3], 10);
      dateObj = new Date(y, m - 1, d, 12, 0, 0);
      break;
    }

    // 2. Formato brasileiro DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10);
      m = parseInt(dmyMatch[2], 10);
      y = parseInt(dmyMatch[3], 10);
      dateObj = new Date(y, m - 1, d, 12, 0, 0);
      break;
    }

    // 3. Outros formatos válidos
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
      break;
    }
  }

  if (!y || !m || !d) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
    dateObj = now;
  }

  const diaStr = String(d).padStart(2, '0');
  const mesStr = String(m).padStart(2, '0');
  const anoStr = String(y);
  const dataFormatada = `${diaStr}/${mesStr}/${anoStr}`;
  const mesAnoKey = `${anoStr}-${mesStr}`;
  const mesNome = MESES_NOMES[m - 1] || `MÊS ${m}`;

  return {
    diaStr,
    mesStr,
    anoStr,
    dataFormatada,
    mesAnoKey,
    mesNome,
    horarioStr,
    dataRaw: dateObj
  };
}

/**
 * Processa as barras gerando a lista detalhada "Furo a Furo" (registro individual por linha)
 */
export function processarBarrasDetalhadas(servico: Servico, barras: Barra[]): ItemMedicaoDetalhado[] {
  const diamDefault = Number(servico.diametro_furo_mm) || 150;
  const fatorFinanceiro = Number(servico.fator_financeiro) || 0.8;

  const validBarras = barras.filter(b => !(b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)));

  const itens: ItemMedicaoDetalhado[] = validBarras.map((b, idx) => {
    const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);
    const dateInfo = extrairDataBarra(b, meta);

    const rawOs = (b.numero_os || meta.numero_os || '').trim();
    const osLimpa = rawOs ? rawOs.replace(/^OS[:\s-]*/i, '') : '';
    const osFinal = osLimpa || servico.nome || 'S/N';

    const metros = Number(b.metros) !== undefined && b.metros !== null ? Number(b.metros) : 3;

    let diamParsed = diamDefault;
    if (b.diametro) {
      const parsedD = parseFloat(String(b.diametro).replace(/[^\d.]/g, ''));
      if (!isNaN(parsedD) && parsedD > 0) diamParsed = parsedD;
    }

    let valorMetro = 0;
    if (servico.cenario_financeiro === 'VALOR_METRO') {
      valorMetro = calcularValorMetroBarra(servico, String(diamParsed));
    } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
      valorMetro = fatorFinanceiro * diamParsed;
    } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
      const totalPrevisto = Number(servico.metragem_prevista_total) || 1;
      const totalFechado = Number(servico.valor_total_fechado) || 0;
      valorMetro = totalPrevisto > 0 ? (totalFechado / totalPrevisto) : 0;
    } else {
      valorMetro = Number(servico.valor_metro) || (fatorFinanceiro * diamParsed);
    }

    const valorTotal = Math.round(metros * valorMetro * 100) / 100;
    const num = b.numero_barra || idx + 1;
    const registroLabel = `REGISTRO ${String(num).padStart(2, '0')}`;
    const autor = b.registrado_por_nome || meta.registrado_por_nome || '';

    const obsParts: string[] = [];
    if (cleanObs) obsParts.push(cleanObs);
    if (autor) obsParts.push(`Por: ${autor}`);
    if (meta.endereco) obsParts.push(meta.endereco);

    return {
      servicoId: servico.id,
      servicoNome: servico.nome,
      furoId: b.furo_id || '',
      barraId: b.id || '',
      registroLabel,
      numeroBarra: num,
      data: dateInfo.dataFormatada,
      horario: dateInfo.horarioStr,
      dataRaw: dateInfo.dataRaw,
      mesAnoKey: dateInfo.mesAnoKey,
      mesNome: dateInfo.mesNome,
      ano: dateInfo.anoStr,
      os: osFinal,
      medidaMts: Math.round(metros * 10) / 10,
      diametro: diamParsed,
      valorMetro: Math.round(valorMetro * 100) / 100,
      valorTotal,
      observacao: obsParts.join(' | '),
      registradoPor: autor
    };
  });

  return itens.sort((a, b) => {
    const diffTime = a.dataRaw.getTime() - b.dataRaw.getTime();
    if (diffTime !== 0) return diffTime;
    return a.numeroBarra - b.numeroBarra;
  });
}

/**
 * Agrupa as barras de um serviço por Furo / Apontamento diário consolidado
 */
export function processarBarrasParaMedicao(servico: Servico, barras: Barra[]): Record<string, ItemMedicaoFuro[]> {
  const furosMap = new Map<string, {
    furoId: string;
    dataRaw: Date;
    dataStr: string;
    mesAnoKey: string;
    mesNome: string;
    ano: string;
    os: string;
    metros: number;
    diametroNum: number;
    observacoes: string[];
  }>();

  const diamDefault = Number(servico.diametro_furo_mm) || 150;
  const fatorFinanceiro = Number(servico.fator_financeiro) || 0.8;

  barras.forEach(b => {
    if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return;

    const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);
    const dateInfo = extrairDataBarra(b, meta);

    const dataFormatada = dateInfo.dataFormatada;
    const mesAnoKey = dateInfo.mesAnoKey;
    const mesNome = dateInfo.mesNome;
    const anoStr = dateInfo.anoStr;

    // Identificação de OS
    const rawOs = (b.numero_os || meta.numero_os || '').trim();
    const osLimpa = rawOs ? rawOs.replace(/^OS[:\s-]*/i, '') : '';
    const osFinal = osLimpa || servico.nome || 'S/N';

    // Metros da barra
    const metros = Number(b.metros) !== undefined && b.metros !== null ? Number(b.metros) : 3;

    // Diâmetro do furo
    let diamParsed = diamDefault;
    if (b.diametro) {
      const parsedD = parseFloat(String(b.diametro).replace(/[^\d.]/g, ''));
      if (!isNaN(parsedD) && parsedD > 0) diamParsed = parsedD;
    }

    // Chave de agrupamento: Furo + Data + OS + Diâmetro
    const furoIdKey = (b.furo_id || `${dataFormatada}_${osFinal}_${diamParsed}`).trim();
    const groupKey = `${furoIdKey}__${dataFormatada}__${osFinal}__${diamParsed}`;

    if (!furosMap.has(groupKey)) {
      furosMap.set(groupKey, {
        furoId: furoIdKey,
        dataRaw: dateInfo.dataRaw,
        dataStr: dataFormatada,
        mesAnoKey,
        mesNome,
        ano: anoStr,
        os: osFinal,
        metros: 0,
        diametroNum: diamParsed,
        observacoes: []
      });
    }

    const entry = furosMap.get(groupKey)!;
    entry.metros += metros;
    if (cleanObs && !entry.observacoes.includes(cleanObs)) {
      entry.observacoes.push(cleanObs);
    }
  });

  const porMes: Record<string, ItemMedicaoFuro[]> = {};

  Array.from(furosMap.values())
    .sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime())
    .forEach(item => {
      let valorMetro = 0;
      if (servico.cenario_financeiro === 'VALOR_METRO') {
        valorMetro = calcularValorMetroBarra(servico, String(item.diametroNum));
      } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
        valorMetro = fatorFinanceiro * item.diametroNum;
      } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
        const totalPrevisto = Number(servico.metragem_prevista_total) || 1;
        const totalFechado = Number(servico.valor_total_fechado) || 0;
        valorMetro = totalPrevisto > 0 ? (totalFechado / totalPrevisto) : 0;
      } else {
        valorMetro = Number(servico.valor_metro) || (fatorFinanceiro * item.diametroNum);
      }

      const valorTotal = Math.round(item.metros * valorMetro * 100) / 100;
      const obsTexto = item.observacoes.length > 0 ? item.observacoes.join('; ') : '';

      const itemFinal: ItemMedicaoFuro = {
        data: item.dataStr,
        dataRaw: item.dataRaw,
        mesAnoKey: item.mesAnoKey,
        mesNome: item.mesNome,
        ano: item.ano,
        os: item.os,
        medidaMts: Math.round(item.metros * 10) / 10,
        diametro: item.diametroNum,
        valorMetro: Math.round(valorMetro * 100) / 100,
        valorTotal,
        observacao: obsTexto
      };

      if (!porMes[item.mesNome]) {
        porMes[item.mesNome] = [];
      }
      porMes[item.mesNome].push(itemFinal);
    });

  return porMes;
}

/**
 * Cria e formata a ABA PRINCIPAL DETALHADA "FURO A FURO" (Registro individual por linha)
 */
export function criarWorksheetDetalhada(
  wb: ExcelJS.Workbook,
  itensDetalhados: ItemMedicaoDetalhado[],
  sheetName: string = 'FURO A FURO',
  subTitulo?: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sanitizarNomeAba(sheetName), {
    views: [{ showGridLines: false }]
  });
  ws.views = [{ showGridLines: false }];

  // Larguras de Colunas
  ws.getColumn(1).width = 4;   // A: Margem
  ws.getColumn(2).width = 16;  // B: ID do Serviço
  ws.getColumn(3).width = 32;  // C: Nome do Serviço
  ws.getColumn(4).width = 16;  // D: REGISTRO
  ws.getColumn(5).width = 14;  // E: DATA
  ws.getColumn(6).width = 18;  // F: 'OS' nº
  ws.getColumn(7).width = 16;  // G: MEDIDA 1 mts
  ws.getColumn(8).width = 14;  // H: DUTO diametro
  ws.getColumn(9).width = 18;  // I: Valor Metro
  ws.getColumn(10).width = 24; // J: VALOR TOTAL FURO
  ws.getColumn(11).width = 60; // K: DESCRIÇÃO observação

  // Alturas das Linhas do Cabeçalho
  ws.getRow(1).height = 14;
  ws.getRow(2).height = 28;
  ws.getRow(3).height = 28;

  // 1. Título Esquerdo (B2:H3) - Padrão Executivo TecnoDrill alinhado à esquerda
  ws.mergeCells('B2:H3');
  const cellTitulo = ws.getCell('B2');
  const periodoTxt = subTitulo ? ` (${subTitulo.replace(/_/g, ' ')})` : '';
  cellTitulo.value = `LANÇAMENTO DE MEDIÇÕES DETALHADO (FURO A FURO)${periodoTxt.toUpperCase()}`;
  cellTitulo.font = { name: 'Calibri', size: 12.5, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'left' };

  // 2. Logo Oficial da TecnoDrill (I2:K3)
  try {
    const logoId = wb.addImage({
      base64: TECNODRILL_LOGO_BASE64,
      extension: 'png'
    });
    ws.addImage(logoId, {
      tl: { col: 8.5, row: 1.15 },
      ext: { width: 175, height: 50 }
    });
  } catch (_) {
    ws.mergeCells('I2:K3');
    const cellLogoFallback = ws.getCell('I2');
    cellLogoFallback.value = 'TecnoDrill INFRA';
    cellLogoFallback.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
    cellLogoFallback.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 3. Cabeçalho das Colunas (Linhas 4 e 5) - Fundo Chumbo Escuro (#161B22)
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;

  // Apenas as colunas que têm texto único vertical são mescladas
  ws.mergeCells('B4:B5'); // ID DO SERVIÇO
  ws.mergeCells('C4:C5'); // NOME DO SERVIÇO
  ws.mergeCells('D4:D5'); // REGISTRO
  ws.mergeCells('E4:E5'); // DATA
  // Coluna F: F4 tem 'OS', F5 tem 'nº' (NÃO MESCLAR)
  // Coluna G: G4 tem 'MEDIDA 1', G5 tem 'mts' (NÃO MESCLAR)
  // Coluna H: H4 tem 'DUTO', H5 tem 'diametro' (NÃO MESCLAR)
  ws.mergeCells('I4:I5'); // Valor Metro
  ws.mergeCells('J4:J5'); // VALOR TOTAL FURO
  // Coluna K: K4 tem 'DESCRIÇÃO', K5 tem 'observação' (NÃO MESCLAR)

  // Linha 4
  ws.getCell('B4').value = 'ID DO SERVIÇO';
  ws.getCell('C4').value = 'NOME DO SERVIÇO';
  ws.getCell('D4').value = 'REGISTRO';
  ws.getCell('E4').value = 'DATA';
  ws.getCell('F4').value = "'OS'";
  ws.getCell('G4').value = 'MEDIDA 1';
  ws.getCell('H4').value = 'DUTO';
  ws.getCell('I4').value = 'Valor Metro';
  ws.getCell('J4').value = 'VALOR TOTAL FURO';
  ws.getCell('K4').value = 'DESCRIÇÃO';

  // Linha 5
  ws.getCell('F5').value = 'nº';
  ws.getCell('G5').value = 'mts';
  ws.getCell('H5').value = 'diametro';
  ws.getCell('K5').value = 'observação';

  const colsHeader = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  [4, 5].forEach(rowNum => {
    colsHeader.forEach(colLetter => {
      const cell = ws.getCell(`${colLetter}${rowNum}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_TECNODRILL_DARK }
      };
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: true,
        color: { argb: COLOR_WHITE }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } }
      };
    });
  });

  // 5. Linhas de Dados
  let curRow = 6;

  if (itensDetalhados.length === 0) {
    ws.getRow(curRow).height = 24;
    ws.mergeCells(`B${curRow}:K${curRow}`);
    const emptyCell = ws.getCell(`B${curRow}`);
    emptyCell.value = 'Nenhum lançamento de medição registrado para os filtros selecionados.';
    emptyCell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    colsHeader.forEach(colLetter => {
      ws.getCell(`${colLetter}${curRow}`).border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } }
      };
    });
    curRow++;
  } else {
    itensDetalhados.forEach((item, idx) => {
      const row = ws.getRow(curRow);
      row.height = 21;
      const isZebra = idx % 2 === 1;
      const rowBgColor = isZebra ? COLOR_ZEBRA_LIGHT : COLOR_WHITE;

      // Col B: ID do Serviço
      const cB = ws.getCell(`B${curRow}`);
      cB.value = item.servicoId;
      cB.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col C: Nome do Serviço
      const cC = ws.getCell(`C${curRow}`);
      cC.value = item.servicoNome;
      cC.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Col D: REGISTRO
      const cD = ws.getCell(`D${curRow}`);
      cD.value = item.registroLabel;
      cD.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col E: DATA
      const cE = ws.getCell(`E${curRow}`);
      cE.value = item.data;
      cE.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col F: 'OS' nº
      const cF = ws.getCell(`F${curRow}`);
      cF.value = item.os;
      cF.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col G: MEDIDA 1 mts
      const cG = ws.getCell(`G${curRow}`);
      cG.value = item.medidaMts;
      cG.numFmt = '#,##0.0';
      cG.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col H: DUTO diametro
      const cH = ws.getCell(`H${curRow}`);
      cH.value = item.diametro;
      cH.numFmt = '0';
      cH.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col I: Valor Metro
      const cI = ws.getCell(`I${curRow}`);
      cI.value = item.valorMetro;
      cI.numFmt = '"R$" #,##0.00';
      cI.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col J: VALOR TOTAL FURO (Fórmula Excel com valor pré-calculado)
      const cJ = ws.getCell(`J${curRow}`);
      cJ.value = {
        formula: `G${curRow}*I${curRow}`,
        result: item.valorTotal
      };
      cJ.numFmt = '"R$" #,##0.00';
      cJ.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
      cJ.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col K: DESCRIÇÃO observação
      const cK = ws.getCell(`K${curRow}`);
      cK.value = item.observacao;
      cK.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Estilo e Bordas
      colsHeader.forEach(colLetter => {
        const cell = ws.getCell(`${colLetter}${curRow}`);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        if (!cell.font) {
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLOR_TECNODRILL_DARK } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          left: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          bottom: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          right: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } }
        };
      });

      curRow++;
    });
  }

  // 6. Linha de TOTAL DETALHADO - Fundo Laranja TecnoDrill (#F05A22)
  const rowTotal = ws.getRow(curRow);
  rowTotal.height = 26;

  ws.mergeCells(`B${curRow}:F${curRow}`);
  const cTotalLabel = ws.getCell(`B${curRow}`);
  cTotalLabel.value = 'TOTAL GERAL DETALHADO (FURO A FURO)';
  cTotalLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  if (itensDetalhados.length > 0) {
    // Col G: Soma Metragem
    const cTotalMts = ws.getCell(`G${curRow}`);
    cTotalMts.value = {
      formula: `SUM(G6:G${curRow - 1})`
    };
    cTotalMts.numFmt = '#,##0.0';
    cTotalMts.alignment = { vertical: 'middle', horizontal: 'right' };

    // Col J: Soma Financeira
    const cTotalVal = ws.getCell(`J${curRow}`);
    cTotalVal.value = {
      formula: `SUM(J6:J${curRow - 1})`
    };
    cTotalVal.numFmt = '"R$" #,##0.00';
    cTotalVal.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  colsHeader.forEach(colLetter => {
    const cell = ws.getCell(`${colLetter}${curRow}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_TECNODRILL_ORANGE }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: COLOR_WHITE }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR_WHITE } },
      bottom: { style: 'double', color: { argb: COLOR_TECNODRILL_DARK } },
      left: { style: 'thin', color: { argb: '33FFFFFF' } },
      right: { style: 'thin', color: { argb: '33FFFFFF' } }
    };
  });

  return ws;
}

/**
 * Cria e formata a ABA DE RESUMO CONSOLIDADO (Resumo por dia / furo diário agregado)
 */
export function criarWorksheetConsolidada(
  wb: ExcelJS.Workbook,
  itensConsolidados: ItemMedicaoConsolidado[],
  sheetName: string = 'RESUMO CONSOLIDADO',
  nomeFiltroPeriodo?: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sanitizarNomeAba(sheetName), {
    views: [{ showGridLines: false }]
  });
  ws.views = [{ showGridLines: false }];

  // Larguras de Colunas
  ws.getColumn(1).width = 4;   // A: Margem
  ws.getColumn(2).width = 16;  // B: ID do Serviço
  ws.getColumn(3).width = 32;  // C: Nome do Serviço
  ws.getColumn(4).width = 14;  // D: DATA
  ws.getColumn(5).width = 18;  // E: 'OS' nº
  ws.getColumn(6).width = 16;  // F: MEDIDA 1 mts
  ws.getColumn(7).width = 14;  // G: DUTO diametro
  ws.getColumn(8).width = 18;  // H: Valor Metro
  ws.getColumn(9).width = 24;  // I: VALOR TOTAL FURO
  ws.getColumn(10).width = 60; // J: DESCRIÇÃO observação

  // Alturas das Linhas do Cabeçalho
  ws.getRow(1).height = 14;
  ws.getRow(2).height = 28;
  ws.getRow(3).height = 28;

  // 1. Título Esquerdo (B2:G3) - Padrão Executivo TecnoDrill alinhado à esquerda
  ws.mergeCells('B2:G3');
  const cellTitulo = ws.getCell('B2');
  const periodoTxt = nomeFiltroPeriodo ? ` (${nomeFiltroPeriodo.replace(/_/g, ' ')})` : '';
  cellTitulo.value = `LANÇAMENTO DE MEDIÇÕES - RESUMO CONSOLIDADO${periodoTxt.toUpperCase()}`;
  cellTitulo.font = { name: 'Calibri', size: 12.5, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'left' };

  // 2. Logo Oficial da TecnoDrill (H2:J3)
  try {
    const logoId = wb.addImage({
      base64: TECNODRILL_LOGO_BASE64,
      extension: 'png'
    });
    ws.addImage(logoId, {
      tl: { col: 7.5, row: 1.15 },
      ext: { width: 175, height: 50 }
    });
  } catch (_) {
    ws.mergeCells('H2:J3');
    const cellLogoFallback = ws.getCell('H2');
    cellLogoFallback.value = 'TecnoDrill INFRA';
    cellLogoFallback.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
    cellLogoFallback.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 3. Cabeçalho das Colunas (Linhas 4 e 5) - Fundo Chumbo Escuro (#161B22)
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;

  // Apenas as colunas que têm texto único vertical são mescladas
  ws.mergeCells('B4:B5'); // ID DO SERVIÇO
  ws.mergeCells('C4:C5'); // NOME DO SERVIÇO
  ws.mergeCells('D4:D5'); // DATA
  // Coluna E: E4 tem 'OS', E5 tem 'nº' (NÃO MESCLAR)
  // Coluna F: F4 tem 'MEDIDA 1', F5 tem 'mts' (NÃO MESCLAR)
  // Coluna G: G4 tem 'DUTO', G5 tem 'diametro' (NÃO MESCLAR)
  ws.mergeCells('H4:H5'); // Valor Metro
  ws.mergeCells('I4:I5'); // VALOR TOTAL FURO
  // Coluna J: J4 tem 'DESCRIÇÃO', J5 tem 'observação' (NÃO MESCLAR)

  // Linha 4
  ws.getCell('B4').value = 'ID DO SERVIÇO';
  ws.getCell('C4').value = 'NOME DO SERVIÇO';
  ws.getCell('D4').value = 'DATA';
  ws.getCell('E4').value = "'OS'";
  ws.getCell('F4').value = 'MEDIDA 1';
  ws.getCell('G4').value = 'DUTO';
  ws.getCell('H4').value = 'Valor Metro';
  ws.getCell('I4').value = 'VALOR TOTAL FURO';
  ws.getCell('J4').value = 'DESCRIÇÃO';

  // Linha 5
  ws.getCell('E5').value = 'nº';
  ws.getCell('F5').value = 'mts';
  ws.getCell('G5').value = 'diametro';
  ws.getCell('J5').value = 'observação';

  const colsHeader = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  [4, 5].forEach(rowNum => {
    colsHeader.forEach(colLetter => {
      const cell = ws.getCell(`${colLetter}${rowNum}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_TECNODRILL_DARK }
      };
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: true,
        color: { argb: COLOR_WHITE }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER_HEADER } }
      };
    });
  });

  // 5. Linhas de Dados
  let curRow = 6;

  if (itensConsolidados.length === 0) {
    ws.getRow(curRow).height = 24;
    ws.mergeCells(`B${curRow}:J${curRow}`);
    const emptyCell = ws.getCell(`B${curRow}`);
    emptyCell.value = 'Nenhum lançamento de medição registrado para os filtros selecionados.';
    emptyCell.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    colsHeader.forEach(colLetter => {
      ws.getCell(`${colLetter}${curRow}`).border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } }
      };
    });
    curRow++;
  } else {
    itensConsolidados.forEach((item, idx) => {
      const row = ws.getRow(curRow);
      row.height = 21;
      const isZebra = idx % 2 === 1;
      const rowBgColor = isZebra ? COLOR_ZEBRA_LIGHT : COLOR_WHITE;

      // Col B: ID do Serviço
      const cB = ws.getCell(`B${curRow}`);
      cB.value = item.servicoId;
      cB.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col C: Nome do Serviço
      const cC = ws.getCell(`C${curRow}`);
      cC.value = item.servicoNome;
      cC.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Col D: DATA
      const cD = ws.getCell(`D${curRow}`);
      cD.value = item.data;
      cD.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col E: 'OS' nº
      const cE = ws.getCell(`E${curRow}`);
      cE.value = item.os;
      cE.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col F: MEDIDA 1 mts
      const cF = ws.getCell(`F${curRow}`);
      cF.value = item.medidaMts;
      cF.numFmt = '#,##0.0';
      cF.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col G: DUTO diametro
      const cG = ws.getCell(`G${curRow}`);
      cG.value = item.diametro;
      cG.numFmt = '0';
      cG.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col H: Valor Metro
      const cH = ws.getCell(`H${curRow}`);
      cH.value = item.valorMetro;
      cH.numFmt = '"R$" #,##0.00';
      cH.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col I: VALOR TOTAL FURO (Fórmula Excel com valor pré-calculado)
      const cI = ws.getCell(`I${curRow}`);
      cI.value = {
        formula: `F${curRow}*H${curRow}`,
        result: item.valorTotal
      };
      cI.numFmt = '"R$" #,##0.00';
      cI.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
      cI.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col J: DESCRIÇÃO observação
      const cJ = ws.getCell(`J${curRow}`);
      cJ.value = item.observacao;
      cJ.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      colsHeader.forEach(colLetter => {
        const cell = ws.getCell(`${colLetter}${curRow}`);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        if (!cell.font) {
          cell.font = { name: 'Calibri', size: 10, color: { argb: COLOR_TECNODRILL_DARK } };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          left: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          bottom: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } },
          right: { style: 'thin', color: { argb: COLOR_BORDER_LIGHT } }
        };
      });

      curRow++;
    });
  }

  // 6. Linha de TOTAL CONSOLIDADO - Fundo Laranja TecnoDrill (#F05A22)
  const rowTotal = ws.getRow(curRow);
  rowTotal.height = 26;

  ws.mergeCells(`B${curRow}:E${curRow}`);
  const cTotalLabel = ws.getCell(`B${curRow}`);
  cTotalLabel.value = 'TOTAL GERAL CONSOLIDADO';
  cTotalLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  if (itensConsolidados.length > 0) {
    const cTotalMts = ws.getCell(`F${curRow}`);
    cTotalMts.value = {
      formula: `SUM(F6:F${curRow - 1})`
    };
    cTotalMts.numFmt = '#,##0.0';
    cTotalMts.alignment = { vertical: 'middle', horizontal: 'right' };

    const cTotalVal = ws.getCell(`I${curRow}`);
    cTotalVal.value = {
      formula: `SUM(I6:I${curRow - 1})`
    };
    cTotalVal.numFmt = '"R$" #,##0.00';
    cTotalVal.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  colsHeader.forEach(colLetter => {
    const cell = ws.getCell(`${colLetter}${curRow}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_TECNODRILL_ORANGE }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: COLOR_WHITE }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR_WHITE } },
      bottom: { style: 'double', color: { argb: COLOR_TECNODRILL_DARK } },
      left: { style: 'thin', color: { argb: '33FFFFFF' } },
      right: { style: 'thin', color: { argb: '33FFFFFF' } }
    };
  });

  return ws;
}

/**
 * Dispara o download de um Workbook ExcelJS no navegador
 */
async function baixarWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Gera e dispara o download do relatório de medição em Excel para um serviço específico
 * ESTRUTURA COMPLETA:
 * - Aba 1 (Principal): "FURO A FURO" (todos os apontamentos individuais linha a linha)
 * - Aba 2: "RESUMO CONSOLIDADO" (totais diários agrupados)
 */
export async function exportarRelatorioMedicaoServico(
  servico: Servico,
  barras: Barra[],
  nomeFiltroPeriodo?: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TecnoDrill INFRA';
  wb.created = new Date();

  // 1. Processar itens detalhados "Furo a Furo"
  const itensDetalhados = processarBarrasDetalhadas(servico, barras);

  // 2. Processar itens consolidados por dia
  const porMes = processarBarrasParaMedicao(servico, barras);
  const itensConsolidados: ItemMedicaoConsolidado[] = [];

  Object.values(porMes).forEach(lista => {
    lista.forEach(it => {
      itensConsolidados.push({
        ...it,
        servicoId: servico.id,
        servicoNome: servico.nome
      });
    });
  });

  itensConsolidados.sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime());

  // Criar Aba 1 (Principal): FURO A FURO
  criarWorksheetDetalhada(wb, itensDetalhados, 'FURO A FURO', nomeFiltroPeriodo);

  // Criar Aba 2: RESUMO CONSOLIDADO
  criarWorksheetConsolidada(wb, itensConsolidados, 'RESUMO CONSOLIDADO', nomeFiltroPeriodo);

  const sanitizedCliente = (servico.cliente || 'CLIENTE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedObra = (servico.nome || servico.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PLANILHA_Medicao_${sanitizedCliente}_${sanitizedObra}.xlsx`;

  await baixarWorkbook(wb, filename);
}

/**
 * Gera e dispara o download consolidado de todas as obras filtradas
 * ESTRUTURA COMPLETA:
 * - Aba 1 (Principal): "FURO A FURO" (todas as barras de todas as obras individuais linha a linha)
 * - Aba 2: "RESUMO CONSOLIDADO" (totais diários agrupados de todas as obras)
 */
export async function exportarRelatorioMedicaoConsolidado(
  servicos: Servico[],
  barrasPorServico: Record<string, Barra[]>,
  nomeFiltroPeriodo?: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TecnoDrill INFRA';
  wb.created = new Date();

  const todosItensDetalhados: ItemMedicaoDetalhado[] = [];
  const todosItensConsolidados: ItemMedicaoConsolidado[] = [];

  servicos.forEach(servico => {
    const barras = barrasPorServico[servico.id] || [];

    // Detalhado
    const detalhados = processarBarrasDetalhadas(servico, barras);
    todosItensDetalhados.push(...detalhados);

    // Consolidado
    const porMes = processarBarrasParaMedicao(servico, barras);
    Object.values(porMes).forEach(itensDoMes => {
      itensDoMes.forEach(it => {
        todosItensConsolidados.push({
          ...it,
          servicoId: servico.id,
          servicoNome: servico.nome
        });
      });
    });
  });

  // Ordenar cronologicamente
  todosItensDetalhados.sort((a, b) => {
    const diffTime = a.dataRaw.getTime() - b.dataRaw.getTime();
    if (diffTime !== 0) return diffTime;
    return a.numeroBarra - b.numeroBarra;
  });

  todosItensConsolidados.sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime());

  // Aba 1 (Principal): FURO A FURO CONSOLIDADO
  criarWorksheetDetalhada(wb, todosItensDetalhados, 'FURO A FURO', nomeFiltroPeriodo);

  // Aba 2: RESUMO CONSOLIDADO
  criarWorksheetConsolidada(wb, todosItensConsolidados, 'RESUMO CONSOLIDADO', nomeFiltroPeriodo);

  const filename = `PLANILHA_Medicao_Consolidada_TecnoDrill_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await baixarWorkbook(wb, filename);
}
