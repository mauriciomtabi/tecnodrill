import React, { useState, useEffect } from 'react';
import { Furo, Servico, Barra } from '../types';
import { ApiService } from '../services/api';
import { PhysicalReportPreview } from '../components/PhysicalReportPreview';
import { FileSpreadsheet, HardHat, Printer, ArrowLeft } from 'lucide-react';

interface RelatorioFuroPageProps {
  furoIdProp?: string;
  onBack?: () => void;
}

export const RelatorioFuroPage: React.FC<RelatorioFuroPageProps> = ({ furoIdProp, onBack }) => {
  const [furos, setFuros] = useState<Furo[]>([]);
  const [selectedFuroId, setSelectedFuroId] = useState<string>(furoIdProp || '');
  const [furoData, setFuroData] = useState<Furo | null>(null);
  const [servicoData, setServicoData] = useState<Servico | null>(null);
  const [barrasData, setBarrasData] = useState<Barra[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFuros = async () => {
    try {
      setLoading(true);
      const list = await ApiService.getFuros();
      setFuros(list);

      const targetId = furoIdProp || (list.length > 0 ? list[0].id : '');
      if (targetId) {
        setSelectedFuroId(targetId);
        await loadFuroDetails(targetId);
      }
    } catch (err) {
      console.error('Erro ao buscar furos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFuroDetails = async (id: string) => {
    try {
      const furo = await ApiService.getFuro(id);
      setFuroData(furo);
      if (furo.servico) {
        setServicoData(furo.servico);
      } else {
        const serv = await ApiService.getServico(furo.servico_id);
        setServicoData(serv);
      }
      const barras = await ApiService.getBarras(id);
      setBarrasData(barras);
    } catch (err) {
      console.error('Erro ao carregar detalhes do furo:', err);
    }
  };

  useEffect(() => {
    fetchFuros();
  }, [furoIdProp]);

  const handleSelectFuro = async (id: string) => {
    setSelectedFuroId(id);
    setLoading(true);
    await loadFuroDetails(id);
    setLoading(false);
  };

  if (loading && !furoData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#F05A22] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-12">
      {/* Selector Bar */}
      <div className="no-print card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F05A22]/20 border border-[#F05A22]/40 flex items-center justify-center text-[#F05A22]">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase block">
              Selecionar Furo / Ficha de Campo:
            </span>
            <select
              value={selectedFuroId}
              onChange={(e) => handleSelectFuro(e.target.value)}
              className="font-bold text-sm bg-transparent border-none p-0 cursor-pointer text-[var(--text-main)] focus:ring-0"
            >
              {furos.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#1F2730] text-white">
                  Furo {f.data_furo} - {f.tubo_aplicado || 'PEAD'} ({f.comprimento_furo}m)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sheet Preview */}
      {furoData && servicoData && (
        <PhysicalReportPreview
          furo={furoData}
          servico={servicoData}
          barras={barrasData}
          onBack={onBack}
        />
      )}
    </div>
  );
};
