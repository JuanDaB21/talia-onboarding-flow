-- Enums
create type public.rol_staff as enum ('SUPERADMIN','ADMIN','MESERO','COCINA');
create type public.estado_staff as enum ('ACTIVO','INACTIVO','SUSPENDIDO');

-- Tabla NEGOCIO
create table public.negocio (
  id_negocio uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text not null,
  documento_tributario text not null,
  url_logo text,
  telefono_contacto text not null,
  direccion text not null,
  estado boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tabla USUARIOS_STAFF
create table public.usuarios_staff (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  id_negocio uuid not null references public.negocio(id_negocio) on delete restrict,
  nombre text not null,
  correo text not null unique,
  rol public.rol_staff not null,
  estado public.estado_staff not null default 'ACTIVO',
  esta_en_turno boolean not null default false,
  created_at timestamptz not null default now()
);

create index usuarios_staff_id_negocio_idx on public.usuarios_staff(id_negocio);

-- RLS
alter table public.negocio enable row level security;
alter table public.usuarios_staff enable row level security;

-- Helper SECURITY DEFINER para evitar recursión en políticas
create or replace function public.current_user_negocio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id_negocio from public.usuarios_staff where id_usuario = auth.uid()
$$;

-- Policies usuarios_staff: el usuario ve su propia fila y la de sus colegas del mismo negocio
create policy "staff_select_own_negocio"
  on public.usuarios_staff for select
  to authenticated
  using (id_negocio = public.current_user_negocio());

create policy "staff_update_self"
  on public.usuarios_staff for update
  to authenticated
  using (id_usuario = auth.uid())
  with check (id_usuario = auth.uid());

-- Policies negocio: solo miembros pueden ver/actualizar su negocio
create policy "negocio_select_own"
  on public.negocio for select
  to authenticated
  using (id_negocio = public.current_user_negocio());

create policy "negocio_update_own"
  on public.negocio for update
  to authenticated
  using (id_negocio = public.current_user_negocio())
  with check (id_negocio = public.current_user_negocio());

-- Función transaccional para alta atómica
create or replace function public.registrar_negocio_y_admin(
  p_user_id uuid,
  p_nombre text,
  p_correo text,
  p_nombre_comercial text,
  p_razon_social text,
  p_documento_tributario text,
  p_telefono text,
  p_direccion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_negocio uuid;
begin
  -- Anti-suplantación: el id debe coincidir con el llamante autenticado
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Evitar doble registro
  if exists (select 1 from public.usuarios_staff where id_usuario = p_user_id) then
    raise exception 'El usuario ya tiene un negocio asignado' using errcode = '23505';
  end if;

  -- Validaciones básicas no-vacías
  if coalesce(trim(p_nombre_comercial),'') = '' or
     coalesce(trim(p_razon_social),'') = '' or
     coalesce(trim(p_documento_tributario),'') = '' or
     coalesce(trim(p_telefono),'') = '' or
     coalesce(trim(p_direccion),'') = '' or
     coalesce(trim(p_nombre),'') = '' or
     coalesce(trim(p_correo),'') = '' then
    raise exception 'Todos los campos son obligatorios' using errcode = '23514';
  end if;

  -- 1) Insertar negocio
  insert into public.negocio (
    nombre_comercial, razon_social, documento_tributario,
    telefono_contacto, direccion
  ) values (
    trim(p_nombre_comercial), trim(p_razon_social), trim(p_documento_tributario),
    trim(p_telefono), trim(p_direccion)
  )
  returning id_negocio into v_id_negocio;

  -- 2) Insertar usuario staff como SUPERADMIN. Si falla, el insert previo se revierte.
  insert into public.usuarios_staff (
    id_usuario, id_negocio, nombre, correo, rol
  ) values (
    p_user_id, v_id_negocio, trim(p_nombre), lower(trim(p_correo)), 'SUPERADMIN'
  );

  return v_id_negocio;
end;
$$;

revoke all on function public.registrar_negocio_y_admin(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.registrar_negocio_y_admin(uuid,text,text,text,text,text,text,text) to authenticated;