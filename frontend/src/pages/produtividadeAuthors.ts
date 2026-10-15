import type { Servico, Barra } from '../types';

// Reference dates are calendar dates; timestamps use the operation's time zone.
function workDate(b: Barra): string | null {
  let reference = b.data_referencia;
  if (!reference && b.observacao) {
    const tag = b.observacao.match(/<!--BARRA_META:(.*?)-->/);
    try { reference = tag ? JSON.parse(tag[1]).data_referencia : undefined; } catch { /* Invalid legacy metadata. */ }
  }
  const raw = reference || b.horario_registro || b.data_registro || b.created_at;
  if (!raw) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (dateOnly) {
    const parsed = new Date(`${raw}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
}

export function summarizeAuthorRevenue(servicos: Array<Servico & { receitaPeriodo: number }>, barrasPorServico: Record<string, Barra[]>, inPeriod: (b: Barra) => boolean, autores: Array<{ id: string; nome: string }>) {
    const grupos = new Map<string, { id: string; nome: string; metros: number; receita: number; registros: number; servicos: Set<string>; dias: Set<string>; registrosSemData: number }>();
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
        const grupo = grupos.get(id) || { id, nome: autores.find(t => t.id === id)?.nome || 'Sem autor identificado', metros: 0, receita: 0, registros: 0, servicos: new Set<string>(), dias: new Set<string>(), registrosSemData: 0 };
        grupo.metros += metros;
        grupo.receita += pesoTotal > 0 ? s.receitaPeriodo * peso / pesoTotal : 0;
        grupo.registros++;
        const dia = workDate(b);
        if (dia) grupo.dias.add(dia);
        else grupo.registrosSemData++;
        grupo.servicos.add(s.id);
        grupos.set(id, grupo);
      });
    });
    return [...grupos.values()].map(grupo => ({ ...grupo, diasTrabalhados: grupo.dias.size, mediaDiaria: grupo.dias.size > 0 && grupo.registrosSemData === 0 ? grupo.metros / grupo.dias.size : null })).sort((a, b) => b.receita - a.receita);
}
