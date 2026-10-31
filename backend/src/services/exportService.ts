import ExcelJS from 'exceljs';
import { DBManager, TecnodrillFuro, TecnodrillBarra, TecnodrillServico } from '../database/db';
import { TECNODRILL_LOGO_BASE64 } from './tecnodrillLogoBase64';

export class ExportService {
  /**
   * Gera uma planilha Excel formatada exatamente como o Relatório de Perfuração - Navigator da TecnoDrill INFRA
   */
  public static async gerarExcelFuro(furoId: string): Promise<Buffer> {
    const furo = await DBManager.getFuroById(furoId);
    if (!furo) throw new Error('Furo não encontrado');

    const servico = await DBManager.getServicoById(furo.servico_id);
    const barras = await DBManager.getBarras(furoId);
    const totalMetrosPerfurados = barras.reduce((acc, b) => {
      const isCaixa = b.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro);
      if (isCaixa) return acc;
      return acc + (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
    }, 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TecnoDrill INFRA - Sistema de Perfuração MND';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Relatório de Perfuração', {
      pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    // Paleta de cores Tecnodrill
    const TECNO_ORANGE = 'F05A22';
    const TECNO_DARK = '2C3033';
    const LIGHT_GRAY = 'F4F5F7';

    // 1. Cabeçalho Principal com Marca
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'TECNODRILL INFRA - RELATÓRIO DE PERFURAÇÃO (NAVIGATOR)';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TECNO_DARK } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    // 2. Metadados do Serviço / Furo
    const infoRows = [
      ['Data:', furo.data_furo, 'Cliente:', servico?.cliente || 'Não informado', 'Projeto:', servico?.projeto || 'N/A'],
      ['Obra:', servico?.obra || servico?.nome || 'N/A', 'C/C:', servico?.centro_custo || 'N/A', 'Local:', servico?.local || 'N/A'],
      ['Navegador:', furo.navegador_nome || 'N/A', 'Operador:', furo.operador_nome || 'N/A', 'Status:', furo.status],
      ['Tubo Aplicado:', furo.tubo_aplicado || 'N/A', 'Diâmetro do Furo:', furo.diametro_furo || `${servico?.diametro_furo_mm || ''} mm`, 'Comprimento Total:', `${furo.comprimento_furo || totalMetrosPerfurados} MTS`],
      ['Hora Início Furo:', furo.hora_inicio_furo || '-', 'Hora Fim Furo:', furo.hora_fim_furo || '-', 'Horímetro Furo:', `${furo.horimetro_inicio_furo || '-'} até ${furo.horimetro_fim_furo || '-'}`],
      ['Hora Início Puxada:', furo.hora_inicio_pux || '-', 'Hora Fim Puxada:', furo.hora_fim_pux || '-', 'Horímetro Puxada:', `${furo.horimetro_inicio_pux || '-'} até ${furo.horimetro_fim_pux || '-'}`]
    ];

    let currentRow = 3;
    infoRows.forEach(row => {
      sheet.getRow(currentRow).values = row;
      ['A', 'C', 'E'].forEach(col => {
        const cell = sheet.getCell(`${col}${currentRow}`);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: TECNO_ORANGE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
      });
      ['B', 'D', 'F'].forEach(col => {
        const cell = sheet.getCell(`${col}${currentRow}`);
        cell.font = { name: 'Arial', size: 10 };
      });
      sheet.getRow(currentRow).height = 20;
      currentRow++;
    });

    currentRow += 1;

    // 3. Tabela de Barras
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const tableHeader1 = sheet.getCell(`A${currentRow}`);
    tableHeader1.value = 'REGISTRO DE BARRAS PERFURADAS E PONTOS DE CAIXA';
    tableHeader1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    tableHeader1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TECNO_ORANGE } };
    tableHeader1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(currentRow).height = 25;
    currentRow++;

    // Subcabeçalhos
    const headers = ['Barra Nº', 'Metros (MTS)', 'Ângulo / Pitch', 'Profundidade (cm)', 'Distância Pista (cm)', 'Horário / GPS'];
    sheet.getRow(currentRow).values = headers;
    sheet.getRow(currentRow).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TECNO_DARK } };
    sheet.getRow(currentRow).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // Preencher linhas das barras (ou até 70 barras padrão)
    const totalSlots = Math.max(barras.length, 35);
    for (let i = 1; i <= totalSlots; i++) {
      const barra = barras.find(b => b.numero_barra === i);
      const isCaixa = barra && (barra.tipo_registro === 'CAIXA' || Boolean(barra.tem_caixa && !barra.diametro));
      const rowData = [
        i,
        isCaixa ? 'PONTO DE CAIXA' : (barra ? `${barra.metros_acumulados} m` : '-'),
        barra?.angulo_pitch || '-',
        barra?.profundidade_cm ? `${barra.profundidade_cm} cm` : '-',
        barra?.distancia_pista_cm ? `${barra.distancia_pista_cm} cm` : '-',
        barra?.horario_registro ? new Date(barra.horario_registro).toLocaleTimeString('pt-BR') : '-'
      ];

      const r = sheet.getRow(currentRow);
      r.values = rowData;
      r.alignment = { horizontal: 'center', vertical: 'middle' };
      r.font = { name: 'Arial', size: 9 };
      if (barra) {
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF9F5' : 'FFFFFFFF' } };
      }
      currentRow++;
    }

    // 4. Rodapé e Assinaturas
    currentRow += 1;
    sheet.getCell(`A${currentRow}`).value = `Total de Metros Perfurados: ${totalMetrosPerfurados} MTS (${barras.length} registros)`;
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 11, bold: true, color: { argb: TECNO_ORANGE } };
    currentRow += 2;

    sheet.mergeCells(`A${currentRow}:C${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = '________________________________________\nAssinatura do Navegador';
    sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };

    sheet.mergeCells(`D${currentRow}:F${currentRow}`);
    sheet.getCell(`D${currentRow}`).value = '________________________________________\nAssinatura do Encarregado / Fiscal';
    sheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center' };

    // Largura das colunas
    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 16;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 22;

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Gera o Relatório Fotográfico Oficial em Excel (.xlsx) para um Serviço da TecnoDrill INFRA
   */
  public static async gerarRelatorioFotograficoServico(servicoId: string): Promise<{ buffer: Buffer; filename: string }> {
    const servico = await DBManager.getServicoById(servicoId);
    if (!servico) throw new Error(`Serviço ${servicoId} não encontrado`);

    const furos = await DBManager.getFuros(servicoId);
    let barras: TecnodrillBarra[] = [];
    for (const f of furos) {
      const bList = await DBManager.getBarras(f.id);
      barras = barras.concat(bList);
    }
    barras.sort((a, b) => a.numero_barra - b.numero_barra);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TecnoDrill INFRA - Sistema de Perfuração MND';
    wb.created = new Date();

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

    const colWidths = [3.5, 48, 2.0, 48, 2.0, 48, 3.5];
    wsFotos.columns = colWidths.map(w => ({ width: w }));

    const headerHeights: Record<number, number> = { 1: 12, 2: 44, 3: 24, 4: 26, 5: 24, 6: 10 };
    for (const [r, h] of Object.entries(headerHeights)) {
      wsFotos.getRow(Number(r)).height = h;
    }

    const thickBorder = { style: 'medium' as const, color: { argb: 'FF2C3033' } };
    const thinBorder = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };

    wsFotos.mergeCells('B2:C4');
    wsFotos.mergeCells('D2:F3');
    wsFotos.mergeCells('D4:F4');
    wsFotos.mergeCells('B5:F5');

    // Logo
    try {
      const logoId = wb.addImage({
        base64: TECNODRILL_LOGO_BASE64,
        extension: 'png'
      });
      wsFotos.addImage(logoId, {
        tl: { nativeCol: 1, nativeColOff: 12 * 9525, nativeRow: 1, nativeRowOff: 10 * 9525 },
        ext: { width: 330, height: 105 }
      } as any);
    } catch (_) {}

    ['B2', 'B3', 'B4', 'C2', 'C3', 'C4'].forEach(c => {
      wsFotos.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    });
    wsFotos.getCell('B2').border = { top: thickBorder, left: thickBorder };
    wsFotos.getCell('C2').border = { top: thickBorder, right: thickBorder };
    wsFotos.getCell('B4').border = { bottom: thickBorder, left: thickBorder };
    wsFotos.getCell('C4').border = { bottom: thickBorder, right: thickBorder };

    // Título Principal
    const titleCell = wsFotos.getCell('D2');
    titleCell.value = 'TECNODRILL INFRA • RELATÓRIO FOTOGRÁFICO DE PERFURAÇÃO MND';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ['D2', 'E2', 'F2', 'D3', 'E3', 'F3'].forEach(c => {
      wsFotos.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161B22' } };
    });
    wsFotos.getCell('D2').border = { top: thickBorder, left: thickBorder };
    wsFotos.getCell('F2').border = { top: thickBorder, right: thickBorder };
    wsFotos.getCell('D3').border = { bottom: thinBorder, left: thickBorder };
    wsFotos.getCell('F3').border = { bottom: thinBorder, right: thickBorder };

    // Subtítulo
    const subCell = wsFotos.getCell('D4');
    subCell.value = `SERVIÇO: ${servico.nome.toUpperCase()}   |   CLIENTE: ${(servico.cliente || 'N/A').toUpperCase()}   |   LOCAL: ${(servico.local || 'N/A').toUpperCase()}`;
    subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ['D4', 'E4', 'F4'].forEach(c => {
      wsFotos.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF05A22' } };
    });
    wsFotos.getCell('D4').border = { bottom: thickBorder, left: thickBorder };
    wsFotos.getCell('F4').border = { bottom: thickBorder, right: thickBorder };

    // Extrair Itens Fotográficos
    const itensFotos: Array<{
      b: TecnodrillBarra;
      url: string;
      sub: number;
      total: number;
    }> = [];

    let totalMetros = 0;
    for (const b of barras) {
      const isCaixa = b.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro);
      if (!isCaixa) {
        totalMetros += (b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3);
      }

      const fotosList: string[] = [];
      if (Array.isArray(b.fotos) && b.fotos.length > 0) {
        b.fotos.forEach(f => { if (f && typeof f === 'string' && f.trim()) fotosList.push(f.trim()); });
      }
      if (fotosList.length === 0 && b.foto_url && b.foto_url.trim()) {
        fotosList.push(b.foto_url.trim());
      }

      fotosList.forEach((u, idx) => {
        itensFotos.push({ b, url: u, sub: idx + 1, total: fotosList.length });
      });
    }

    // Linha de Metadados
    const metaCell = wsFotos.getCell('B5');
    metaCell.value = `GESTOR: Carlos / Eduardo   •   NAVEGADOR: ${servico.navegador_nome || 'N/A'}   •   OPERADOR: ${servico.operador_nome || 'N/A'}   •   DIÂMETRO: ${servico.diametro_furo_mm ? `DN ${servico.diametro_furo_mm} mm` : 'DN Variável'}   •   TOTAL: ${itensFotos.length} FOTOS REGISTRADAS (${barras.length} BARRAS)`;
    metaCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ['B5', 'C5', 'D5', 'E5', 'F5'].forEach(c => {
      const cell = wsFotos.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: thickBorder, bottom: thickBorder, left: c === 'B5' ? thickBorder : thinBorder, right: c === 'F5' ? thickBorder : thinBorder };
    });

    // Download Fotos no Backend
    const downloaded: Array<{ item: typeof itensFotos[0]; buffer: Buffer | null; extension: 'jpeg' | 'png' }> = [];
    for (const item of itensFotos) {
      try {
        if (item.url.startsWith('data:image/')) {
          const isPng = item.url.startsWith('data:image/png');
          const base64Data = item.url.split(',')[1];
          downloaded.push({ item, buffer: Buffer.from(base64Data, 'base64'), extension: isPng ? 'png' : 'jpeg' });
        } else {
          let u = item.url;
          if (u.includes('res.cloudinary.com') && u.includes('/upload/') && !u.includes('/upload/w_')) {
            u = u.replace('/upload/', '/upload/w_1024,c_limit,q_auto:good,f_jpg/');
          }
          const res = await fetch(u);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const isPng = u.toLowerCase().endsWith('.png');
            downloaded.push({ item, buffer: buf, extension: isPng ? 'png' : 'jpeg' });
          } else {
            downloaded.push({ item, buffer: null, extension: 'jpeg' });
          }
        }
      } catch (_) {
        downloaded.push({ item, buffer: null, extension: 'jpeg' });
      }
    }

    // Grid de Fotos
    const GRID_COLS = [1, 3, 5];
    const GRID_COL_NUMS = [2, 4, 6];
    let currentRow = 7;

    for (let i = 0; i < downloaded.length; i += 3) {
      const group = downloaded.slice(i, i + 3);
      const photoRow = currentRow;
      const label1Row = currentRow + 1;
      const label2Row = currentRow + 2;
      const spacerRow = currentRow + 3;

      wsFotos.getRow(photoRow).height = 205;
      wsFotos.getRow(label1Row).height = 22;
      wsFotos.getRow(label2Row).height = 32;
      wsFotos.getRow(spacerRow).height = 8;

      for (let gi = 0; gi < group.length; gi++) {
        const { item, buffer, extension } = group[gi];
        const colIdx = GRID_COLS[gi];
        const colNum = GRID_COL_NUMS[gi];

        const photoCell = wsFotos.getCell(photoRow, colNum);
        const label1Cell = wsFotos.getCell(label1Row, colNum);
        const label2Cell = wsFotos.getCell(label2Row, colNum);

        photoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        label1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        label2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        photoCell.border = { top: thickBorder, left: thickBorder, right: thickBorder };
        label1Cell.border = { top: thinBorder, left: thickBorder, right: thickBorder };
        label2Cell.border = { top: thinBorder, left: thickBorder, right: thickBorder, bottom: thickBorder };

        const b = item.b;
        const isCaixa = b.tipo_registro === 'CAIXA' || Boolean(b.tem_caixa && !b.diametro);
        let t1 = isCaixa ? `PONTO DE CAIXA • Nº ${b.numero_barra}` : `BARRA ${String(b.numero_barra).padStart(2, '0')} • ${b.metros || 3} m (Acum: ${b.metros_acumulados} m)`;
        if (item.total > 1) t1 += ` [Foto ${item.sub}/${item.total}]`;

        label1Cell.value = t1;
        label1Cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF161B22' } };
        label1Cell.alignment = { horizontal: 'center', vertical: 'middle' };

        const p1 = `Prof: ${b.profundidade_cm ? `${b.profundidade_cm} cm` : '-'}   |   Pitch: ${b.angulo_pitch || '-'}   |   Diâm: ${b.diametro || (servico.diametro_furo_mm ? `${servico.diametro_furo_mm} mm` : '150 mm')}`;
        const p2 = `${b.endereco || (b.latitude && b.longitude ? `GPS: ${b.latitude.toFixed(6)}, ${b.longitude.toFixed(6)}` : 'Local da Obra')} • ${b.horario_registro ? new Date(b.horario_registro).toLocaleString('pt-BR') : ''}`;
        label2Cell.value = `${p1}
${p2}`;
        label2Cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF475569' } };
        label2Cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        if (buffer) {
          try {
            const imgId = wb.addImage({ buffer: buffer as any, extension });
            wsFotos.addImage(imgId, {
              tl: { nativeCol: colIdx, nativeColOff: 12 * 9525, nativeRow: photoRow - 1, nativeRowOff: 10 * 9525 },
              ext: { width: 320, height: 245 }
            } as any);
          } catch (_) {
            photoCell.value = '[Erro ao carregar imagem]';
            photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        } else {
          photoCell.value = '[Foto não disponível]';
          photoCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }

      currentRow += 4;
    }

    // Resumo e Assinaturas
    currentRow += 1;
    wsFotos.getRow(currentRow).height = 26;
    wsFotos.mergeCells(`B${currentRow}:F${currentRow}`);
    const summaryCell = wsFotos.getCell(`B${currentRow}`);
    summaryCell.value = `METRAGEM TOTAL PERFURADA: ${totalMetros.toLocaleString('pt-BR')} METROS   |   TOTAL DE PONTOS: ${barras.length} BARRAS   |   FOTOS CONSOLIDADAS: ${itensFotos.length} REGISTROS`;
    summaryCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ['B', 'C', 'D', 'E', 'F'].forEach(c => {
      const cell = wsFotos.getCell(`${c}${currentRow}`);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF05A22' } };
      cell.border = { top: thickBorder, bottom: thickBorder, left: thickBorder, right: thickBorder };
    });

    const safeServicoNome = (servico.nome || servico.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = `Relatorio_Fotografico_${safeServicoNome}_${safeDate}.xlsx`;
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    return { buffer, filename };
  }

}
