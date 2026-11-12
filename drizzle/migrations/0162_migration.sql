create table public.distribution_preview_views (
  id uuid primary key default gen_random_uuid(),
  viewed_at timestamptz not null default now(),
  target_day date not null,
  mode text not null,
  weekday text not null,
  blocked text not null
);
grant all on public.distribution_preview_views to service_role;
alter table public.distribution_preview_views enable row level security;
create index distribution_preview_views_viewed_at_idx on public.distribution_preview_views (viewed_at);
create trigger distribution_preview_views_append_only before update or delete on public.distribution_preview_views for each row execute function public.append_only_block();