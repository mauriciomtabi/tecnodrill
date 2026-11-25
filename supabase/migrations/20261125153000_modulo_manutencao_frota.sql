-- Módulo de Manutenção e Controle de Frota (Perfuratrizes e Caminhões)
-- Escopo exclusivo TecnoDrill (tabelas prefixadas com tecnodrill_)

-- Garante que o schema e funções auxiliares tecnodrill_private existam
create schema if not exists tecnodrill_private;
revoke all on schema tecnodrill_private from public;
grant usage on schema tecnodrill_private to authenticated;

create or replace function tecnodrill_private.active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.tecnodrill_usuarios where id = auth.uid() and ativo
  );
$$;

create or replace function tecnodrill_private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.tecnodrill_usuarios where id = auth.uid() and ativo and perfil in ('ADMIN','GESTOR')
  );
$$;

create or replace function tecnodrill_private.metadata(raw text, tag text) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(substring(raw from '<!--' || tag || ':(.*?)-->')::jsonb, '{}'::jsonb);
exception when others then return '{}'::jsonb;
end;
$$;

create or replace function tecnodrill_private.can_access_service(service_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select tecnodrill_private.active_user() and (
    tecnodrill_private.is_manager()
    or exists (select 1 from public.tecnodrill_furos f where f.servico_id = service_id and (f.navegador_id = auth.uid() or f.operador_id = auth.uid()))
    or exists (select 1 from public.tecnodrill_barras b join public.tecnodrill_furos f on f.id=b.furo_id where f.servico_id=service_id and b.registrado_por=auth.uid())
    or exists (
      select 1 from public.tecnodrill_servicos s,
      lateral jsonb_array_elements(
        coalesce(tecnodrill_private.metadata(s.descricao,'TD_META')->'navegadores','[]'::jsonb) ||
        coalesce(tecnodrill_private.metadata(s.descricao,'TD_META')->'operadores','[]'::jsonb)
      ) member
      where s.id=service_id and member->>'id'=auth.uid()::text
    )
  );
$$;

revoke all on function tecnodrill_private.active_user(), tecnodrill_private.is_manager(), tecnodrill_private.can_access_service(text), tecnodrill_private.metadata(text,text) from public;
grant execute on function tecnodrill_private.active_user(), tecnodrill_private.is_manager(), tecnodrill_private.can_access_service(text) to authenticated;

-- 1. Cadastro de Veículos e Equipamentos
create table if not exists public.tecnodrill_veiculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_interno text,
  tipo text not null check (tipo in ('PERFURATRIZ', 'CAMINHAO')),
  marca text,
  modelo text,
  ano integer,
  placa text,
  numero_serie text,
  unidade_medida text not null check (unidade_medida in ('HORAS', 'KM')),
  leitura_atual numeric(12,2) not null default 0,
  servico_id text references public.tecnodrill_servicos(id) on delete set null,
  foto_principal_url text,
  fotos jsonb not null default '[]'::jsonb,
  documentos jsonb not null default '[]'::jsonb,
  especificacoes jsonb not null default '{}'::jsonb,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists td_veiculos_servico_idx on public.tecnodrill_veiculos(servico_id) where ativo = true;
create index if not exists td_veiculos_tipo_idx on public.tecnodrill_veiculos(tipo) where ativo = true;

-- 2. Modelos Padrão de Planos de Preventiva (Templates)
create table if not exists public.tecnodrill_planos_preventiva (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_veiculo text not null check (tipo_veiculo in ('PERFURATRIZ', 'CAMINHAO')),
  descricao text,
  itens jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- 3. Itens de Manutenção Preventiva por Veículo
create table if not exists public.tecnodrill_veiculo_preventivas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.tecnodrill_veiculos(id) on delete cascade,
  nome text not null,
  categoria text,
  descricao text,
  intervalo numeric(12,2) not null check (intervalo > 0),
  alerta_antecedencia numeric(12,2) not null default 0 check (alerta_antecedencia >= 0),
  ultima_leitura_realizada numeric(12,2) not null default 0,
  data_ultima_realizacao timestamptz,
  proxima_leitura numeric(12,2) generated always as (ultima_leitura_realizada + intervalo) stored,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists td_veiculo_prev_veiculo_idx on public.tecnodrill_veiculo_preventivas(veiculo_id) where ativo = true;

-- 4. Histórico de Manutenções Preventivas Realizadas (Baixas)
create table if not exists public.tecnodrill_manutencoes_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.tecnodrill_veiculos(id) on delete cascade,
  preventiva_id uuid references public.tecnodrill_veiculo_preventivas(id) on delete set null,
  servico_id text references public.tecnodrill_servicos(id) on delete set null,
  titulo text not null,
  leitura_realizada numeric(12,2) not null,
  data_realizacao timestamptz not null default now(),
  executado_por_nome text,
  registrado_por uuid references public.tecnodrill_usuarios(id) on delete set null,
  registrado_por_nome text,
  observacoes text,
  fotos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists td_manut_hist_veiculo_idx on public.tecnodrill_manutencoes_historico(veiculo_id, data_realizacao desc);

-- 5. Leituras Diárias de Horímetro / Odômetro
create table if not exists public.tecnodrill_veiculo_leituras (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.tecnodrill_veiculos(id) on delete cascade,
  servico_id text references public.tecnodrill_servicos(id) on delete set null,
  usuario_id uuid references public.tecnodrill_usuarios(id) on delete set null,
  usuario_nome text,
  data_referencia date not null,
  leitura_anterior numeric(12,2) not null default 0,
  leitura_informada numeric(12,2) not null,
  unidade_medida text not null check (unidade_medida in ('HORAS', 'KM')),
  origem text not null default 'PRIMEIRO_REGISTRO_DIA' check (origem in ('PRIMEIRO_REGISTRO_DIA', 'MANUAL', 'PREVENTIVA')),
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists td_veiculo_leituras_dia_idx on public.tecnodrill_veiculo_leituras(veiculo_id, data_referencia desc);
create index if not exists td_veiculo_leituras_servico_dia_idx on public.tecnodrill_veiculo_leituras(servico_id, data_referencia desc);

-- Trigger para atualizar leitura_atual do veículo automaticamente ao registrar leitura
create or replace function tecnodrill_private.sync_veiculo_leitura() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tecnodrill_veiculos
  set leitura_atual = greatest(coalesce(leitura_atual, 0), new.leitura_informada),
      atualizado_em = now()
  where id = new.veiculo_id;
  return new;
end;
$$;

drop trigger if exists td_sync_veiculo_leitura on public.tecnodrill_veiculo_leituras;
create trigger td_sync_veiculo_leitura
  after insert on public.tecnodrill_veiculo_leituras
  for each row execute function tecnodrill_private.sync_veiculo_leitura();

revoke all on function tecnodrill_private.sync_veiculo_leitura() from public;

-- Função auxiliar de acesso ao veículo (gestor vê tudo; campo vê veículos da obra que participa)
create or replace function tecnodrill_private.can_access_veiculo(v_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select tecnodrill_private.active_user() and (
    tecnodrill_private.is_manager()
    or exists (
      select 1 from public.tecnodrill_veiculos v
      where v.id = v_id
        and v.servico_id is not null
        and tecnodrill_private.can_access_service(v.servico_id)
    )
  );
$$;

revoke all on function tecnodrill_private.can_access_veiculo(uuid) from public;
grant execute on function tecnodrill_private.can_access_veiculo(uuid) to authenticated;

-- RLS e Permissões
alter table public.tecnodrill_veiculos enable row level security;
alter table public.tecnodrill_planos_preventiva enable row level security;
alter table public.tecnodrill_veiculo_preventivas enable row level security;
alter table public.tecnodrill_manutencoes_historico enable row level security;
alter table public.tecnodrill_veiculo_leituras enable row level security;

revoke all on
  public.tecnodrill_veiculos,
  public.tecnodrill_planos_preventiva,
  public.tecnodrill_veiculo_preventivas,
  public.tecnodrill_manutencoes_historico,
  public.tecnodrill_veiculo_leituras
from anon;

grant select, insert, update, delete on
  public.tecnodrill_veiculos,
  public.tecnodrill_planos_preventiva,
  public.tecnodrill_veiculo_preventivas,
  public.tecnodrill_manutencoes_historico,
  public.tecnodrill_veiculo_leituras
to authenticated;

-- Políticas: tecnodrill_veiculos
create policy td_veiculos_read on public.tecnodrill_veiculos for select to authenticated
using (tecnodrill_private.can_access_veiculo(id));

create policy td_veiculos_manage on public.tecnodrill_veiculos for all to authenticated
using (tecnodrill_private.is_manager())
with check (tecnodrill_private.is_manager());

-- Políticas: tecnodrill_planos_preventiva
create policy td_planos_read on public.tecnodrill_planos_preventiva for select to authenticated
using (tecnodrill_private.active_user());

create policy td_planos_manage on public.tecnodrill_planos_preventiva for all to authenticated
using (tecnodrill_private.is_manager())
with check (tecnodrill_private.is_manager());

-- Políticas: tecnodrill_veiculo_preventivas
create policy td_veiculo_prev_read on public.tecnodrill_veiculo_preventivas for select to authenticated
using (tecnodrill_private.can_access_veiculo(veiculo_id));

create policy td_veiculo_prev_manage on public.tecnodrill_veiculo_preventivas for all to authenticated
using (tecnodrill_private.is_manager())
with check (tecnodrill_private.is_manager());

-- Políticas: tecnodrill_manutencoes_historico (apenas ADMIN/GESTOR dão baixa)
create policy td_manut_hist_read on public.tecnodrill_manutencoes_historico for select to authenticated
using (tecnodrill_private.can_access_veiculo(veiculo_id));

create policy td_manut_hist_manage on public.tecnodrill_manutencoes_historico for all to authenticated
using (tecnodrill_private.is_manager())
with check (tecnodrill_private.is_manager());

-- Políticas: tecnodrill_veiculo_leituras (campo lê e insere leitura dos veículos da obra; gestor gerencia tudo)
create policy td_veiculo_leituras_read on public.tecnodrill_veiculo_leituras for select to authenticated
using (tecnodrill_private.can_access_veiculo(veiculo_id));

create policy td_veiculo_leituras_insert on public.tecnodrill_veiculo_leituras for insert to authenticated
with check (
  tecnodrill_private.can_access_veiculo(veiculo_id)
  and (usuario_id = (select auth.uid()) or tecnodrill_private.is_manager())
);

create policy td_veiculo_leituras_manage on public.tecnodrill_veiculo_leituras for update to authenticated
using (tecnodrill_private.is_manager())
with check (tecnodrill_private.is_manager());

create policy td_veiculo_leituras_delete on public.tecnodrill_veiculo_leituras for delete to authenticated
using (tecnodrill_private.is_manager());

-- Seed de Planos Padrão Iniciais
insert into public.tecnodrill_planos_preventiva (nome, tipo_veiculo, descricao, itens)
select
  'Plano Padrão Perfuratriz (Horímetro)',
  'PERFURATRIZ',
  'Checklist preventivo padrão por horas trabalhadas para perfuratrizes direcionais.',
  '[
    {"nome": "Troca de Óleo do Motor + Filtro", "categoria": "Motor", "intervalo": 250, "alerta_antecedencia": 25, "descricao": "Substituir óleo lubrificante e filtro de óleo do motor."},
    {"nome": "Troca dos Filtros de Combustível", "categoria": "Motor", "intervalo": 250, "alerta_antecedencia": 25, "descricao": "Substituir filtro primário e separador de água."},
    {"nome": "Limpeza / Troca Filtro de Ar", "categoria": "Motor", "intervalo": 500, "alerta_antecedencia": 50, "descricao": "Inspecionar e substituir elemento filtrante primário e secundário."},
    {"nome": "Revisão Cabeça Rotativa e Morsa", "categoria": "Perfuração", "intervalo": 500, "alerta_antecedencia": 50, "descricao": "Inspecionar folgas, engraxamento e vedações."},
    {"nome": "Troca de Óleo e Filtro Hidráulico", "categoria": "Hidráulica", "intervalo": 1000, "alerta_antecedencia": 100, "descricao": "Substituir óleo hidráulico, filtro de retorno e sucção."}
  ]'::jsonb
where not exists (
  select 1 from public.tecnodrill_planos_preventiva where tipo_veiculo = 'PERFURATRIZ'
);

insert into public.tecnodrill_planos_preventiva (nome, tipo_veiculo, descricao, itens)
select
  'Plano Padrão Caminhão (Km)',
  'CAMINHAO',
  'Checklist preventivo padrão por quilometragem para caminhões de apoio e transporte.',
  '[
    {"nome": "Troca de Óleo do Motor + Filtros", "categoria": "Motor", "intervalo": 10000, "alerta_antecedencia": 1000, "descricao": "Óleo do motor, filtro de óleo e filtro de combustível."},
    {"nome": "Inspeção de Freios, Lonas e Cuícas", "categoria": "Segurança", "intervalo": 15000, "alerta_antecedencia": 1500, "descricao": "Revisão completa do sistema de freios a ar."},
    {"nome": "Rodízio, Calibragem e Alinhamento", "categoria": "Pneus", "intervalo": 15000, "alerta_antecedencia": 1500, "descricao": "Conferência de desgaste, sulcos e alinhamento."},
    {"nome": "Troca de Filtro de Ar", "categoria": "Motor", "intervalo": 20000, "alerta_antecedencia": 2000, "descricao": "Substituição do elemento do filtro de ar."},
    {"nome": "Revisão Diferencial, Câmbio e Cardan", "categoria": "Transmissão", "intervalo": 30000, "alerta_antecedencia": 2500, "descricao": "Conferência de nível/troca de óleo e cruzetas."}
  ]'::jsonb
where not exists (
  select 1 from public.tecnodrill_planos_preventiva where tipo_veiculo = 'CAMINHAO'
);
