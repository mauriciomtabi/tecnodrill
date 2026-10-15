-- Scope every change to Tecnodrill; this project also hosts the JLE application.
create schema if not exists tecnodrill_private;
revoke all on schema tecnodrill_private from public;
grant usage on schema tecnodrill_private to authenticated;

alter table public.tecnodrill_usuarios add column if not exists trocar_senha_primeiro_acesso boolean not null default false;

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

-- Membership grants access to the work, never to another technician's records.
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
create or replace function tecnodrill_private.can_access_furo(furo_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tecnodrill_furos f where f.id=furo_id and tecnodrill_private.can_access_service(f.servico_id));
$$;

revoke all on function tecnodrill_private.active_user(), tecnodrill_private.is_manager(), tecnodrill_private.can_access_service(text), tecnodrill_private.can_access_furo(uuid), tecnodrill_private.metadata(text,text) from public;
grant execute on function tecnodrill_private.active_user(), tecnodrill_private.is_manager(), tecnodrill_private.can_access_service(text), tecnodrill_private.can_access_furo(uuid) to authenticated;

alter table public.tecnodrill_barras enable row level security;
alter table public.tecnodrill_furos enable row level security;
alter table public.tecnodrill_servicos enable row level security;
alter table public.tecnodrill_usuarios enable row level security;
alter table public.tecnodrill_logs enable row level security;

revoke all on public.tecnodrill_barras, public.tecnodrill_furos, public.tecnodrill_servicos, public.tecnodrill_usuarios, public.tecnodrill_logs from anon;
revoke all on public.tecnodrill_usuarios from authenticated;
grant select (id,nome,perfil,email,username,ativo,criado_em,trocar_senha_primeiro_acesso) on public.tecnodrill_usuarios to authenticated;
grant select,insert,update,delete on public.tecnodrill_barras, public.tecnodrill_furos, public.tecnodrill_servicos, public.tecnodrill_logs to authenticated;

create policy td_users_read on public.tecnodrill_usuarios for select to authenticated
using (tecnodrill_private.active_user() and (id=(select auth.uid()) or tecnodrill_private.is_manager()));
create policy td_services_read on public.tecnodrill_servicos for select to authenticated
using (tecnodrill_private.can_access_service(id));
create policy td_services_manage on public.tecnodrill_servicos for all to authenticated
using (tecnodrill_private.is_manager()) with check (tecnodrill_private.is_manager());
create policy td_furos_read on public.tecnodrill_furos for select to authenticated
using (tecnodrill_private.can_access_service(servico_id));
create policy td_furos_insert on public.tecnodrill_furos for insert to authenticated
with check (tecnodrill_private.can_access_service(servico_id));
create policy td_furos_update on public.tecnodrill_furos for update to authenticated
using (tecnodrill_private.is_manager()) with check (tecnodrill_private.is_manager());
create policy td_furos_delete on public.tecnodrill_furos for delete to authenticated
using (tecnodrill_private.is_manager());
create policy td_barras_read on public.tecnodrill_barras for select to authenticated
using (tecnodrill_private.active_user() and (registrado_por=(select auth.uid()) or tecnodrill_private.is_manager()));
create policy td_barras_insert on public.tecnodrill_barras for insert to authenticated
with check (tecnodrill_private.active_user() and tecnodrill_private.can_access_furo(furo_id) and (registrado_por=(select auth.uid()) or tecnodrill_private.is_manager()));
create policy td_barras_update on public.tecnodrill_barras for update to authenticated
using (tecnodrill_private.active_user() and (registrado_por=(select auth.uid()) or tecnodrill_private.is_manager()))
with check (tecnodrill_private.active_user() and tecnodrill_private.can_access_furo(furo_id) and (registrado_por=(select auth.uid()) or tecnodrill_private.is_manager()));
create policy td_barras_delete on public.tecnodrill_barras for delete to authenticated
using (tecnodrill_private.active_user() and (registrado_por=(select auth.uid()) or tecnodrill_private.is_manager()));
create policy td_logs_manage on public.tecnodrill_logs for all to authenticated
using (tecnodrill_private.is_manager()) with check (tecnodrill_private.is_manager());

create index if not exists td_barras_author_furo on public.tecnodrill_barras(registrado_por,furo_id);

-- Keep numbering and totals correct without letting a technician read others' rows.
create or replace function tecnodrill_private.number_barra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.tecnodrill_furos where id=new.furo_id for update;
  select coalesce(max(numero_barra),0)+1,
    coalesce(sum(case when tipo_registro='CAIXA' then 0 else coalesce(metros,3) end),0)
  into new.numero_barra,new.metros_acumulados from public.tecnodrill_barras where furo_id=new.furo_id;
  new.metros_acumulados := new.metros_acumulados + case when new.tipo_registro='CAIXA' then 0 else coalesce(new.metros,3) end;
  return new;
end;
$$;
create trigger td_number_barra before insert on public.tecnodrill_barras for each row execute function tecnodrill_private.number_barra();
create or replace function tecnodrill_private.total_furo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  target := case when tg_op='DELETE' then old.furo_id else new.furo_id end;
  update public.tecnodrill_furos f set comprimento_furo=(select coalesce(sum(case when tipo_registro='CAIXA' then 0 else coalesce(metros,3) end),0) from public.tecnodrill_barras where furo_id=target) where f.id=target;
  if tg_op='UPDATE' and old.furo_id is distinct from new.furo_id then
    update public.tecnodrill_furos f set comprimento_furo=(select coalesce(sum(case when tipo_registro='CAIXA' then 0 else coalesce(metros,3) end),0) from public.tecnodrill_barras where furo_id=old.furo_id) where f.id=old.furo_id;
  end if;
  return null;
end;
$$;
create trigger td_total_furo after insert or update or delete on public.tecnodrill_barras for each row execute function tecnodrill_private.total_furo();
revoke all on function tecnodrill_private.number_barra(), tecnodrill_private.total_furo() from public;

create or replace function public.tecnodrill_complete_first_access() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not tecnodrill_private.active_user() then raise exception 'Acesso negado'; end if;
  update public.tecnodrill_usuarios set trocar_senha_primeiro_acesso=false where id=auth.uid();
end;
$$;
revoke all on function public.tecnodrill_complete_first_access() from public;
grant execute on function public.tecnodrill_complete_first_access() to authenticated;

-- Immutable ownership snapshot of legacy photos. Do not grant by mutable text/URL.
create table tecnodrill_private.photo_owners (
  name text not null,
  barra_id uuid not null references public.tecnodrill_barras(id) on delete cascade,
  primary key(name,barra_id)
);
alter table tecnodrill_private.photo_owners enable row level security;
revoke all on tecnodrill_private.photo_owners from public,anon,authenticated;
insert into tecnodrill_private.photo_owners(name,barra_id)
select distinct o.name,b.id
from public.tecnodrill_barras b
cross join lateral (
  select b.foto_url as url
  union all select jsonb_array_elements_text(coalesce(b.fotos,'[]'::jsonb))
  union all select jsonb_array_elements_text(coalesce(tecnodrill_private.metadata(b.observacao,'BARRA_META')->'fotos','[]'::jsonb))
) photos
join storage.objects o on o.bucket_id='tecnodrill-fotos' and photos.url = 'https://dkscchjzztwyjzjpllob.supabase.co/storage/v1/object/public/tecnodrill-fotos/' || o.name
where b.registrado_por is not null
on conflict do nothing;
create or replace function tecnodrill_private.can_read_photo(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select tecnodrill_private.active_user() and (
    tecnodrill_private.is_manager() or split_part(object_name,'/',1)=auth.uid()::text
    or exists (select 1 from tecnodrill_private.photo_owners p join public.tecnodrill_barras b on b.id=p.barra_id where p.name=object_name and b.registrado_por=auth.uid())
  );
$$;
revoke all on function tecnodrill_private.can_read_photo(text) from public;
grant execute on function tecnodrill_private.can_read_photo(text) to authenticated;
create policy td_photos_read on storage.objects for select to authenticated
using (bucket_id='tecnodrill-fotos' and tecnodrill_private.can_read_photo(name));
create policy td_photos_insert on storage.objects for insert to authenticated
with check (bucket_id='tecnodrill-fotos' and tecnodrill_private.active_user() and split_part(name,'/',1)=(select auth.uid())::text);
create policy td_photos_update on storage.objects for update to authenticated
using (bucket_id='tecnodrill-fotos' and tecnodrill_private.active_user() and split_part(name,'/',1)=(select auth.uid())::text)
with check (bucket_id='tecnodrill-fotos' and tecnodrill_private.active_user() and split_part(name,'/',1)=(select auth.uid())::text);
-- The bucket is made private only after the new signed-photo client is deployed.
