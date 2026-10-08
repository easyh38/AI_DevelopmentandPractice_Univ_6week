-- ============================================================
-- 룰루랄라 카페 주문서 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1. 주문 테이블 ------------------------------------------------
create table if not exists public.orders (
  id          bigint generated always as identity primary key, -- 주문번호 (#1, #2, ...)
  customer_name text      not null check (char_length(trim(customer_name)) > 0), -- 이름
  phone       text        not null check (char_length(trim(phone)) > 0),  -- 전화번호
  drink       text        not null,                                       -- 음료 이름
  drink_price integer     not null check (drink_price >= 0),              -- 음료 기본 가격(원)
  size        text        not null default 'M' check (size in ('S', 'M', 'L')),
  options     text[]      not null default '{}',                          -- 추가 옵션 (예: {샷 추가,크림 추가})
  quantity    integer     not null default 1 check (quantity between 1 and 100),
  request     text        not null default '',                            -- 요청사항
  total_price integer     not null check (total_price >= 0),              -- 총 금액(원)
  created_at  timestamptz not null default now()                          -- 주문 시간
);

-- 최신 주문 순 조회용 인덱스
create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

-- 2. RLS (행 수준 보안) -----------------------------------------
alter table public.orders enable row level security;

-- 로그인 없이 브라우저(anon 키)에서 쓰는 구조이므로 anon 에게 허용합니다.
-- 주문하기 → insert / 주문 내역 → select / 취소·모두 지우기 → delete
drop policy if exists "anon can insert orders" on public.orders;
create policy "anon can insert orders"
  on public.orders for insert
  to anon
  with check (true);

drop policy if exists "anon can select orders" on public.orders;
create policy "anon can select orders"
  on public.orders for select
  to anon
  using (true);

drop policy if exists "anon can delete orders" on public.orders;
create policy "anon can delete orders"
  on public.orders for delete
  to anon
  using (true);

-- ============================================================
-- 사용 예시 (JavaScript, supabase-js)
--   저장:  await supabase.from('orders').insert({ customer_name, phone, drink, drink_price, size, options, quantity, request, total_price })
--   조회:  await supabase.from('orders').select('*').order('created_at', { ascending: false })
--   취소:  await supabase.from('orders').delete().eq('id', 3)
--   전체:  await supabase.from('orders').delete().gte('id', 0)
-- ============================================================
