const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function handlerForTest(options = {}) {
  const writes = [];
  let handler;
  const profile = { id: '11111111-1111-4111-8111-111111111111', nome: 'Teste', username: 'teste', perfil: 'OPERADOR', ativo: true, senha_hash: 'PRIVATE_TEST_HASH' };
  const admin = {
    auth: {
      getUser: async token => ({ data: { user: token === 'verified-op' || token === 'verified-admin' ? { id: token } : null }, error: null }),
      admin: { createUser: async input => { writes.push(input); return { data: { user: { id: input.id } }, error: null }; }, deleteUser: async () => ({ error: null }), getUserById: async () => ({ data: { user: { id: profile.id } } }) }
    },
    from: () => {
      let columns; let id;
      const q = {
        insert(value) { writes.push(value); return q; },
        then(resolve) { resolve({ data: options.duplicate ? [{ id: profile.id }] : [], error: null }); },
        select(value) { columns = value; return q; },
        ilike() { return q; },
        eq(_column, value) { id = value; return q; },
        maybeSingle: async () => ({ data: profile }),
        single: async () => ({ data: columns === 'id,perfil,ativo' ? { id, perfil: id === 'verified-admin' ? 'ADMIN' : 'OPERADOR', ativo: true } : Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'senha_hash')) })
      };
      return q;
    }
  };
  const client = {
    auth: { signInWithPassword: async ({ password }) => password === 'correct-test-password'
      ? { data: { session: { access_token: 'verified-session', refresh_token: 'refresh' } }, error: null }
      : { data: {}, error: new Error('Invalid password') } }
  };
  const source = fs.readFileSync(path.join(__dirname, '../../supabase/functions/tecnodrill-auth/index.ts'), 'utf8');
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(code, {
    require: () => ({ createClient: (_url, key) => key === 'SERVICE_TEST_ONLY' ? admin : client }),
    Deno: { env: { get: key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'SERVICE_TEST_ONLY' : 'PUBLIC_TEST_ONLY' }, serve: fn => { handler = fn; } },
    Request, Response, crypto, console, module: { exports: {} }, exports: {}
  });
  handler.writes = writes;
  return handler;
}
const handler = handlerForTest();
const call = (body, token = '') => handler(new Request('https://example.invalid/tecnodrill-auth', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));

test('management rejects missing, invalid and legacy unsigned tokens', async () => {
  for (const token of ['', 'invalid', 'td_token_someone_123']) {
    assert.equal((await call({ action: 'update', id: 'target', data: { perfil: 'ADMIN' } }, token)).status, 401);
  }
});
test('operator cannot become manager by changing a request field', async () => {
  const response = await call({ action: 'create', perfil: 'ADMIN', data: { perfil: 'ADMIN' } }, 'verified-op');
  assert.equal(response.status, 403);
});
test('password is actually verified by Auth; success does not expose the legacy hash', async () => {
  assert.equal((await call({ action: 'login', identifier: 'teste', password: 'wrong-test-password' })).status, 401);
  const response = await call({ action: 'login', identifier: 'teste', password: 'correct-test-password' });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.equal(body.includes('senha_hash'), false);
  assert.equal(body.includes('PRIVATE_TEST_HASH'), false);
});
test('empty login, unsupported methods and invalid actions are rejected', async () => {
  assert.equal((await call({ action: 'login', identifier: '', password: '' })).status, 401);
  assert.equal((await handler(new Request('https://example.invalid'))).status, 405);
  assert.equal((await call({ action: 'arbitrary-sql' }, 'verified-admin')).status, 400);
});

test('manager creates a user and normalizes an optional blank email', async () => {
  const create = handlerForTest();
  const response = await create(new Request('https://example.invalid', {
    method: 'POST', headers: { authorization: 'Bearer verified-admin' },
    body: JSON.stringify({ action: 'create', data: { nome: ' New User ', username: ' new.login ', email: '', perfil: 'OPERADOR', senha: 'test-password' } })
  }));
  assert.equal(response.status, 200);
  assert.equal(create.writes.length, 2);
  assert.equal(create.writes[1].email, null);
  assert.equal(create.writes[1].username, 'new.login');
  assert.equal(create.writes[0].id, create.writes[1].id);
  assert.equal((await response.text()).includes('senha_hash'), false);
});
test('duplicate login returns conflict before provisioning Auth', async () => {
  const create = handlerForTest({ duplicate: true });
  const response = await create(new Request('https://example.invalid', {
    method: 'POST', headers: { authorization: 'Bearer verified-admin' },
    body: JSON.stringify({ action: 'create', data: { nome: 'Existing', username: 'teste', perfil: 'OPERADOR', senha: 'test-password' } })
  }));
  assert.equal(response.status, 409);
  assert.equal(create.writes.length, 0);
});
