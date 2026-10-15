const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregarProducao, evolucaoTerceiros, mesDaProducao, paginarLancamentos } = require('../src/pages/terceirosMetrics.ts');

test('production includes every borehole and falls back to the borehole date', async () => {
  const calls = [];
  const barras = await carregarProducao({
    getFuros: async () => Array.from({ length: 8 }, (_, i) => ({ id: String(i), data_furo: '2026-10-01' })),
    getBarras: async id => { calls.push(id); return [{ id, metros: 3 }]; }
  });
  assert.equal(calls.length, 8);
  assert.equal(barras.reduce((total, barra) => total + barra.metros, 0), 24);
  assert.equal(mesDaProducao(barras[7]), '2026-10');
});

test('evolution respects reference month and includes production outside the old March–September window', () => {
  const pagamentos = [{ mes_referencia: '2026-10', valor: 1234.56 }];
  const barras = [
    { id: '1', tipo_registro: 'CANALIZACAO', tem_caixa: true, metros: 9, horario_registro: '2026-10-15' },
    { id: '2', tipo_registro: 'CAIXA', metros: 50, horario_registro: '2026-10-15' },
    { id: '3', metros: 6, mes_referencia: '2026-11', horario_registro: '2026-10-15' },
    { id: '4', metros: 12, data_referencia: '2025-10-01' }
  ];
  const resultado = evolucaoTerceiros(pagamentos, barras, '2026', 'TODOS');
  assert.deepEqual(resultado.map(({ key, custo, metros }) => ({ key, custo, metros })), [
    { key: '2026-10', custo: 1234.56, metros: 9 },
    { key: '2026-11', custo: 0, metros: 6 }
  ]);
  assert.equal(evolucaoTerceiros(pagamentos, barras, '2026', '2026-11').length, 1);
  assert.equal(mesDaProducao({ data_registro: '2026-12-01' }), '2026-12');
});

test('pagination displays 20, 20 and 13 records, clamps after removal and handles no results', () => {
  const registros = Array.from({ length: 53 }, (_, i) => i);
  assert.equal(paginarLancamentos(registros, 1).itens.length, 20);
  assert.equal(paginarLancamentos(registros, 2).itens[0], 20);
  assert.equal(paginarLancamentos(registros, 3).itens.length, 13);
  assert.equal(paginarLancamentos(registros.slice(0, 20), 3).paginaAtual, 1);
  assert.deepEqual(paginarLancamentos([], 2), { paginaAtual: 1, totalPaginas: 1, inicio: 0, itens: [] });
});
