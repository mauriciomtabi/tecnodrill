import React, { useRef } from 'react';
import { Furo, Barra, Servico } from '../types';
import { ApiService } from '../services/api';
import { Download, Printer, FileSpreadsheet, CheckSquare, Square, ArrowLeft } from 'lucide-react';

interface PhysicalReportPreviewProps {
  furo: Furo;
  servico: Servico;
  barras: Barra[];
  onBack?: () => void;
}

export const PhysicalReportPreview: React.FC<PhysicalReportPreviewProps> = ({
  furo,
  servico,
  barras,
  onBack
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    window.location.href = ApiService.getExcelUrl(furo.id);
  };

  const totalMetros = barras.length * 3;

  // Split into left column (1-35) and right column (36-70)
  const leftSlots = Array.from({ length: 35 }, (_, i) => i + 1);
  const rightSlots = Array.from({ length: 35 }, (_, i) => i + 36);

  const renderCheckbox = (checked: boolean, label: string) => (
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-800">
      {checked ? <CheckSquare className="w-3.5 h-3.5 text-[#F05A22]" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex items-center justify-between gap-3 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="btn-secondary text-xs py-2 px-3">
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)]">
              Relatório de Perfuração - Navigator (Ficha Oficial)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Modelo oficial padronizado para fiscalização e entrega ao cliente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadExcel}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400"
            title="Baixar Planilha Excel"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">Baixar Excel (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Imprimir ou Salvar em PDF"
          >
            <Printer size={16} />
            <span>Imprimir / Gerar PDF</span>
          </button>
        </div>
      </div>

      {/* The Printable Sheet (Exact reproduction of Relatório de Perfuração.jpeg) */}
      <div
        ref={printRef}
        className="bg-white text-black p-6 sm:p-8 rounded-xl shadow-xl border border-gray-300 font-sans leading-tight text-xs print:p-0 print:border-none print:shadow-none"
        style={{ color: '#111827' }}
      >
        {/* Header Section */}
        <div className="border-b-2 border-black pb-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="TecnoDrill" className="h-10 w-auto object-contain" />
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-gray-900 leading-none">
                  Tecno<span className="text-[#F05A22]">Drill</span>
                </span>
                <span className="text-[10px] font-black tracking-widest text-[#F05A22] uppercase">
                  INFRA
                </span>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-base sm:text-lg font-black uppercase text-gray-900 tracking-tight">
                RELATÓRIO DE PERFURAÇÃO - NAVIGATOR
              </h1>
              <span className="text-[10px] text-gray-600 font-bold uppercase">
                Método Não Destrutivo (MND)
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px] border-b border-gray-300 pb-3 mb-3">
          <div>
            <span className="font-bold text-gray-700">Data: </span>
            <span className="font-semibold underline">{furo.data_furo}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-bold text-gray-700">Cliente: </span>
            <span className="font-semibold">{servico.cliente || 'Vale do Ouro'}</span>
          </div>
          <div>
            <span className="font-bold text-gray-700">Projeto: </span>
            <span>{servico.projeto || 'N/A'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-bold text-gray-700">Obra: </span>
            <span>{servico.obra || servico.nome}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-bold text-gray-700">C/C: </span>
            <span>{servico.centro_custo || 'N/A'}</span>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <span className="font-bold text-gray-700">Local: </span>
            <span className="font-semibold">{servico.local}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-bold text-gray-700">Navegador: </span>
            <span className="font-bold text-blue-900">{furo.navegador_nome || 'Navegador'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-bold text-gray-700">Operador: </span>
            <span className="font-bold text-blue-900">{furo.operador_nome || 'Operador'}</span>
          </div>
        </div>

        {/* Horímetros & Detalhes Técnicos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-gray-300 pb-3 mb-3 text-[11px]">
          <div className="flex flex-col gap-1">
            <div><span className="font-bold">Hora Inicial Furo:</span> {furo.hora_inicio_furo || '-'}</div>
            <div><span className="font-bold">Hora Final Furo:</span> {furo.hora_fim_furo || '-'}</div>
            <div><span className="font-bold">Horímetro Furo:</span> {furo.horimetro_inicio_furo || '-'} até {furo.horimetro_fim_furo || '-'}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div><span className="font-bold">Hora Inicial Pux:</span> {furo.hora_inicio_pux || '-'}</div>
            <div><span className="font-bold">Hora Final Pux:</span> {furo.hora_fim_pux || '-'}</div>
            <div><span className="font-bold">Horímetro Pux:</span> {furo.horimetro_inicio_pux || '-'} até {furo.horimetro_fim_pux || '-'}</div>
          </div>
          <div className="flex flex-col gap-1 bg-gray-50 p-2 rounded border border-gray-200">
            <div><span className="font-bold">Tubo Aplicado:</span> {furo.tubo_aplicado || 'PEAD'}</div>
            <div><span className="font-bold">Diâmetro Furo:</span> {furo.diametro_furo || `${servico.diametro_furo_mm} MM`}</div>
            <div><span className="font-bold text-[#F05A22]">Comprimento do Furo:</span> <strong className="text-sm font-black">{totalMetros || furo.comprimento_furo} MTS</strong></div>
          </div>
        </div>

        {/* Checkboxes: Tipo de Perfuração & Utilização */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-gray-300 pb-3 mb-3">
          <div>
            <span className="font-bold text-[11px] block mb-1.5 text-gray-800">Tipo de Perfuração:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {renderCheckbox(furo.tipo_perfuracao?.includes('Ferrovia') || false, 'Ferrovia')}
              {renderCheckbox(furo.tipo_perfuracao?.includes('Rio') || false, 'Rio')}
              {renderCheckbox(furo.tipo_perfuracao?.includes('Calçada') || false, 'Calçada')}
              {renderCheckbox(furo.tipo_perfuracao?.includes('Rodovia') || false, 'Rodovia')}
              {renderCheckbox(furo.tipo_perfuracao?.includes('Ruas/Av') || true, 'Ruas/Av')}
              {renderCheckbox(furo.tipo_perfuracao?.includes('Outros') || false, 'Outros')}
            </div>
          </div>
          <div>
            <span className="font-bold text-[11px] block mb-1.5 text-gray-800">Utilização do Tubo:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {renderCheckbox(furo.utilizacao_tubo?.includes('Gás') || false, 'Gás')}
              {renderCheckbox(furo.utilizacao_tubo?.includes('Água') || false, 'Água')}
              {renderCheckbox(furo.utilizacao_tubo?.includes('Esgoto') || true, 'Esgoto')}
              {renderCheckbox(furo.utilizacao_tubo?.includes('Energia') || false, 'Energia')}
              {renderCheckbox(furo.utilizacao_tubo?.includes('Telecom') || false, 'Telecom')}
              {renderCheckbox(furo.utilizacao_tubo?.includes('Outros') || false, 'Outros')}
            </div>
          </div>
        </div>

        {/* 70 Barras Grid (Two parallel columns 1-35 and 36-70) */}
        <div className="grid grid-cols-2 gap-2 text-[10px] mb-4">
          {/* Left Table: 1 to 35 */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-200 font-bold text-center border-b border-gray-400">
                <th className="border-r border-gray-400 p-1 w-8">Nº</th>
                <th className="border-r border-gray-400 p-1 w-10">MTS</th>
                <th className="border-r border-gray-400 p-1">Ângulo</th>
                <th className="border-r border-gray-400 p-1">Profundidade</th>
                <th className="p-1">Dist. Pista</th>
              </tr>
            </thead>
            <tbody>
              {leftSlots.map(n => {
                const b = barras.find(x => x.numero_barra === n);
                return (
                  <tr key={n} className={`text-center border-b border-gray-200 ${b ? 'bg-orange-50/50 font-semibold' : ''}`}>
                    <td className="border-r border-gray-400 p-0.5">{n}</td>
                    <td className="border-r border-gray-400 p-0.5">{n * 3}</td>
                    <td className="border-r border-gray-400 p-0.5 font-mono">{b?.angulo_pitch || ''}</td>
                    <td className="border-r border-gray-400 p-0.5 font-bold text-blue-900">{b?.profundidade_cm ? `${b.profundidade_cm} cm` : ''}</td>
                    <td className="p-0.5">{b?.distancia_pista_cm ? `${b.distancia_pista_cm}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Right Table: 36 to 70 */}
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-200 font-bold text-center border-b border-gray-400">
                <th className="border-r border-gray-400 p-1 w-8">Nº</th>
                <th className="border-r border-gray-400 p-1 w-10">MTS</th>
                <th className="border-r border-gray-400 p-1">Ângulo</th>
                <th className="border-r border-gray-400 p-1">Profundidade</th>
                <th className="p-1">Dist. Pista</th>
              </tr>
            </thead>
            <tbody>
              {rightSlots.map(n => {
                const b = barras.find(x => x.numero_barra === n);
                return (
                  <tr key={n} className={`text-center border-b border-gray-200 ${b ? 'bg-orange-50/50 font-semibold' : ''}`}>
                    <td className="border-r border-gray-400 p-0.5">{n}</td>
                    <td className="border-r border-gray-400 p-0.5">{n * 3}</td>
                    <td className="border-r border-gray-400 p-0.5 font-mono">{b?.angulo_pitch || ''}</td>
                    <td className="border-r border-gray-400 p-0.5 font-bold text-blue-900">{b?.profundidade_cm ? `${b.profundidade_cm} cm` : ''}</td>
                    <td className="p-0.5">{b?.distancia_pista_cm ? `${b.distancia_pista_cm}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Total Callout Box */}
        <div className="flex items-center justify-between border-2 border-gray-800 p-2.5 rounded mb-6 bg-gray-50">
          <span className="font-bold uppercase text-xs">Metragem Total Executada:</span>
          <span className="text-xl font-black text-blue-950 tracking-wider">
            TOTAL {totalMetros} MTS ({barras.length} Barras)
          </span>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-400 text-center">
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-1 h-8 flex items-end justify-center pb-1">
              <span className="font-bold text-xs italic text-blue-900">{furo.navegador_nome || 'Navegador'}</span>
            </div>
            <span className="text-[11px] font-bold text-gray-700 uppercase">Assinatura do Navegador</span>
          </div>

          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-1 h-8 flex items-end justify-center pb-1">
              <span className="text-[10px] text-gray-400 italic">Visto / Assinatura</span>
            </div>
            <span className="text-[11px] font-bold text-gray-700 uppercase">Encarregado / Fiscal da Obra</span>
          </div>
        </div>
      </div>
    </div>
  );
};
