import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Area, AreaChart } from 'recharts';
import { Barra } from '../types';

interface DrillProfileChartProps {
  barras: Barra[];
  tuboNome?: string;
  diametroMm?: number;
}

export const DrillProfileChart: React.FC<DrillProfileChartProps> = ({ barras, tuboNome, diametroMm }) => {
  if (!barras || barras.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-400">
        <p>Nenhuma haste lançada ainda para traçar o perfil topográfico da perfuração.</p>
      </div>
    );
  }

  // Preparar dados ordenados
  const chartData = [
    { metros: 0, profundidade: 0, profundidadeExibida: 0, angulo: '+0.00', barra: 0 },
    ...barras.map(b => ({
      metros: b.metros_acumulados,
      profundidade: b.profundidade_cm || 0,
      profundidadeExibida: -(b.profundidade_cm || 0), // Negativo para desenhar para baixo da superfície
      angulo: b.angulo_pitch || '+0.00',
      barra: b.numero_barra
    }))
  ];

  const maxProfundidade = Math.max(...barras.map(b => b.profundidade_cm || 0), 200);

  return (
    <div className="card p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>Perfil Topográfico Subterrâneo (MND / HDD)</span>
            <span className="badge badge-primary text-[10px]">Tempo Real</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Traçado do furo piloto em profundidade (cm) ao longo dos metros perfurados
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#F05A22]" />
            <span>Trajetória da Sonda</span>
          </div>
          {tuboNome && (
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
              <span>Tubo: {tuboNome} {diametroMm ? `(${diametroMm}mm)` : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="drillGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F05A22" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F05A22" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="metros"
              unit="m"
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              label={{ value: 'Distância Perfurada (Metros)', position: 'insideBottom', offset: -12, fill: '#64748B', fontSize: 11 }}
            />
            <YAxis
              domain={[-maxProfundidade - 30, 20]}
              tickFormatter={(val) => `${Math.abs(val)}cm`}
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              label={{ value: 'Profundidade', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={2} label={{ value: 'Superfície / Solo (0cm)', fill: '#94A3B8', fontSize: 10, position: 'insideTopRight' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#1F2730] border border-white/10 p-3 rounded-xl shadow-xl text-xs flex flex-col gap-1">
                      <span className="font-bold text-[#F05A22]">
                        {data.barra > 0 ? `Barra Nº ${data.barra} (${data.metros}m)` : 'Ponto de Entrada (0m)'}
                      </span>
                      <span className="text-gray-200">
                        Profundidade: <strong className="text-white">{data.profundidade} cm</strong> ({((data.profundidade || 0) / 100).toFixed(2)}m)
                      </span>
                      <span className="text-gray-300">
                        Ângulo / Pitch: <strong className="text-yellow-400">{data.angulo}</strong>
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="profundidadeExibida"
              stroke="#F05A22"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#drillGradient)"
              dot={{ r: 4, fill: '#F05A22', stroke: '#FFFFFF', strokeWidth: 1.5 }}
              activeDot={{ r: 7, fill: '#FF7744', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
