const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const moduleOutput = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/pages/produtividadeAuthors.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code,
  { module: moduleOutput, exports: moduleOutput.exports });
const { summarizeAuthorRevenue } = moduleOutput.exports;
const authors = [{ id: 'a', nome: 'Mesmo nome' }, { id: 'b', nome: 'Mesmo nome' }];
const rows = [
  { registrado_por: 'a', metros: 10, diametro: '100mm' },
  { registrado_por: 'b', metros: 20, diametro: '200mm' },
  { registrado_por: 'a', metros: 99, tipo_registro: 'CAIXA' }
];
test('author identity uses IDs and revenue is counted once; boxes do not add meters', () => {
  const result = summarizeAuthorRevenue([{ id: 'S1', receitaPeriodo: 300, cenario_financeiro: 'VALOR_METRO' }], { S1: rows }, () => true, authors);
  assert.equal(result.length, 2);
  assert.equal(result.find(x => x.id === 'a').receita, 100);
  assert.equal(result.find(x => x.id === 'b').receita, 200);
  assert.equal(result.reduce((sum, x) => sum + x.metros, 0), 30);
  assert.equal(result.reduce((sum, x) => sum + x.receita, 0), 300);
});
test('diameter scenario attributes revenue using each record diameter', () => {
  const result = summarizeAuthorRevenue([{ id: 'S1', receitaPeriodo: 500, cenario_financeiro: 'FATOR_DIAMETRO_METRO' }], { S1: rows }, () => true, authors);
  assert.equal(result.find(x => x.id === 'a').receita, 100);
  assert.equal(result.find(x => x.id === 'b').receita, 400);
});
test('service and period selection exclude unrelated authors; missing author remains explicit', () => {
  const result = summarizeAuthorRevenue([{ id: 'S2', receitaPeriodo: 50, cenario_financeiro: 'VALOR_FECHADO' }],
    { S1: rows, S2: [{ metros: 5, selected: true }, { registrado_por: 'b', metros: 8 }] }, b => b.selected === true, authors);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'SEM_AUTOR');
  assert.equal(result[0].receita, 50);
  assert.equal(result[0].servicos.size, 1);
});
test('empty period has no fabricated revenue', () => {
  assert.equal(summarizeAuthorRevenue([{ id: 'S1', receitaPeriodo: 0 }], { S1: rows }, () => false, authors).length, 0);
});

test('worked days deduplicate across services and include box-only days', () => {
  const result = summarizeAuthorRevenue([
    { id: 'S1', receitaPeriodo: 100 }, { id: 'S2', receitaPeriodo: 200 }
  ], {
    S1: [{ registrado_por: 'a', metros: 10, data_referencia: '2026-10-06' },
         { registrado_por: 'a', metros: 20, data_referencia: '2026-10-06' },
         { registrado_por: 'a', tipo_registro: 'CAIXA', data_referencia: '2026-10-07' }],
    S2: [{ registrado_por: 'a', metros: 30, data_referencia: '2026-10-06' }]
  }, () => true, authors);
  assert.equal(result[0].diasTrabalhados, 2);
  assert.equal(result[0].mediaDiaria, 30);
});
test('daily average respects reference metadata and Sao Paulo calendar dates', () => {
  const result = summarizeAuthorRevenue([{ id: 'S1', receitaPeriodo: 0 }], { S1: [
    { registrado_por: 'a', metros: 10, horario_registro: '2026-10-07T01:00:00Z' },
    { registrado_por: 'a', metros: 20, observacao: '<!--BARRA_META:{"data_referencia":"2026-10-06"}-->' },
    { registrado_por: 'a', metros: 30, data_referencia: '2026-10-08', horario_registro: '2026-10-07T01:00:00Z' }
  ] }, () => true, authors);
  assert.equal(result[0].diasTrabalhados, 2);
  assert.equal(result[0].mediaDiaria, 30);
});
test('missing or invalid calendar dates do not invent days or inflate the average', () => {
  const result = summarizeAuthorRevenue([{ id: 'S1', receitaPeriodo: 0 }], { S1: [
    { registrado_por: 'a', metros: 10, data_referencia: '2026-02-30' },
    { registrado_por: 'a', metros: 20, mes_referencia: '2026-10' },
    { registrado_por: 'a', metros: 30, data_referencia: '2026-10-06' }
  ] }, () => true, authors);
  assert.equal(result[0].diasTrabalhados, 1);
  assert.equal(result[0].registrosSemData, 2);
  assert.equal(result[0].mediaDiaria, null);
});
