-- ============================================================
-- 테스트용 주문 1건 입력 (schema.sql 실행 후 사용)
-- ============================================================

insert into public.orders (name, phone, drink, size, options, quantity, request, price)
values (
  '홍길동',
  '010-1234-5678',
  '카페라떼',
  'M',
  array['샷 추가'],          -- 옵션이 없으면 '{}' 또는 array[]::text[]
  1,
  '얼음 적게 해주세요',
  5000                       -- (4,000 + M 500 + 샷 500) × 1잔
);

-- 확인: 최신 주문부터 조회
select * from public.orders order by created_at desc;

-- 테스트 데이터 삭제가 필요할 때
-- delete from public.orders where name = '홍길동' and phone = '010-1234-5678';
