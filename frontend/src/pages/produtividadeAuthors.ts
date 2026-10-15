import type { Servico, Barra } from '../types';

export function summarizeAuthorRevenue(servicos: Array<Servico & { receitaPeriodo: number }>, barrasPorServico: Record<string, Barra[]>, inPeriod: (b: Barra) => boolean, autores: Array<{ id: string; nome: string }>) {
    const grupos = new Map<string, { id: string; nome: string; metros: number; receita: number; registros: number; servicos: Set<string> }>();
    servicos.forEach(s => {
      const registros = (barrasPorServico[s.id] || []).filter(inPeriod);
      const pesos = registros.map(b => {
        const metros = b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro) ? 0 : Number(b.metros ?? 3);
        const diametro = parseFloat(String(b.diametro || '').replace(/[^\d.]/g, '')) || Number(s.diametro_furo_mm) || 150;
        return { b, metros, peso: s.cenario_financeiro === 'FATOR_DIAMETRO_METRO' ? (b.tem_caixa ? 0 : metros * diametro) : metros };
      });
      if (!pesos.some(item => item.peso > 0)) pesos.forEach(item => { item.peso = item.metros; });
      const pesoTotal = pesos.reduce((total, item) => total + item.peso, 0);
      pesos.forEach(({ b, metros, peso }) => {
        const id = b.registrado_por || 'SEM_AUTOR';
        const grupo = grupos.get(id) || { id, nome: autores.find(t => t.id === id)?.nome || 'Sem autor identificado', metros: 0, receita: 0, registros: 0, servicos: new Set<string>() };
        grupo.metros += metros;
        grupo.receita += pesoTotal > 0 ? s.receitaPeriodo * peso / pesoTotal : 0;
        grupo.registros++;
        grupo.servicos.add(s.id);
        grupos.set(id, grupo);
      });
    });
    return [...grupos.values()].sort((a, b) => b.receita - a.receita);
}
