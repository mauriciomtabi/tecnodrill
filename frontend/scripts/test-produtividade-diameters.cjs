const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformSync } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(name) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, `../src/pages/${name}.ts`), 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module, exports: module.exports, require: () => load('produtividadeAuthors') });
  return module.exports;
}
const { summarizeDiameterRevenue } = load('produtividadeDiameters');
const service = { id: 'TD-test', receitaPeriodo: 600, cenario_financeiro: 'FATOR_DIAMETRO_METRO', custo_metro: 0.5 };
test('diameter drilldown merges equivalent labels, sorts numerically and reconciles revenue and costs', () => {
  const result = summarizeDiameterRevenue(service, [
    { diametro: '150mm', metros: 10 }, { diametro: 'Ø 150 mm', metros: 10 }, { diametro: '300', metros: 10 }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, '150');
  assert.equal(result[0].registros, 2);
  assert.equal(result[0].metros, 20);
  assert.equal(result[0].receita, 300);
  assert.equal(result[1].receita, 300);
  assert.equal(result.reduce((sum, item) => sum + item.custo, 0), 30);
});
test('boxes and missing diameter are explicit and never invent production', () => {
  const result = summarizeDiameterRevenue({ ...service, receitaPeriodo: 100, cenario_financeiro: 'VALOR_METRO' }, [
    { metros: 5 }, { tipo_registro: 'CAIXA', metros: 99, diametro: '150mm' }
  ]);
  assert.equal(result.find(x => x.id === 'SEM_DIAMETRO').receita, 100);
  assert.equal(result.find(x => x.id === 'CAIXAS').metros, 0);
  assert.equal(result.find(x => x.id === 'CAIXAS').receita, 0);
  assert.equal(summarizeDiameterRevenue(service, []).length, 0);
});
test('fixed-price revenue follows meters from the selected rows only', () => {
  const result = summarizeDiameterRevenue({ ...service, receitaPeriodo: 75, cenario_financeiro: 'VALOR_FECHADO' }, [{ diametro: '200mm', metros: 3 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].receita, 75);
});
