import ExcelJS from 'exceljs';
import { DBManager, TecnodrillFuro, TecnodrillBarra, TecnodrillServico } from '../database/db';

export class ExportService {
  /**
   * Gera uma planilha Excel formatada exatamente como o Relatório de Perfuração - Navigator da TecnoDrill INFRA
   */
  public static async gerarExcelFuro(furoId: string): Promise<Buffer> {
    const furo = await DBManager.getFuroById(furoId);
    if (!furo) throw new Error('Furo não encontrado');

    const servico = await DBManager.getServicoById(furo.servico_id);
    const barras = await DBManager.getBarras(furoId);

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
      ['Tubo Aplicado:', furo.tubo_aplicado || 'N/A', 'Diâmetro do Furo:', furo.diametro_furo || `${servico?.diametro_furo_mm || ''} mm`, 'Comprimento Total:', `${furo.comprimento_furo || (barras.length * 3)} MTS`],
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
      currentRow++;
    });

    currentRow += 1;

    // 3. Tabela de Barras (2 Colunas Paralelas como na ficha física)
    // Tabela 1: Barras 1 a 35 (Esq) | Tabela 2: Barras 36 a 70 (Dir)
    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const tableHeader1 = sheet.getCell(`A${currentRow}`);
    tableHeader1.value = 'APONTAMENTO DE HASTES / SONDAGEM (CADA HASTE = 3 METROS)';
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
      const rowData = [
        i,
        `${i * 3} m`,
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
    sheet.getCell(`A${currentRow}`).value = `Total de Metros Perfurados: ${barras.length * 3} MTS (${barras.length} barras)`;
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
}
