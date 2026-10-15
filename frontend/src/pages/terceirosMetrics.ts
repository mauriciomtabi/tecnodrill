import type { Barra, Furo, TerceiroLancamento } from '../types';

export function mesDaProducao(barra: Barra): string {
  return barra.mes_referencia || (barra.data_referencia || barra.data_registro || barra.horario_registro || '').slice(0, 7);
}

export async function carregarProducao(api: {
  getFuros: () => Promise<Furo[]>;
  getBarras: (id: string) => Promise<Barra[]>;
}): Promise<Barra[]> {
  const furos = await api.getFuros();
  const registros: Barra[] = [];
  // Limit concurrent requests while including every borehole, not just the first.
  for (let i = 0; i < furos.length; i += 6) {
    const grupos = await Promise.all(furos.slice(i, i + 6).map(async furo => {
      const barras = await api.getBarras(furo.id);
      return barras.map(barra => ({ ...barra, data_registro: barra.data_registro || barra.horario_registro || furo.data_furo }));
    }));
    registros.push(...grupos.flat());
  }
  return Array.from(new Map(registros.map(barra => [barra.id, barra])).values());
}

export function evolucaoTerceiros(lancamentos: TerceiroLancamento[], barras: Barra[], ano: string, mes: string) {
  const meses = new Map<string, { key: string; mes: string; custo: number; metros: number }>();
  const obter = (key: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || (ano !== 'TODOS' && !key.startsWith(ano + '-')) || (mes !== 'TODOS' && key !== mes)) return;
    if (!meses.has(key)) meses.set(key, {
      key,
      mes: new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      custo: 0, metros: 0
    });
    return meses.get(key)!;
  };
  lancamentos.forEach(item => {
    const registro = obter(item.mes_referencia || item.data?.slice(0, 7) || '');
    if (registro) registro.custo += Number(item.valor) || 0;
  });
  barras.forEach(barra => {
    if (barra.tipo_registro === 'CAIXA') return;
    const registro = obter(mesDaProducao(barra));
    if (registro) registro.metros += Number(barra.metros) || 0;
  });
  return [...meses.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function paginarLancamentos<T>(registros: T[], pagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(registros.length / 20));
  const paginaAtual = Math.max(1, Math.min(pagina, totalPaginas));
  const inicio = (paginaAtual - 1) * 20;
  return { paginaAtual, totalPaginas, inicio, itens: registros.slice(inicio, inicio + 20) };
}
