-- SAE - rastreamento de uso (mapa de calor e jornada do usuario).
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run. Pode rodar de novo sem problema.
--
-- Modelo de seguranca:
--  * O navegador do SAE grava com a chave "anon" e so consegue INSERIR em sae_events (nao le nada).
--  * A leitura so existe pelas funcoes sae_* abaixo, que so a chave "service_role" executa.
--    Essa chave fica nas Propriedades do Apps Script (SUPABASE_SERVICE_KEY), nunca no codigo do site.

create table if not exists public.sae_events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  session_id  text not null,
  pv_id       text not null,           -- uma visita a uma pagina
  login       text not null,
  role        text,
  type        text not null,
  route       text not null,           -- rota do SAE sem querystring, ex.: /cursos/combos
  prev_route  text,
  selector    text,
  label       text,
  x           integer,                 -- posicao do clique na pagina (pageX/pageY)
  y           integer,
  vw          integer,                 -- largura/altura da janela
  vh          integer,
  doc_h       integer,                 -- altura total da pagina
  duration_s  integer,                 -- tempo (s) na pagina, nos eventos "leave"
  scroll_pct  integer,                 -- maior rolagem (%) da pagina, nos eventos "leave"
  device      text,
  browser     text,
  os          text,
  constraint sae_events_type_chk check (type in ('session_start','pageview','click','change','action','leave','logout')),
  constraint sae_events_len_chk check (
    char_length(session_id) <= 64 and char_length(pv_id) <= 64 and char_length(login) <= 100
    and char_length(route) <= 200 and coalesce(char_length(prev_route), 0) <= 200
    and coalesce(char_length(selector), 0) <= 300 and coalesce(char_length(label), 0) <= 120
  )
);

create index if not exists sae_events_route_type_idx on public.sae_events (route, type, ts);
create index if not exists sae_events_login_ts_idx   on public.sae_events (login, ts);
create index if not exists sae_events_session_ts_idx on public.sae_events (session_id, ts);
create index if not exists sae_events_ts_idx         on public.sae_events (ts);

alter table public.sae_events enable row level security;

revoke all on public.sae_events from anon, authenticated;
grant insert on public.sae_events to anon;

drop policy if exists sae_events_insert_anon on public.sae_events;
create policy sae_events_insert_anon on public.sae_events
  for insert to anon
  with check (ts between now() - interval '1 day' and now() + interval '10 minutes');

-- ---------------------------------------------------------------------------
-- Consultas do painel (todas devolvem json; so a service_role executa)
-- ---------------------------------------------------------------------------

-- Visao geral: totais, paginas mais vistas e visitas por hora do dia.
create or replace function public.sae_overview(p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  with ev as (select * from sae_events where ts >= p_from and ts <= p_to),
  stay as (
    select pv_id, max(duration_s) as dur from ev where type = 'leave' group by pv_id
  ),
  pages as (
    select e.route, count(*) as views, count(distinct e.login) as users, round(avg(s.dur))::int as avg_s
    from ev e left join stay s on s.pv_id = e.pv_id
    where e.type = 'pageview' group by e.route order by views desc limit 25
  )
  select json_build_object(
    'views',    (select count(*) from ev where type = 'pageview'),
    'sessions', (select count(distinct session_id) from ev),
    'users',    (select count(distinct login) from ev),
    'clicks',   (select count(*) from ev where type = 'click'),
    'avg_s',    (select round(avg(dur))::int from stay),
    'pages',    coalesce((select json_agg(pages order by views desc) from pages), '[]'::json),
    'by_hour',  coalesce((
      select json_agg(json_build_object('hour', h, 'views', n) order by h)
      from (
        select extract(hour from ts at time zone 'America/Sao_Paulo')::int as h, count(*) as n
        from ev where type = 'pageview' group by 1
      ) x
    ), '[]'::json)
  );
$$;

-- Paginas com atividade (para escolher qual mapa de calor ver).
create or replace function public.sae_routes(p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(r order by r.views desc), '[]'::json) from (
    select route,
           count(*) filter (where type = 'pageview') as views,
           count(*) filter (where type = 'click') as clicks
    from sae_events where ts >= p_from and ts <= p_to
    group by route
  ) r;
$$;

-- Usuarios com atividade no periodo.
create or replace function public.sae_users(p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(u order by u.last_ts desc), '[]'::json) from (
    select login, max(role) as role, count(*) filter (where type = 'pageview') as views,
           count(distinct session_id) as sessions, max(ts) as last_ts
    from sae_events where ts >= p_from and ts <= p_to
    group by login
  ) u;
$$;

-- Mapa de calor de uma pagina: pontos de clique, rolagem e elementos mais clicados.
-- p_vw = largura de tela desejada; se for nula, usa a largura mais comum nos dados.
create or replace function public.sae_heatmap(
  p_route text, p_from timestamptz, p_to timestamptz, p_login text default null, p_vw integer default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_width integer := p_vw;
  v_points json;
  v_widths json;
  v_scroll json;
  v_elements json;
  v_views integer;
begin
  select coalesce(json_agg(w order by w.n desc), '[]'::json) into v_widths from (
    select (round(vw / 20.0) * 20)::int as vw, count(*) as n
    from sae_events
    where type = 'click' and route = p_route and ts >= p_from and ts <= p_to
      and vw is not null and (p_login is null or login = p_login)
    group by 1 order by n desc limit 8
  ) w;

  if v_width is null then
    select (round(vw / 20.0) * 20)::int into v_width
    from sae_events
    where type = 'click' and route = p_route and ts >= p_from and ts <= p_to
      and vw is not null and (p_login is null or login = p_login)
    group by 1 order by count(*) desc limit 1;
  end if;

  select coalesce(json_agg(json_build_array(x, y)), '[]'::json) into v_points from (
    select x, y from sae_events
    where type = 'click' and route = p_route and ts >= p_from and ts <= p_to
      and x is not null and y is not null and v_width is not null
      and vw between v_width - 60 and v_width + 60
      and (p_login is null or login = p_login)
    order by ts desc limit 10000
  ) pts;

  select count(*) into v_views from sae_events
  where type = 'pageview' and route = p_route and ts >= p_from and ts <= p_to
    and (p_login is null or login = p_login);

  select coalesce(json_agg(json_build_object('pct', k, 'visits', n, 'total', total) order by k), '[]'::json) into v_scroll from (
    select k, count(*) filter (where m >= k) as n, count(*) as total
    from (
      select max(scroll_pct) as m from sae_events
      where type = 'leave' and route = p_route and ts >= p_from and ts <= p_to
        and (p_login is null or login = p_login)
      group by pv_id
    ) s, generate_series(10, 100, 10) as k
    group by k
  ) sc;

  select coalesce(json_agg(e), '[]'::json) into v_elements from (
    select coalesce(nullif(label, ''), '(area sem botao)') as label, count(*) as clicks, count(distinct login) as users
    from sae_events
    where type = 'click' and route = p_route and ts >= p_from and ts <= p_to
      and (p_login is null or login = p_login)
    group by 1 order by clicks desc limit 20
  ) e;

  return json_build_object('width', v_width, 'widths', v_widths, 'points', v_points,
                           'views', v_views, 'scroll', v_scroll, 'elements', v_elements);
end;
$$;

-- Jornada de um usuario: todos os passos em ordem (ate 3000 eventos).
create or replace function public.sae_journey(p_login text, p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(j order by j.ts, j.id), '[]'::json) from (
    select id, ts, session_id, pv_id, type, route, prev_route, label, duration_s, scroll_pct, device, browser
    from sae_events
    where login = p_login and ts >= p_from and ts <= p_to
    order by ts, id limit 3000
  ) j;
$$;

-- Fluxo: transicoes de pagina para pagina e os caminhos mais comuns por sessao (ate 6 passos).
create or replace function public.sae_flow(p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  with pv as (
    select session_id, route, ts, id,
           lag(route) over (partition by session_id order by ts, id) as prev
    from sae_events where type = 'pageview' and ts >= p_from and ts <= p_to
  ),
  steps as (select * from pv where prev is distinct from route),
  numbered as (
    select session_id, route, row_number() over (partition by session_id order by ts, id) as rn from steps
  ),
  paths as (
    select string_agg(route, ' > ' order by rn) as path
    from numbered where rn <= 6 group by session_id
  )
  select json_build_object(
    'transitions', coalesce((
      select json_agg(t order by t.n desc) from (
        select prev as "from", route as "to", count(*) as n
        from steps where prev is not null group by prev, route order by n desc limit 40
      ) t
    ), '[]'::json),
    'paths', coalesce((
      select json_agg(p order by p.n desc) from (
        select path, count(*) as n from paths where position(' > ' in path) > 0
        group by path order by n desc limit 15
      ) p
    ), '[]'::json)
  );
$$;

-- Tempo por usuario e por pagina: uma linha por (login, rota). O tempo e o da aba visivel, registrado no evento "leave";
-- visitas sem "leave" (aba fechada de repente) contam como visita, mas nao entram no tempo (timed = visitas com tempo).
create or replace function public.sae_time_by_user(p_from timestamptz, p_to timestamptz)
returns json language sql security definer set search_path = public as $$
  with ev as (select * from sae_events where ts >= p_from and ts <= p_to),
  visits as (
    select pv_id, min(login) as login, min(role) as role, min(route) as route
    from ev where type = 'pageview' group by pv_id
  ),
  stay as (
    select pv_id, max(duration_s) as dur from ev where type = 'leave' group by pv_id
  )
  select coalesce(json_agg(r order by r.total_s desc), '[]'::json) from (
    select v.login, max(v.role) as role, v.route,
           count(*) as visits,
           count(s.dur) as timed,
           coalesce(sum(s.dur), 0)::int as total_s
    from visits v left join stay s on s.pv_id = v.pv_id
    group by v.login, v.route
  ) r;
$$;

revoke all on function public.sae_overview(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sae_routes(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sae_users(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sae_heatmap(text, timestamptz, timestamptz, text, integer) from public, anon, authenticated;
revoke all on function public.sae_journey(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sae_flow(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sae_time_by_user(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.sae_overview(timestamptz, timestamptz) to service_role;
grant execute on function public.sae_routes(timestamptz, timestamptz) to service_role;
grant execute on function public.sae_users(timestamptz, timestamptz) to service_role;
grant execute on function public.sae_heatmap(text, timestamptz, timestamptz, text, integer) to service_role;
grant execute on function public.sae_journey(text, timestamptz, timestamptz) to service_role;
grant execute on function public.sae_flow(timestamptz, timestamptz) to service_role;
grant execute on function public.sae_time_by_user(timestamptz, timestamptz) to service_role;

-- Retencao (opcional): apaga eventos com mais de 180 dias todo dia as 03:00.
-- Exige a extensao pg_cron (Database > Extensions > pg_cron). Descomente para ativar:
-- select cron.schedule('sae-events-retention', '0 3 * * *', $$delete from public.sae_events where ts < now() - interval '180 days'$$);
