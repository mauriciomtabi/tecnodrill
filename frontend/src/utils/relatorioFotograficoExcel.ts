import ExcelJS from 'exceljs';
import { Servico, Barra } from '../types';
import { TECNODRILL_LOGO_BASE64 } from './tecnodrillLogoBase64';
import { sanitizeLocalidade, parseBarraObservacao } from '../services/api';

// Paleta Oficial TecnoDrill
const COLOR_TECNODRILL_ORANGE = 'FFF05A22';
const COLOR_TECNODRILL_DARK = 'FF161B22';
const COLOR_WHITE = 'FFFFFFFF';
const COLOR_BORDER_DARK = 'FF2C3033';
const COLOR_BORDER_LIGHT = 'FFE2E8F0';
const COLOR_HEADER_BG = 'FFF8FAFC';
const COLOR_TEXT_MUTED = 'FF475569';
const COLOR_ZEBRA_LIGHT = 'FFF8F9FA';

export interface ItemFotoExcel {
  id: string;
  url: string;
  numeroBarra: number;
  subIndice: number;
  totalFotosBarra: number;
  isCaixa: boolean;
  tipoCaixa?: string;
  metros: number;
  metrosAcumulados: number;
  diametro?: string;
  profundidadeCm?: number;
  distanciaPistaCm?: number;
  anguloPitch?: string;
  endereco?: string;
  coordenadas?: string;
  dataHora?: string;
  registradoPor?: string;
  observacao?: string;
  numeroOs?: string;
}

function colWidthToPx(chars: number): number {
  return Math.floor(chars * 7 + 5);
}

function rowHeightToPx(pt: number): number {
  return Math.round(pt * 96 / 72);
}

export function sanitizarNomeAba(nome: string): string {
  const limpo = (nome || 'SERVICO')
    .replace(/[\\/*?[\]:]/g, '_')
    .trim()
    .replace(/\s+/g, ' ');
  return limpo.slice(0, 30) || 'SERVICO';
}

/**
 * Converte URLs de imagem (Cloudinary, Supabase Storage, Base64) em ArrayBuffer de forma resiliente
 */
async function carregarImagemBuffer(url: string): Promise<{ buffer: ArrayBuffer | null; extension: 'jpeg' | 'png'; width: number; height: number }> {
  if (!url || typeof url !== 'string') {
    return { buffer: null, extension: 'jpeg', width: 800, height: 600 };
  }

  const cleanUrl = url.trim();

  // Caso 1: Data URL Base64
  if (cleanUrl.startsWith('data:image/')) {
    try {
      const isPng = cleanUrl.startsWith('data:image/png');
      const base64Data = cleanUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Dimensões da imagem
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
        img.onerror = () => resolve({ width: 800, height: 600 });
        img.src = cleanUrl;
      });

      return { buffer: bytes.buffer, extension: isPng ? 'png' : 'jpeg', width: dims.width, height: dims.height };
    } catch (e) {
      console.warn('[Relatório Fotográfico] Erro ao decodificar base64:', e);
      return { buffer: null, extension: 'jpeg', width: 800, height: 600 };
    }
  }

  // Caso 2: URL remota (Supabase, Cloudinary, etc.)
  try {
    let fetchUrl = cleanUrl;
    // Otimização de CDN se for Cloudinary para download leve e veloz
    if (fetchUrl.includes('res.cloudinary.com') && fetchUrl.includes('/upload/') && !fetchUrl.includes('/upload/w_')) {
      fetchUrl = fetchUrl.replace('/upload/', '/upload/w_1024,c_limit,q_auto:good,f_jpg/');
    }

    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const isPng = blob.type.includes('png') || fetchUrl.toLowerCase().endsWith('.png');
      const buffer = await blob.arrayBuffer();

      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ width: 800, height: 600 });
        };
        img.src = objectUrl;
      });

      return { buffer, extension: isPng ? 'png' : 'jpeg', width: dims.width, height: dims.height };
    }
  } catch (err) {
    console.warn('[Relatório Fotográfico] fetch direto falhou para:', cleanUrl, err);
  }

  // Caso 3: Fallback via Canvas para contornar restrições de headers
  try {
    const fallbackDims = await new Promise<{ buffer: ArrayBuffer | null; extension: 'jpeg' | 'png'; width: number; height: number }>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (b) => {
              if (b) {
                const buf = await b.arrayBuffer();
                resolve({ buffer: buf, extension: 'jpeg', width: canvas.width, height: canvas.height });
              } else {
                resolve({ buffer: null, extension: 'jpeg', width: 800, height: 600 });
              }
            }, 'image/jpeg', 0.85);
            return;
          }
        } catch (_) {}
        resolve({ buffer: null, extension: 'jpeg', width: 800, height: 600 });
      };
      img.onerror = () => resolve({ buffer: null, extension: 'jpeg', width: 800, height: 600 });
      img.src = cleanUrl;
    });

    return fallbackDims;
  } catch (_e) {
    return { buffer: null, extension: 'jpeg', width: 800, height: 600 };
  }
}

/**
 * Extrai todos os itens fotográficos e metadados das barras do serviço
 */
export function extrairItensFotograficos(servico: Servico, barras: Barra[]): {
  itensFotos: ItemFotoExcel[];
  totalMetros: number;
} {
  const sortedBarras = [...barras].sort((a, b) => a.numero_barra - b.numero_barra);
  const itensFotos: ItemFotoExcel[] = [];
  let totalMetros = 0;

  sortedBarras.forEach(b => {
    const isCaixa = b.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro);
    const m = isCaixa ? 0 : (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
    totalMetros += m;

    const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);

    // Lista de fotos desta barra
    const fotosList: string[] = [];
    if (Array.isArray(b.fotos) && b.fotos.length > 0) {
      b.fotos.forEach(f => {
        if (f && typeof f === 'string' && f.trim()) fotosList.push(f.trim());
      });
    }
    if (fotosList.length === 0 && b.foto_url && b.foto_url.trim()) {
      fotosList.push(b.foto_url.trim());
    }
    if (fotosList.length === 0 && meta?.fotos && Array.isArray(meta.fotos)) {
      meta.fotos.forEach((f: string) => {
        if (f && typeof f === 'string' && f.trim()) fotosList.push(f.trim());
      });
    }

    // Informações de data / hora formatadas
    let dataHoraStr = '';
    const rawData = b.data_registro || meta?.data_referencia || b.horario_registro || b.created_at;
    if (rawData) {
      try {
        const d = new Date(rawData);
        if (!isNaN(d.getTime())) {
          dataHoraStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } catch (_) {}
    }

    // Coordenadas
    let coordsStr = '';
    if (b.latitude !== undefined && b.latitude !== null && b.longitude !== undefined && b.longitude !== null) {
      coordsStr = `${Number(b.latitude).toFixed(6)}, ${Number(b.longitude).toFixed(6)}`;
    }

    // Responsável
    const respNome = b.registrado_por_nome || meta?.registrado_por_nome || servico.navegador_nome || servico.operador_nome || 'Equipe TecnoDrill';

    // Diâmetro formatado
    const diamStr = b.diametro || (servico.diametro_furo_mm ? `${servico.diametro_furo_mm} mm` : '150 mm');

    // OS
    const numOs = b.numero_os || meta?.numero_os || '';

    // Se possui fotos, adiciona cada uma como item fotográfico
    if (fotosList.length > 0) {
      fotosList.forEach((fotoUrl, idx) => {
        itensFotos.push({
          id: `${b.id}_foto_${idx + 1}`,
          url: fotoUrl,
          numeroBarra: b.numero_barra,
          subIndice: idx + 1,
          totalFotosBarra: fotosList.length,
          isCaixa,
          tipoCaixa: b.tipo_caixa || (isCaixa ? 'Caixa de Passagem' : undefined),
          metros: m,
          metrosAcumulados: b.metros_acumulados || totalMetros,
          diametro: diamStr,
          profundidadeCm: b.profundidade_cm,
          distanciaPistaCm: b.distancia_pista_cm,
          anguloPitch: b.angulo_pitch,
          endereco: b.endereco || meta?.endereco,
          coordenadas: coordsStr,
          dataHora: dataHoraStr,
          registradoPor: respNome,
          observacao: cleanObs || undefined,
          numeroOs: numOs || undefined
        });
      });
    }
  });

  return { itensFotos, totalMetros };
}

/**
 * Função principal para exportar o Relatório Fotográfico em Excel (.xlsx)
 */
export async function exportarRelatorioFotograficoExcel(
  servico: Servico,
  barras: Barra[],
  options?: {
    onProgress?: (atual: number, total: number) => void;
  }
): Promise<void> {
  const { itensFotos, totalMetros } = extrairItensFotograficos(servico, barras);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TecnoDrill INFRA - Sistema de Perfuração MND';
  wb.created = new Date();

  const cleanServicoNome = sanitizarNomeAba(servico.nome || servico.id);
  const wsFotos = wb.addWorksheet('RELATÓRIO FOTOGRÁFICO', {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  // ── Configuração das Colunas (A–G) ──────────────────────────────────────────
  // Grid com 3 fotos por linha: Coluna B (48), Coluna D (48), Coluna F (48)
  const colWidths = [3.5, 48, 2.0, 48, 2.0, 48, 3.5];
  wsFotos.columns = colWidths.map(w => ({ width: w }));

  // ── Altura das Linhas do Cabeçalho (1 a 6) ──────────────────────────────────
  const headerHeights: Record<number, number> = {
    1: 12, // Espaçador
    2: 44, // Logo e Título
    3: 24, // Continuação Título
    4: 26, // Subtítulo com Dados da Obra
    5: 24, // Barra de Metadados da Equipe
    6: 10  // Espaçador antes das fotos
  };
  for (const [r, h] of Object.entries(headerHeights)) {
    wsFotos.getRow(Number(r)).height = h;
  }

  // ── Bordas padrão ──────────────────────────────────────────────────────────
  const thickBorder = { style: 'medium' as const, color: { argb: COLOR_BORDER_DARK } };
  const thinBorder = { style: 'thin' as const, color: { argb: COLOR_BORDER_LIGHT } };

  // ── Mesclagens do Cabeçalho ────────────────────────────────────────────────
  wsFotos.mergeCells('B2:C4'); // Slot do Logo Tecnodrill
  wsFotos.mergeCells('D2:F3'); // Título Principal
  wsFotos.mergeCells('D4:F4'); // Subtítulo Serviço / Cliente / Local
  wsFotos.mergeCells('B5:F5'); // Resumo Equipe e Diâmetro

  // ── 1. Logo TecnoDrill (B2:C4) ──────────────────────────────────────────────
  try {
    const logoId = wb.addImage({
      base64: TECNODRILL_LOGO_BASE64,
      extension: 'png'
    });

    const slotW = colWidthToPx(48 + 2.0); // B + C ≈ 355 px
    const slotH = rowHeightToPx(44 + 24 + 26); // ≈ 125 px
    const pad = 8;
    const availW = slotW - pad * 2;
    const availH = slotH - pad * 2;
    const imgRatio = 460 / 140; // Proporção padrão do logo Tecnodrill horizontal
    const boxRatio = availW / availH;

    let drawW: number;
    let drawH: number;
    if (imgRatio > boxRatio) {
      drawW = availW;
      drawH = Math.round(availW / imgRatio);
    } else {
      drawH = availH;
      drawW = Math.round(availH * imgRatio);
    }
    const xOff = Math.round(pad + (availW - drawW) / 2);
    const yOff = Math.round(pad + (availH - drawH) / 2);

    wsFotos.addImage(logoId, {
      tl: {
        nativeCol: 1, // Coluna B (0-indexed = 1)
        nativeColOff: xOff * 9525,
        nativeRow: 1, // Linha 2 (0-indexed = 1)
        nativeRowOff: yOff * 9525
      },
      ext: { width: drawW, height: drawH }
    } as any);
  } catch (err) {
    console.warn('[Relatório Fotográfico] Falha ao adicionar logo:', err);
    const cellLogo = wsFotos.getCell('B2');
    cellLogo.value = 'TECNODRILL INFRA';
    cellLogo.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLOR_TECNODRILL_ORANGE } };
    cellLogo.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Estilização do box do Logo
  ['B2', 'B3', 'B4', 'C2', 'C3', 'C4'].forEach(c => {
    const cell = wsFotos.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WHITE } };
  });
  wsFotos.getCell('B2').border = { top: thickBorder, left: thickBorder };
  wsFotos.getCell('C2').border = { top: thickBorder, right: thickBorder };
  wsFotos.getCell('B4').border = { bottom: thickBorder, left: thickBorder };
  wsFotos.getCell('C4').border = { bottom: thickBorder, right: thickBorder };

  // ── 2. Título Principal (D2:F3) ─────────────────────────────────────────────
  const titleCell = wsFotos.getCell('D2');
  titleCell.value = 'TECNODRILL INFRA • RELATÓRIO FOTOGRÁFICO DE PERFURAÇÃO MND';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLOR_WHITE } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_DARK } };

  ['D2', 'E2', 'F2', 'D3', 'E3', 'F3'].forEach(c => {
    const cell = wsFotos.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_DARK } };
  });
  wsFotos.getCell('D2').border = { top: thickBorder, left: thickBorder };
  wsFotos.getCell('F2').border = { top: thickBorder, right: thickBorder };
  wsFotos.getCell('D3').border = { bottom: thinBorder, left: thickBorder };
  wsFotos.getCell('F3').border = { bottom: thinBorder, right: thickBorder };

  // ── 3. Subtítulo com Metadados (D4:F4) ───────────────────────────────────────
  const subCell = wsFotos.getCell('D4');
  const localidadeLimpa = sanitizeLocalidade(servico.local, servico.cidade, servico.uf);
  subCell.value = `SERVIÇO: ${servico.nome.toUpperCase()}   |   CLIENTE: ${(servico.cliente || 'N/A').toUpperCase()}   |   LOCAL: ${localidadeLimpa.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_WHITE } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_ORANGE } };

  ['D4', 'E4', 'F4'].forEach(c => {
    const cell = wsFotos.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_ORANGE } };
  });
  wsFotos.getCell('D4').border = { bottom: thickBorder, left: thickBorder };
  wsFotos.getCell('F4').border = { bottom: thickBorder, right: thickBorder };

  // ── 4. Linha de Metadados da Equipe e Obra (B5:F5) ──────────────────────────
  const gestorNome = 'Carlos / Eduardo';
  const navegadorNome = servico.navegador_nome || 'N/A';
  const operadorNome = servico.operador_nome || 'N/A';
  const diametroStr = servico.diametro_furo_mm ? `DN ${servico.diametro_furo_mm} mm` : 'DN Variável';

  const metaCell = wsFotos.getCell('B5');
  metaCell.value = `GESTOR: ${gestorNome}   •   NAVEGADOR: ${navegadorNome}   •   OPERADOR: ${operadorNome}   •   DIÂMETRO: ${diametroStr}   •   TOTAL: ${itensFotos.length} FOTOS REGISTRADAS (${barras.length} BARRAS)`;
  metaCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

  ['B5', 'C5', 'D5', 'E5', 'F5'].forEach(c => {
    const cell = wsFotos.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { top: thickBorder, bottom: thickBorder, left: c === 'B5' ? thickBorder : thinBorder, right: c === 'F5' ? thickBorder : thinBorder };
  });

  // ── 5. Download das Fotos em Paralelo ───────────────────────────────────────
  const totalItens = itensFotos.length;
  if (options?.onProgress) options.onProgress(0, totalItens);

  const downloadedFotos: Array<{
    item: ItemFotoExcel;
    buffer: ArrayBuffer | null;
    extension: 'jpeg' | 'png';
    width: number;
    height: number;
  }> = [];

  // Baixa com concorrência moderada (3 por lote) para alta performance sem travar navegador
  const BATCH_SIZE = 3;
  for (let b = 0; b < itensFotos.length; b += BATCH_SIZE) {
    const batch = itensFotos.slice(b, b + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const res = await carregarImagemBuffer(item.url);
        return { item, ...res };
      })
    );
    downloadedFotos.push(...batchResults);
    if (options?.onProgress) {
      options.onProgress(Math.min(b + BATCH_SIZE, totalItens), totalItens);
    }
  }

  // ── 6. Renderização da Grade Fotográfica (Linha 7 em diante) ────────────────
  const GRID_COLS = [1, 3, 5]; // 0-indexed: B=1, D=3, F=5
  const GRID_COL_NUMS = [2, 4, 6]; // 1-indexed

  let currentRow = 7;

  if (downloadedFotos.length === 0) {
    // Aviso de ausência de fotos
    wsFotos.mergeCells(`B${currentRow}:F${currentRow + 3}`);
    const emptyCell = wsFotos.getCell(`B${currentRow}`);
    emptyCell.value = 'NENHUM REGISTRO FOTOGRÁFICO ANEXADO A ESTE SERVIÇO ATÉ O MOMENTO.\nConsulte a aba "DADOS TÉCNICOS & BARRAS" para visualizar o registro numérico das perfurações.';
    emptyCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    currentRow += 5;
  } else {
    for (let i = 0; i < downloadedFotos.length; i += 3) {
      const group = downloadedFotos.slice(i, i + 3);

      const photoRow = currentRow;
      const label1Row = currentRow + 1;
      const label2Row = currentRow + 2;
      const spacerRow = currentRow + 3;

      wsFotos.getRow(photoRow).height = 205;  // Espaço da imagem
      wsFotos.getRow(label1Row).height = 22;   // Título / Número da barra / Metros
      wsFotos.getRow(label2Row).height = 32;   // Profundidade / Pitch / Endereço / Data
      wsFotos.getRow(spacerRow).height = 8;    // Espaçamento entre cartões

      for (let gi = 0; gi < group.length; gi++) {
        const { item, buffer, extension, width, height } = group[gi];
        const colIdx = GRID_COLS[gi];
        const colNum = GRID_COL_NUMS[gi];

        const photoCell = wsFotos.getCell(photoRow, colNum);
        const label1Cell = wsFotos.getCell(label1Row, colNum);
        const label2Cell = wsFotos.getCell(label2Row, colNum);

        // Fundo branco
        photoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WHITE } };
        label1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
        label2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WHITE } };

        // Bordas completas estilo Cartão Executivo
        photoCell.border = { top: thickBorder, left: thickBorder, right: thickBorder };
        label1Cell.border = { top: thinBorder, left: thickBorder, right: thickBorder };
        label2Cell.border = { top: thinBorder, left: thickBorder, right: thickBorder, bottom: thickBorder };

        // ── Textos dos Rótulos ──
        let tituloBarra = '';
        if (item.isCaixa) {
          tituloBarra = `PONTO DE CAIXA • Nº ${item.numeroBarra}${item.tipoCaixa ? ` (${item.tipoCaixa})` : ''}`;
        } else {
          tituloBarra = `BARRA ${String(item.numeroBarra).padStart(2, '0')} • ${item.metros} m (Acumulado: ${item.metrosAcumulados} m)`;
        }
        if (item.totalFotosBarra > 1) {
          tituloBarra += ` [Foto ${item.subIndice}/${item.totalFotosBarra}]`;
        }
        if (item.numeroOs) {
          tituloBarra += ` • OS: ${item.numeroOs}`;
        }

        label1Cell.value = tituloBarra;
        label1Cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
        label1Cell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Linha 2 de Detalhes Técnicos
        const partesLinha1: string[] = [];
        if (item.profundidadeCm !== undefined && item.profundidadeCm !== null) {
          partesLinha1.push(`Prof: ${item.profundidadeCm} cm`);
        }
        if (item.anguloPitch) {
          partesLinha1.push(`Pitch: ${item.anguloPitch}`);
        }
        if (item.diametro) {
          partesLinha1.push(`Diâm: ${item.diametro}`);
        }

        const partesLinha2: string[] = [];
        if (item.endereco) {
          partesLinha2.push(item.endereco);
        } else if (item.coordenadas) {
          partesLinha2.push(`GPS: ${item.coordenadas}`);
        }
        if (item.dataHora) {
          partesLinha2.push(item.dataHora);
        }
        if (item.registradoPor) {
          partesLinha2.push(`Reg: ${item.registradoPor}`);
        }

        const textoDetalhes = [
          partesLinha1.join('   |   ') || 'Parâmetros operacionais padrão',
          partesLinha2.join('   •   ') || 'Localização da Obra'
        ].join('\n');

        label2Cell.value = textoDetalhes;
        label2Cell.font = { name: 'Calibri', size: 8.5, color: { argb: COLOR_TEXT_MUTED } };
        label2Cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // ── Inserção da Imagem Centralizada com Aspect Ratio ──
        if (buffer) {
          try {
            const imgId = wb.addImage({
              buffer: buffer as any,
              extension
            });

            const slotW = colWidthToPx(48); // ≈ 341 px
            const slotH = rowHeightToPx(205); // ≈ 273 px
            const pad = 6;
            const availW = slotW - pad * 2;
            const availH = slotH - pad * 2;

            const imgRatio = (width || 800) / (height || 600);
            const boxRatio = availW / availH;

            let drawW: number;
            let drawH: number;
            if (imgRatio > boxRatio) {
              drawW = availW;
              drawH = Math.round(availW / imgRatio);
            } else {
              drawH = availH;
              drawW = Math.round(availH * imgRatio);
            }

            const xOff = Math.round(pad + (availW - drawW) / 2);
            const yOff = Math.round(pad + (availH - drawH) / 2);

            wsFotos.addImage(imgId, {
              tl: {
                nativeCol: colIdx,
                nativeColOff: xOff * 9525,
                nativeRow: photoRow - 1,
                nativeRowOff: yOff * 9525
              },
              ext: { width: drawW, height: drawH }
            } as any);
          } catch (imgErr) {
            console.warn('[Relatório Fotográfico] Falha ao renderizar imagem no Excel:', imgErr);
            photoCell.value = '[Imagem não pôde ser renderizada]';
            photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
            photoCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
          }
        } else {
          photoCell.value = '[Foto não disponível para download]';
          photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
          photoCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
        }
      }

      currentRow += 4;
    }
  }

  // ── 7. Resumo Final e Assinaturas ──────────────────────────────────────────
  currentRow += 1;
  wsFotos.getRow(currentRow).height = 26;
  wsFotos.mergeCells(`B${currentRow}:F${currentRow}`);
  const summaryCell = wsFotos.getCell(`B${currentRow}`);
  summaryCell.value = `METRAGEM TOTAL PERFURADA: ${totalMetros.toLocaleString('pt-BR')} METROS   |   TOTAL DE PONTOS: ${barras.length} BARRAS   |   FOTOS CONSOLIDADAS: ${itensFotos.length} REGISTROS`;
  summaryCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR_WHITE } };
  summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };

  ['B', 'C', 'D', 'E', 'F'].forEach(c => {
    const cell = wsFotos.getCell(`${c}${currentRow}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_ORANGE } };
    cell.border = { top: thickBorder, bottom: thickBorder, left: thickBorder, right: thickBorder };
  });

  currentRow += 2;
  wsFotos.getRow(currentRow).height = 45;

  wsFotos.mergeCells(`B${currentRow}:C${currentRow}`);
  const sign1 = wsFotos.getCell(`B${currentRow}`);
  sign1.value = '________________________________________\nResponsável Técnico / Navegador\nTecnoDrill INFRA';
  sign1.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
  sign1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  wsFotos.mergeCells(`E${currentRow}:F${currentRow}`);
  const sign2 = wsFotos.getCell(`E${currentRow}`);
  sign2.value = `________________________________________\nFiscalização / Engenharia\n${servico.cliente || 'Contratante'}`;
  sign2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR_TECNODRILL_DARK } };
  sign2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // ── ABA 2: DADOS TÉCNICOS & BARRAS (Planilha Detalhada Completa) ───────────
  const wsBarras = wb.addWorksheet('DADOS TÉCNICOS & BARRAS', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToWidth: 1 }
  });

  const headersTabela = [
    'Barra Nº',
    'Tipo Registro',
    'Metros (m)',
    'Metros Acum. (m)',
    'Profundidade (cm)',
    'Pitch / Ângulo',
    'Diâmetro',
    'Nº OS',
    'Possui Foto?',
    'Localização / Endereço',
    'Data & Hora',
    'Registrado Por',
    'Observações'
  ];

  wsBarras.columns = [
    { width: 12 }, // Barra Nº
    { width: 16 }, // Tipo
    { width: 14 }, // Metros
    { width: 16 }, // Metros Acum
    { width: 18 }, // Profundidade
    { width: 16 }, // Pitch
    { width: 14 }, // Diâmetro
    { width: 14 }, // OS
    { width: 14 }, // Possui Foto
    { width: 36 }, // Endereço
    { width: 20 }, // Data/Hora
    { width: 22 }, // Registrado Por
    { width: 32 }  // Observações
  ];

  // Cabeçalho da Tabela Técnica
  wsBarras.getRow(1).height = 32;
  wsBarras.getRow(1).values = headersTabela;
  wsBarras.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TECNODRILL_DARK } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: thickBorder, bottom: thickBorder, left: thinBorder, right: thinBorder };
  });

  let rIdx = 2;
  const sortedBarras = [...barras].sort((a, b) => a.numero_barra - b.numero_barra);

  sortedBarras.forEach((b, idx) => {
    const isCaixa = b.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro);
    const m = isCaixa ? 0 : (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
    const { observacao: cleanObs, meta } = parseBarraObservacao(b.observacao);

    const hasFoto = Boolean(
      (b.fotos && b.fotos.length > 0) ||
      (b.foto_url && b.foto_url.trim()) ||
      (meta?.fotos && meta.fotos.length > 0)
    );

    let dataHoraStr = '';
    const rawData = b.data_registro || meta?.data_referencia || b.horario_registro || b.created_at;
    if (rawData) {
      try {
        const d = new Date(rawData);
        if (!isNaN(d.getTime())) {
          dataHoraStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } catch (_) {}
    }

    const rowValues = [
      b.numero_barra,
      isCaixa ? `Caixa ${b.tipo_caixa || ''}` : 'Canalização',
      m,
      b.metros_acumulados || 0,
      b.profundidade_cm !== undefined && b.profundidade_cm !== null ? b.profundidade_cm : '-',
      b.angulo_pitch || '-',
      b.diametro || (servico.diametro_furo_mm ? `${servico.diametro_furo_mm} mm` : '150 mm'),
      b.numero_os || meta?.numero_os || '-',
      hasFoto ? 'SIM' : 'NÃO',
      b.endereco || (b.latitude && b.longitude ? `${Number(b.latitude).toFixed(6)}, ${Number(b.longitude).toFixed(6)}` : '-'),
      dataHoraStr || '-',
      b.registrado_por_nome || meta?.registrado_por_nome || servico.navegador_nome || '-',
      cleanObs || '-'
    ];

    const row = wsBarras.getRow(rIdx);
    row.height = 20;
    row.values = rowValues;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.alignment = {
        horizontal: colNumber === 10 || colNumber === 13 ? 'left' : 'center',
        vertical: 'middle'
      };
      cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA_LIGHT } };
      }
      if (colNumber === 9 && hasFoto) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF16A34A' } };
      }
    });

    rIdx++;
  });

  // ── 8. Salvar e Disparar Download no Navegador ──────────────────────────────
  const safeDate = new Date().toISOString().slice(0, 10);
  const safeFilename = `Relatorio_Fotografico_${cleanServicoNome}_${safeDate}.xlsx`;

  await baixarWorkbook(wb, safeFilename);
}

/**
 * Função utilitária para converter workbook em blob e baixar diretamente
 */
async function baixarWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
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
