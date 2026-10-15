const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function apiFor(results) {
  const calls = [];
  const supabase = { from(table) {
    const result = results.shift();
    assert.ok(result, `Unexpected query: ${table}`);
    const q = {
      select() { return q; }, eq() { return q; },
      insert(payload) { calls.push({ table, payload }); return q; },
      single: async () => result,
      then(resolve) { resolve(result); }
    };
    return q;
  }};
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(require('node:path').join(__dirname, '../src/services/api.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name.includes('supabaseClient') ? { supabase } : {},
    localStorage: { getItem: () => null }, console: { error() {}, warn() {} },
    Date, JSON
  });
  return { api: module.exports.ApiService, calls };
}
test('work creation persists the work and its initial team borehole', async () => {
  const { api, calls } = apiFor([{ data: [] }, { data: { id: 'TD-01' } }, { error: null }]);
  const created = await api.createServico({ nome: 'Obra', navegador_id: 'nav', operador_id: 'op' });
  assert.equal(created.id, 'TD-01');
  assert.equal(calls[1].payload.navegador_id, 'nav');
  assert.equal(calls[1].payload.operador_id, 'op');
});
test('work save failure is surfaced rather than returning a fictitious work', async () => {
  const { api } = apiFor([{ data: [] }, { error: { code: '42501' } }]);
  await assert.rejects(api.createServico({ nome: 'Obra' }), /salvar a obra/);
});
test('initial borehole failure reports the saved work and prevents a success message', async () => {
  const { api } = apiFor([{ data: [] }, { data: { id: 'TD-01' } }, { error: { code: '23503' } }]);
  await assert.rejects(api.createServico({ nome: 'Obra' }), /obra foi salva/);
});
test('payment persistence failure never returns a successful payment', async () => {
  const { api } = apiFor([{ error: { code: '42501' } }]);
  await assert.rejects(api.createTerceiroLancamento({ terceiro: 'Teste', valor: 10 }), /salvar o lançamento/);
});
test('successful payment returns the persisted business identifier', async () => {
  const { api } = apiFor([{ data: { id: 'database-log-id' } }]);
  assert.equal((await api.createTerceiroLancamento({ id: 'TERC-test', valor: 10 })).id, 'TERC-test');
});
