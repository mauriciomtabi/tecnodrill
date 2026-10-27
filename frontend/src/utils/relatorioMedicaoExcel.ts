import ExcelJS from 'exceljs';
import { Servico, Barra } from '../types';
import { parseBarraObservacao } from '../services/api';
import { TECNODRILL_LOGO_BASE64 } from './tecnodrillLogoBase64';

const MESES_NOMES = [
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
    // Ignorar caixas sem tubulação se for apenas ponto de caixa
    if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) return;

    const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);

    // Identificação de Data
    let d = new Date();
    const rawDate = b.data_registro || meta.data_referencia || b.horario_registro || b.created_at;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) d = parsed;
    }

    const diaStr = String(d.getDate()).padStart(2, '0');
    const mesNum = d.getMonth() + 1;
    const mesStr = String(mesNum).padStart(2, '0');
    const anoStr = String(d.getFullYear());
    const dataFormatada = `${diaStr}/${mesStr}/${anoStr}`;
    const mesAnoKey = `${anoStr}-${mesStr}`;
    const mesNome = MESES_NOMES[d.getMonth()] || `MÊS ${mesNum}`;

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
        dataRaw: d,
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

  // Agrupar itens finais por Mês
  const porMes: Record<string, ItemMedicaoFuro[]> = {};

  Array.from(furosMap.values())
    .sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime())
    .forEach(item => {
      // Cálculo do valor unitário por metro conforme cenário financeiro
      let valorMetro = 0;
      if (servico.cenario_financeiro === 'VALOR_METRO') {
        valorMetro = Number(servico.valor_metro) || 0;
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
 * Cria e formata a ABA PRINCIPAL CONSOLIDADA com todas as informações e as colunas (ID do Serviço e Nome do Serviço)
 */
function criarWorksheetConsolidada(
  wb: ExcelJS.Workbook,
  itensConsolidados: ItemMedicaoConsolidado[],
  nomeFiltroPeriodo?: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('CONSOLIDADO', {
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

  // 1. Identificação Corporativa (B2:D3)
  ws.mergeCells('B2:D3');
  const cellCorp = ws.getCell('B2');
  cellCorp.value = 'TECNODRILL INFRA';
  cellCorp.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
  cellCorp.alignment = { vertical: 'middle', horizontal: 'left' };

  // 2. Título Central da Medição Consolidada (E2:H3)
  ws.mergeCells('E2:H3');
  const cellTitulo = ws.getCell('E2');
  const periodoTxt = nomeFiltroPeriodo ? ` (${nomeFiltroPeriodo.replace(/_/g, ' ')})` : '';
  cellTitulo.value = `LANÇAMENTO DE MEDIÇÕES CONSOLIDADO${periodoTxt.toUpperCase()}`;
  cellTitulo.font = { name: 'Calibri', size: 13.5, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. Logo Oficial da TecnoDrill (I2:J3)
  try {
    const logoId = wb.addImage({
      base64: TECNODRILL_LOGO_BASE64,
      extension: 'png'
    });
    ws.addImage(logoId, {
      tl: { col: 8.05, row: 1.15 },
      ext: { width: 175, height: 52 }
    });
  } catch (err) {
    ws.mergeCells('I2:J3');
    const cellLogoFallback = ws.getCell('I2');
    cellLogoFallback.value = 'TecnoDrill INFRA';
    cellLogoFallback.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
    cellLogoFallback.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 4. Cabeçalho das Colunas (Linhas 4 e 5) - Fundo Chumbo Escuro (#161B22)
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;

  // Merges de Cabeçalho Vertical
  ws.mergeCells('B4:B5'); // ID DO SERVIÇO
  ws.mergeCells('C4:C5'); // NOME DO SERVIÇO
  ws.mergeCells('D4:D5'); // DATA
  ws.mergeCells('H4:H5'); // Valor Metro
  ws.mergeCells('I4:I5'); // VALOR TOTAL FURO

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

  // 5. Linhas de Dados (A partir da Linha 6)
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

      // Aplicação de Estilo e Bordas em todas as células da linha
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

  // 6. Linha de TOTAL CONSOLIDADO - Fundo Laranja TecnoDrill (#F05A22) e Texto em Branco
  const rowTotal = ws.getRow(curRow);
  rowTotal.height = 26;

  // Mesclar B a E para 'TOTAL GERAL CONSOLIDADO'
  ws.mergeCells(`B${curRow}:E${curRow}`);
  const cTotalLabel = ws.getCell(`B${curRow}`);
  cTotalLabel.value = 'TOTAL GERAL CONSOLIDADO';
  cTotalLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  if (itensConsolidados.length > 0) {
    // Col F: Soma Metragem
    const cTotalMts = ws.getCell(`F${curRow}`);
    cTotalMts.value = {
      formula: `SUM(F6:F${curRow - 1})`
    };
    cTotalMts.numFmt = '#,##0.0';
    cTotalMts.alignment = { vertical: 'middle', horizontal: 'right' };

    // Col I: Soma Financeira
    const cTotalVal = ws.getCell(`I${curRow}`);
    cTotalVal.value = {
      formula: `SUM(I6:I${curRow - 1})`
    };
    cTotalVal.numFmt = '"R$" #,##0.00';
    cTotalVal.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  // Estilização das células da Linha de TOTAL
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
 * Cria e formata uma worksheet com a identidade visual executiva da TecnoDrill para uma obra específica
 */
function criarWorksheetEstilizada(
  wb: ExcelJS.Workbook,
  nomeCliente: string,
  mesNome: string,
  itens: ItemMedicaoFuro[],
  sheetName: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: false }]
  });
  ws.views = [{ showGridLines: false }];

  // Larguras de Colunas
  ws.getColumn(1).width = 4;   // A: Margem
  ws.getColumn(2).width = 15;  // B: DATA
  ws.getColumn(3).width = 20;  // C: 'OS' nº
  ws.getColumn(4).width = 16;  // D: MEDIDA 1 mts
  ws.getColumn(5).width = 15;  // E: DUTO diametro
  ws.getColumn(6).width = 18;  // F: Valor Metro
  ws.getColumn(7).width = 24;  // G: VALOR TOTAL FURO
  ws.getColumn(8).width = 60;  // H: DESCRIÇÃO observação

  // Alturas das Linhas do Cabeçalho
  ws.getRow(1).height = 14;
  ws.getRow(2).height = 28;
  ws.getRow(3).height = 28;

  // 1. Cliente / Construtora (B2:C3)
  ws.mergeCells('B2:C3');
  const cellCliente = ws.getCell('B2');
  cellCliente.value = (nomeCliente || 'CONSTRUTORA').toUpperCase();
  cellCliente.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
  cellCliente.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  // 2. Título Central da Medição (D2:F3)
  ws.mergeCells('D2:F3');
  const cellTitulo = ws.getCell('D2');
  cellTitulo.value = `LANÇAMENTO MEDIÇÃO ${mesNome.toUpperCase()}`;
  cellTitulo.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };

  // 3. Logo Oficial da TecnoDrill (G2:H3)
  try {
    const logoId = wb.addImage({
      base64: TECNODRILL_LOGO_BASE64,
      extension: 'png'
    });
    ws.addImage(logoId, {
      tl: { col: 6.05, row: 1.15 },
      ext: { width: 175, height: 52 }
    });
  } catch (err) {
    ws.mergeCells('G2:H3');
    const cellLogoFallback = ws.getCell('G2');
    cellLogoFallback.value = 'TecnoDrill INFRA';
    cellLogoFallback.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
    cellLogoFallback.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // 4. Cabeçalho das Colunas (Linhas 4 e 5) - Fundo Chumbo Escuro (#161B22)
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 20;

  // Merges de Cabeçalho Vertical
  ws.mergeCells('B4:B5'); // DATA
  ws.mergeCells('F4:F5'); // Valor Metro
  ws.mergeCells('G4:G5'); // VALOR TOTAL FURO

  // Linha 4 (Títulos Principais)
  ws.getCell('B4').value = 'DATA';
  ws.getCell('C4').value = "'OS'";
  ws.getCell('D4').value = 'MEDIDA 1';
  ws.getCell('E4').value = 'DUTO';
  ws.getCell('F4').value = 'Valor Metro';
  ws.getCell('G4').value = 'VALOR TOTAL FURO';
  ws.getCell('H4').value = 'DESCRIÇÃO';

  // Linha 5 (Subtítulos / Unidades)
  ws.getCell('C5').value = 'nº';
  ws.getCell('D5').value = 'mts';
  ws.getCell('E5').value = 'diametro';
  ws.getCell('H5').value = 'observação';

  const colsHeader = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
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
        size: 10,
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

  // 5. Linhas de Dados (A partir da Linha 6)
  let curRow = 6;

  if (itens.length === 0) {
    ws.getRow(curRow).height = 24;
    ws.mergeCells(`B${curRow}:H${curRow}`);
    const emptyCell = ws.getCell(`B${curRow}`);
    emptyCell.value = 'Nenhum lançamento de medição registrado para este período.';
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
    itens.forEach((item, idx) => {
      const row = ws.getRow(curRow);
      row.height = 21;
      const isZebra = idx % 2 === 1;
      const rowBgColor = isZebra ? COLOR_ZEBRA_LIGHT : COLOR_WHITE;

      // Col B: DATA
      const cB = ws.getCell(`B${curRow}`);
      cB.value = item.data;
      cB.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col C: 'OS' nº
      const cC = ws.getCell(`C${curRow}`);
      cC.value = item.os;
      cC.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col D: MEDIDA 1 mts
      const cD = ws.getCell(`D${curRow}`);
      cD.value = item.medidaMts;
      cD.numFmt = '#,##0.0';
      cD.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col E: DUTO diametro
      const cE = ws.getCell(`E${curRow}`);
      cE.value = item.diametro;
      cE.numFmt = '0';
      cE.alignment = { vertical: 'middle', horizontal: 'center' };

      // Col F: Valor Metro
      const cF = ws.getCell(`F${curRow}`);
      cF.value = item.valorMetro;
      cF.numFmt = '"R$" #,##0.00';
      cF.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col G: VALOR TOTAL FURO (Fórmula Excel com valor pré-calculado)
      const cG = ws.getCell(`G${curRow}`);
      cG.value = {
        formula: `D${curRow}*F${curRow}`,
        result: item.valorTotal
      };
      cG.numFmt = '"R$" #,##0.00';
      cG.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
      cG.alignment = { vertical: 'middle', horizontal: 'right' };

      // Col H: DESCRIÇÃO observação
      const cH = ws.getCell(`H${curRow}`);
      cH.value = item.observacao;
      cH.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Aplicação de Estilo e Bordas em todas as células da linha
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

  // 6. Linha de TOTAL - Fundo Laranja TecnoDrill (#F05A22) e Texto em Branco
  const rowTotal = ws.getRow(curRow);
  rowTotal.height = 26;

  // Mesclar B e C para 'TOTAL'
  ws.mergeCells(`B${curRow}:C${curRow}`);
  const cTotalLabel = ws.getCell(`B${curRow}`);
  cTotalLabel.value = 'TOTAL';
  cTotalLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  if (itens.length > 0) {
    // Col D: Soma Metragem
    const cTotalMts = ws.getCell(`D${curRow}`);
    cTotalMts.value = {
      formula: `SUM(D6:D${curRow - 1})`
    };
    cTotalMts.numFmt = '#,##0.0';
    cTotalMts.alignment = { vertical: 'middle', horizontal: 'right' };

    // Col G: Soma Financeira
    const cTotalVal = ws.getCell(`G${curRow}`);
    cTotalVal.value = {
      formula: `SUM(G6:G${curRow - 1})`
    };
    cTotalVal.numFmt = '"R$" #,##0.00';
    cTotalVal.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  // Estilização das células da Linha de TOTAL com Fundo Laranja e Texto Branco
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
 */
export async function exportarRelatorioMedicaoServico(
  servico: Servico,
  barras: Barra[],
  nomeFiltroPeriodo?: string
) {
  const porMes = processarBarrasParaMedicao(servico, barras);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TecnoDrill INFRA';
  wb.created = new Date();

  const mesesKeys = Object.keys(porMes);
  const clienteOuObra = servico.cliente || servico.nome;
  const nomeObra = (servico.nome || servico.id).trim();

  if (mesesKeys.length === 0) {
    const tabName = sanitizarNomeAba(nomeObra);
    const fallbackMes = nomeFiltroPeriodo ? nomeFiltroPeriodo.toUpperCase() : 'MEDIÇÃO';
    criarWorksheetEstilizada(wb, clienteOuObra, fallbackMes, [], tabName);
  } else {
    mesesKeys.forEach(mesNome => {
      const itens = porMes[mesNome];
      const baseTitle = mesesKeys.length > 1
        ? `${nomeObra.slice(0, 20)} - ${mesNome.slice(0, 7)}`
        : nomeObra;
      const tabName = sanitizarNomeAba(baseTitle);
      criarWorksheetEstilizada(wb, clienteOuObra, mesNome, itens, tabName);
    });
  }

  const sanitizedCliente = (servico.cliente || 'CLIENTE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedObra = (servico.nome || servico.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PLANILHA_Medicao_${sanitizedCliente}_${sanitizedObra}.xlsx`;

  await baixarWorkbook(wb, filename);
}

/**
 * Gera e dispara o download consolidado de todas as obras filtradas
 * Inclui:
 * 1. Primeira aba "CONSOLIDADO" com todas as informações e colunas (ID do Serviço e Nome do Serviço)
 * 2. Abas subsequentes com o NOME DO SERVIÇO individual
 */
export async function exportarRelatorioMedicaoConsolidado(
  servicos: Servico[],
  barrasPorServico: Record<string, Barra[]>,
  nomeFiltroPeriodo?: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TecnoDrill INFRA';
  wb.created = new Date();

  const usedSheetNames = new Set<string>();

  // 1. Coleta e consolidação de todos os itens de medição de todas as obras
  const todosItensConsolidados: ItemMedicaoConsolidado[] = [];

  servicos.forEach(servico => {
    const barras = barrasPorServico[servico.id] || [];
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

  // Ordenar itens consolidados por data cronológica
  todosItensConsolidados.sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime());

  // Criar Aba Principal Consolidada (Primeira Aba)
  criarWorksheetConsolidada(wb, todosItensConsolidados, nomeFiltroPeriodo);
  usedSheetNames.add('CONSOLIDADO');

  // 2. Abas individuais com o NOME DO SERVIÇO
  servicos.forEach(servico => {
    const barras = barrasPorServico[servico.id] || [];
    const porMes = processarBarrasParaMedicao(servico, barras);
    const mesesKeys = Object.keys(porMes);
    const clienteOuObra = servico.cliente || servico.nome;
    const nomeObra = (servico.nome || servico.id).trim();

    if (mesesKeys.length === 0) {
      let tabTitle = sanitizarNomeAba(nomeObra);
      let counter = 1;
      while (usedSheetNames.has(tabTitle.toUpperCase())) {
        tabTitle = sanitizarNomeAba(`${nomeObra.slice(0, 27)}_${counter}`);
        counter++;
      }
      usedSheetNames.add(tabTitle.toUpperCase());
      const fallbackMes = nomeFiltroPeriodo ? nomeFiltroPeriodo.toUpperCase() : 'MEDIÇÃO';
      criarWorksheetEstilizada(wb, clienteOuObra, fallbackMes, [], tabTitle);
    } else {
      mesesKeys.forEach(mesNome => {
        const itens = porMes[mesNome];
        let baseTitle = mesesKeys.length > 1
          ? `${nomeObra.slice(0, 20)} - ${mesNome.slice(0, 7)}`
          : nomeObra;
        let tabTitle = sanitizarNomeAba(baseTitle);
        let counter = 1;
        while (usedSheetNames.has(tabTitle.toUpperCase())) {
          tabTitle = sanitizarNomeAba(`${baseTitle.slice(0, 27)}_${counter}`);
          counter++;
        }
        usedSheetNames.add(tabTitle.toUpperCase());
        criarWorksheetEstilizada(wb, clienteOuObra, mesNome, itens, tabTitle);
      });
    }
  });

  const filename = `PLANILHA_Medicao_Consolidada_TecnoDrill_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await baixarWorkbook(wb, filename);
}
