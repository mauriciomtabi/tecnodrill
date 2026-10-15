const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { canReadRegistro } = require('../src/services/registroAccess.ts');

const op = '11111111-1111-4111-8111-111111111111';
const nav = '22222222-2222-4222-8222-222222222222';
const gestor = '44444444-4444-4444-8444-444444444444';
const inativo = '66666666-6666-4666-8666-666666666666';
const furo = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const barraOp = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const barraNav = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const prefix = 'https://dkscchjzztwyjzjpllob.supabase.co/storage/v1/object/public/tecnodrill-fotos/';

test('UI uses author ID even when names or metadata match another user', () => {
  for (const perfil of ['OPERADOR', 'NAVEGADOR']) {
    const user = { id: op, nome: 'Mesmo Nome', username: 'mesmo.nome', perfil, ativo: true };
    assert.equal(canReadRegistro(user, { registrado_por: op }), true);
    assert.equal(canReadRegistro(user, { registrado_por: nav, registrado_por_nome: 'Mesmo Nome', observacao: `<!--BARRA_META:{"registrado_por_id":"${op}"}-->` }), false);
    assert.equal(canReadRegistro(user, {}), false);
    assert.equal(canReadRegistro({ ...user, ativo: false }, { registrado_por: op }), false);
  }
  assert.equal(canReadRegistro(null, { registrado_por: op }), false);
  assert.equal(canReadRegistro({ id: gestor, perfil: 'GESTOR', ativo: true }, { registrado_por: op }), true);
});

test('actual PostgreSQL RLS, grants, triggers and photo policies', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' $$;
  `.replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'", "select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
  await db.exec(`
    grant usage on schema auth,storage,public to authenticated,anon;
    create table public.tecnodrill_usuarios(id uuid primary key,nome text,perfil text,email text,username text,senha_hash text,ativo boolean,criado_em timestamptz default now());
    create table public.tecnodrill_servicos(id text primary key,descricao text);
    create table public.tecnodrill_furos(id uuid primary key,servico_id text,navegador_id uuid,operador_id uuid,comprimento_furo numeric default 0);
    create table public.tecnodrill_barras(id uuid primary key default gen_random_uuid(), furo_id uuid,numero_barra int,metros numeric,metros_acumulados numeric,registrado_por uuid references public.tecnodrill_usuarios(id),tipo_registro text,observacao text,foto_url text,fotos jsonb default '[]');
    create table public.tecnodrill_logs(id uuid primary key default gen_random_uuid(),usuario_id uuid,acao text);
    create table storage.objects(name text primary key,bucket_id text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to authenticated;
    insert into public.tecnodrill_usuarios(id,nome,perfil,username,senha_hash,ativo) values
      ('${op}','Mesmo Nome','OPERADOR','op','hash',true),
      ('${nav}','Mesmo Nome','NAVEGADOR','nav','hash',true),
      ('${gestor}','Gestor','GESTOR','gestor','hash',true),
      ('${inativo}','Inativo','OPERADOR','inativo','hash',false);
    insert into public.tecnodrill_servicos values ('TD-01','');
    insert into public.tecnodrill_furos(id,servico_id,navegador_id,operador_id) values ('${furo}','TD-01','${nav}','${op}');
    insert into public.tecnodrill_barras(id,furo_id,numero_barra,metros,metros_acumulados,registrado_por,tipo_registro,foto_url) values
      ('${barraOp}','${furo}',1,10,10,'${op}','CANALIZACAO','${prefix}legacy/op.jpg'),
      ('${barraNav}','${furo}',2,20,30,'${nav}','CANALIZACAO','${prefix}legacy/nav.jpg');
    insert into storage.objects values ('legacy/op.jpg','tecnodrill-fotos'),('legacy/nav.jpg','tecnodrill-fotos');
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261015180432_secure_tecnodrill_access.sql'), 'utf8'));
  const asUser = async id => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, role: 'authenticated', user_metadata: { perfil: 'ADMIN' } })]);
    await db.exec('set role authenticated');
  };
  for (const [perfil, id] of [['OPERADOR', op], ['NAVEGADOR', nav]]) {
    await t.test(`${perfil}: reads own rows only; forged client role is ignored`, async () => {
      await asUser(id);
      const { rows } = await db.query('select registrado_por from public.tecnodrill_barras');
      assert.equal(rows.length, 1);
      assert.ok(rows.every(row => row.registrado_por === id));
      assert.equal((await db.query('select id from public.tecnodrill_servicos')).rows.length, 1);
      assert.equal((await db.query('select id from public.tecnodrill_usuarios')).rows.length, 1);
      await assert.rejects(db.query('select senha_hash from public.tecnodrill_usuarios'));
      await assert.rejects(db.query("update public.tecnodrill_usuarios set perfil='ADMIN' where id=$1", [id]));
    });
    await t.test(`${perfil}: cannot read, edit, delete or insert on behalf of another author`, async () => {
      await asUser(id);
      const other = id === op ? nav : op;
      const otherBarra = id === op ? barraNav : barraOp;
      assert.equal((await db.query('select id from public.tecnodrill_barras where id=$1', [otherBarra])).rows.length, 0);
      assert.equal((await db.query('update public.tecnodrill_barras set metros=999 where id=$1 returning id', [otherBarra])).rows.length, 0);
      assert.equal((await db.query('delete from public.tecnodrill_barras where id=$1 returning id', [otherBarra])).rows.length, 0);
      await assert.rejects(db.query('insert into public.tecnodrill_barras(furo_id,metros,registrado_por) values ($1,1,$2)', [furo,other]));
      await assert.rejects(db.query('update public.tecnodrill_barras set registrado_por=$1 where registrado_por=$2', [other,id]));
    });
    await t.test(`${perfil}: private photos obey immutable ownership; URLs in an observation cannot grant access`, async () => {
      await asUser(id);
      const mine = id === op ? 'legacy/op.jpg' : 'legacy/nav.jpg';
      assert.deepEqual((await db.query('select name from storage.objects')).rows.map(row => row.name), [mine]);
      await db.query('update public.tecnodrill_barras set observacao=$1 where registrado_por=$2', ['legacy/op.jpg legacy/nav.jpg',id]);
      assert.deepEqual((await db.query('select name from storage.objects')).rows.map(row => row.name), [mine]);
      await assert.rejects(db.query("insert into storage.objects(name,bucket_id) values ($1,'tecnodrill-fotos')", [(id === op ? nav : op) + '/foreign.jpg']));
    });
  }
  await t.test('manager retains global visibility', async () => {
    await asUser(gestor);
    assert.equal((await db.query('select id from public.tecnodrill_barras')).rows.length, 2);
    assert.equal((await db.query('select name from storage.objects')).rows.length, 2);
  });
  await t.test('inactive profile and unauthenticated client cannot read records', async () => {
    await asUser(inativo);
    assert.equal((await db.query('select id from public.tecnodrill_barras')).rows.length, 0);
    assert.equal((await db.query('select name from storage.objects')).rows.length, 0);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select id from public.tecnodrill_barras'));
  });
  await t.test('insert numbering uses all records without disclosing them to the technician', async () => {
    await asUser(op);
    const { rows: [created] } = await db.query("insert into public.tecnodrill_barras(furo_id,metros,registrado_por,tipo_registro) values ($1,5,$2,'CANALIZACAO') returning numero_barra,metros_acumulados", [furo,op]);
    assert.equal(created.numero_barra, 3);
    assert.equal(Number(created.metros_acumulados), 35);
    await db.exec('reset role');
    assert.equal(Number((await db.query('select comprimento_furo from public.tecnodrill_furos')).rows[0].comprimento_furo), 35);
  });
  await db.close();
});
