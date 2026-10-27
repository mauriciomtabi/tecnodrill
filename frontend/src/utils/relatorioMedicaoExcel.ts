import * as XLSX from 'xlsx';
import { Servico, Barra } from '../types';
import { parseBarraObservacao } from '../services/api';

const MESES_NOMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

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

    // Diâmetro
    const diamStr = b.diametro || meta.diametro || '';
    const diamParsed = parseFloat(String(diamStr).replace(/[^\d.]/g, '')) || diamDefault;

    // Chave de agrupamento por furo e data/OS
    const chaveFuro = `${b.furo_id || 'furo'}_${dataFormatada}_${osFinal}_${diamParsed}`;

    const m = b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3;

    if (!furosMap.has(chaveFuro)) {
      furosMap.set(chaveFuro, {
        furoId: b.furo_id || 'furo',
        dataRaw: d,
        dataStr: dataFormatada,
        mesAnoKey,
        mesNome,
        ano: anoStr,
        os: osFinal,
        metros: m,
        diametroNum: diamParsed,
        observacoes: cleanObs ? [cleanObs] : []
      });
    } else {
      const item = furosMap.get(chaveFuro)!;
      item.metros += m;
      if (cleanObs && !item.observacoes.includes(cleanObs)) {
        item.observacoes.push(cleanObs);
      }
    }
  });

  // Cálculo de valores conforme regras financeiras da obra
  const porMes: Record<string, ItemMedicaoFuro[]> = {};

  furosMap.forEach(item => {
    let valorMetro = 0;
    if (servico.cenario_financeiro === 'VALOR_METRO') {
      valorMetro = Number(servico.valor_metro) || 0;
    } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
      valorMetro = fatorFinanceiro * item.diametroNum;
    } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
      const prev = Number(servico.metragem_prevista_total) || 1000;
      valorMetro = prev > 0 ? (Number(servico.valor_total_fechado) || 0) / prev : 0;
    }

    const valorTotal = item.metros * valorMetro;

    const registroMedicao: ItemMedicaoFuro = {
      data: item.dataStr,
      dataRaw: item.dataRaw,
      mesAnoKey: item.mesAnoKey,
      mesNome: item.mesNome,
      ano: item.ano,
      os: item.os,
      medidaMts: Math.round(item.metros * 10) / 10,
      diametro: item.diametroNum,
      valorMetro: Math.round(valorMetro * 100) / 100,
      valorTotal: Math.round(valorTotal * 100) / 100,
      observacao: item.observacoes.join('; ')
    };

    if (!porMes[item.mesNome]) {
      porMes[item.mesNome] = [];
    }
    porMes[item.mesNome].push(registroMedicao);
  });

  // Ordena os registros dentro de cada mês por data
  Object.keys(porMes).forEach(m => {
    porMes[m].sort((a, b) => a.dataRaw.getTime() - b.dataRaw.getTime());
  });

  return porMes;
}

/**
 * Constrói uma planilha (Worksheet) formatada exatamente conforme o padrão da imagem
 */
function criarWorksheetMedicao(
  nomeCliente: string,
  nomeMes: string,
  itens: ItemMedicaoFuro[]
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Linhas iniciais:
  // Row 1 (index 0): padding
  // Row 2 (index 1): Cabeçalho com Logos e Título
  // Row 3 (index 2): continuação de merge vertical do cabeçalho
  // Row 4 (index 3): padding
  // Row 5 (index 4): Cabeçalhos das Colunas (DATA, 'OS', MEDIDA 1, DUTO, Valor Metro, VALOR TOTAL FURO, DESCRIÇÃO)
  // Row 6 (index 5): Subcabeçalhos (nº, mts, diametro, observação)
  // Rows 7+ (index 6+): Dados
  // Row N+1: TOTAL

  // 1. Cabeçalho Superior
  const clienteDisplay = nomeCliente ? `CONSTRUTORA ${nomeCliente.toUpperCase()}` : 'CONSTRUTORA CLIENTE';
  const tituloDisplay = `LANÇAMENTO MEDIÇÃO ${nomeMes.toUpperCase()}`;
  const empresaDisplay = 'TecnoDrill INFRA';

  ws['B2'] = { t: 's', v: clienteDisplay };
  ws['D2'] = { t: 's', v: tituloDisplay };
  ws['G2'] = { t: 's', v: empresaDisplay };

  // 2. Linha 5: Cabeçalhos Principais (Colunas B a H)
  ws['B5'] = { t: 's', v: 'DATA' };
  ws['C5'] = { t: 's', v: "'OS'" };
  ws['D5'] = { t: 's', v: 'MEDIDA 1' };
  ws['E5'] = { t: 's', v: 'DUTO' };
  ws['F5'] = { t: 's', v: 'Valor Metro' };
  ws['G5'] = { t: 's', v: 'VALOR TOTAL FURO' };
  ws['H5'] = { t: 's', v: 'DESCRIÇÃO' };

  // 3. Linha 6: Subcabeçalhos
  ws['B6'] = { t: 's', v: '' };
  ws['C6'] = { t: 's', v: 'nº' };
  ws['D6'] = { t: 's', v: 'mts' };
  ws['E6'] = { t: 's', v: 'diametro' };
  ws['F6'] = { t: 's', v: '' };
  ws['G6'] = { t: 's', v: '' };
  ws['H6'] = { t: 's', v: 'observação' };

  // 4. Linhas de Dados
  let curRow = 7;
  let somaMetros = 0;
  let somaTotal = 0;

  itens.forEach(item => {
    ws[`B${curRow}`] = { t: 's', v: item.data };
    ws[`C${curRow}`] = { t: 's', v: item.os };
    ws[`D${curRow}`] = { t: 'n', v: item.medidaMts, z: '#,##0.0' };
    ws[`E${curRow}`] = { t: 'n', v: item.diametro, z: '0' };
    ws[`F${curRow}`] = { t: 'n', v: item.valorMetro, z: '"R$" #,##0.00' };
    ws[`G${curRow}`] = { 
      t: 'n', 
      f: `D${curRow}*F${curRow}`, 
      v: item.valorTotal, 
      z: '"R$" #,##0.00' 
    };
    ws[`H${curRow}`] = { t: 's', v: item.observacao };

    somaMetros += item.medidaMts;
    somaTotal += item.valorTotal;
    curRow++;
  });

  // Se não houver itens, garante pelo menos 1 linha vazia
  if (itens.length === 0) {
    ws[`B${curRow}`] = { t: 's', v: '-' };
    ws[`C${curRow}`] = { t: 's', v: '-' };
    ws[`D${curRow}`] = { t: 'n', v: 0 };
    ws[`E${curRow}`] = { t: 'n', v: 0 };
    ws[`F${curRow}`] = { t: 'n', v: 0, z: '"R$" #,##0.00' };
    ws[`G${curRow}`] = { t: 'n', v: 0, z: '"R$" #,##0.00' };
    ws[`H${curRow}`] = { t: 's', v: 'Nenhum lançamento no período' };
    curRow++;
  }

  // 5. Linha de TOTAL
  const firstDataRow = 7;
  const lastDataRow = curRow - 1;

  ws[`B${curRow}`] = { t: 's', v: 'TOTAL' };
  ws[`C${curRow}`] = { t: 's', v: '' };
  ws[`D${curRow}`] = { 
    t: 'n', 
    f: `SUM(D${firstDataRow}:D${lastDataRow})`, 
    v: Math.round(somaMetros * 10) / 10, 
    z: '#,##0.0' 
  };
  ws[`E${curRow}`] = { t: 's', v: '' };
  ws[`F${curRow}`] = { t: 's', v: '' };
  ws[`G${curRow}`] = { 
    t: 'n', 
    f: `SUM(G${firstDataRow}:G${lastDataRow})`, 
    v: Math.round(somaTotal * 100) / 100, 
    z: '"R$" #,##0.00' 
  };
  ws[`H${curRow}`] = { t: 's', v: '' };

  // Definição da área de referência da planilha
  ws['!ref'] = `A1:H${curRow + 2}`;

  // Larguras de Colunas (Pixel width balanceado)
  ws['!cols'] = [
    { wch: 4 },   // A: margem
    { wch: 14 },  // B: DATA
    { wch: 16 },  // C: 'OS' nº
    { wch: 14 },  // D: MEDIDA 1 mts
    { wch: 12 },  // E: DUTO diametro
    { wch: 16 },  // F: Valor Metro
    { wch: 22 },  // G: VALOR TOTAL FURO
    { wch: 32 }   // H: DESCRIÇÃO obeservação
  ];

  // Mesclagens (Merges) idênticas ao layout do Excel
  ws['!merges'] = [
    { s: { r: 1, c: 1 }, e: { r: 2, c: 2 } }, // B2:C3 - Construtora / Cliente
    { s: { r: 1, c: 3 }, e: { r: 2, c: 5 } }, // D2:F3 - Título Centralizado
    { s: { r: 1, c: 6 }, e: { r: 2, c: 7 } }, // G2:H3 - TecnoDrill INFRA
    { s: { r: curRow - 1, c: 1 }, e: { r: curRow - 1, c: 2 } } // Linha TOTAL: B e C
  ];

  return ws;
}

/**
 * Gera e dispara o download do relatório de medição em Excel para um serviço específico
 */
export function exportarRelatorioMedicaoServico(
  servico: Servico,
  barras: Barra[],
  nomeFiltroPeriodo?: string
) {
  const porMes = processarBarrasParaMedicao(servico, barras);
  const wb = XLSX.utils.book_new();

  const mesesKeys = Object.keys(porMes);

  if (mesesKeys.length === 0) {
    // Se não houver barras no período, gera uma aba com o nome do mês ativo ou MEDIÇÃO
    const fallbackMes = nomeFiltroPeriodo ? nomeFiltroPeriodo.toUpperCase() : 'MEDIÇÃO';
    const ws = criarWorksheetMedicao(servico.cliente || servico.nome, fallbackMes, []);
    XLSX.utils.book_append_sheet(wb, ws, fallbackMes.slice(0, 31));
  } else {
    mesesKeys.forEach(mesNome => {
      const itens = porMes[mesNome];
      const ws = criarWorksheetMedicao(servico.cliente || servico.nome, mesNome, itens);
      // O nome da aba no Excel suporta até 31 caracteres
      const tabName = mesNome.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, tabName);
    });
  }

  const sanitizedCliente = (servico.cliente || 'CLIENTE').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedObra = (servico.nome || servico.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PLANILHA_Medicao_${sanitizedCliente}_${sanitizedObra}.xlsx`;

  XLSX.writeFile(wb, filename);
}

/**
 * Gera e dispara o download consolidado de todas as obras filtradas
 */
export function exportarRelatorioMedicaoConsolidado(
  servicos: Servico[],
  barrasPorServico: Record<string, Barra[]>,
  nomeFiltroPeriodo?: string
) {
  const wb = XLSX.utils.book_new();
  let sheetsCount = 0;

  servicos.forEach(servico => {
    const barras = barrasPorServico[servico.id] || [];
    const porMes = processarBarrasParaMedicao(servico, barras);
    const mesesKeys = Object.keys(porMes);

    const siglaObra = (servico.id || servico.nome.slice(0, 10)).replace(/[^a-zA-Z0-9]/g, '');

    if (mesesKeys.length === 0) {
      const fallbackMes = nomeFiltroPeriodo ? `${siglaObra}_${nomeFiltroPeriodo.slice(0, 15)}` : `${siglaObra}_MED`;
      const ws = criarWorksheetMedicao(servico.cliente || servico.nome, fallbackMes, []);
      XLSX.utils.book_append_sheet(wb, ws, fallbackMes.slice(0, 31));
      sheetsCount++;
    } else {
      mesesKeys.forEach(mesNome => {
        const itens = porMes[mesNome];
        const tabTitle = `${mesNome} - ${siglaObra}`.slice(0, 31);
        const ws = criarWorksheetMedicao(servico.cliente || servico.nome, mesNome, itens);
        XLSX.utils.book_append_sheet(wb, ws, tabTitle);
        sheetsCount++;
      });
    }
  });

  const filename = `PLANILHA_Medicao_Consolidada_TecnoDrill_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
