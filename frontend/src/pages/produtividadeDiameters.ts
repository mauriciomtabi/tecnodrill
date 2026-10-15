import type { Barra, Servico } from '../types';
import { summarizeAuthorRevenue } from './produtividadeAuthors';

export function summarizeDiameterRevenue(servico: Servico & { receitaPeriodo: number }, barras: Barra[]) {
  const labels = new Map<string, string>();
  const grouped = barras.map(b => {
    const caixa = b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro);
    const valor = Number(String(b.diametro || '').match(/\d+(?:[.,]\d+)?/)?.[0].replace(',', '.'));
    const id = caixa ? 'CAIXAS' : valor > 0 ? String(valor) : 'SEM_DIAMETRO';
    labels.set(id, caixa ? 'Caixas' : valor > 0 ? `Ø ${valor.toLocaleString('pt-BR')} mm` : 'Diâmetro não informado');
    return { ...b, registrado_por: id };
  });
  return summarizeAuthorRevenue([servico], { [servico.id]: grouped }, () => true,
    [...labels].map(([id, nome]) => ({ id, nome })))
    .map(item => ({ ...item, custo: item.metros * (Number(servico.custo_metro) || 0) * 2 }))
    .sort((a, b) => (Number(a.id) || Infinity) - (Number(b.id) || Infinity) || a.nome.localeCompare(b.nome));
}
