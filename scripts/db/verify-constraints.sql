-- Proves the database itself refuses the things that must never happen.
-- Runs in one transaction and ROLLS BACK, so the database is left unchanged.
--   psql -v ON_ERROR_STOP=1 -d cosign_dev -f scripts/db/verify-constraints.sql

\pset tuples_only on
\pset format unaligned
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, stmt text, want_sqlstate text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE refused boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN others THEN
    IF SQLSTATE = want_sqlstate THEN
      refused := true;
    ELSE
      RAISE EXCEPTION 'FAIL %: expected SQLSTATE %, got % (%)', label, want_sqlstate, SQLSTATE, SQLERRM;
    END IF;
  END;
  IF NOT refused THEN
    RAISE EXCEPTION 'FAIL %: statement was allowed', label;
  END IF;
  RAISE NOTICE 'ok  %', label;
END;
$$;

-- Fixtures: two owners, one agent each, two stores, a slip on store 1 with one hold.
INSERT INTO users (id, email) VALUES ('owner-1', 'one@example.test'), ('owner-2', 'two@example.test');
INSERT INTO agents (id, owner_id, name) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'owner-1', 'Agent 1'),
  ('00000000-0000-0000-0000-00000000a002', 'owner-2', 'Agent 2');
INSERT INTO stores (id, name, categories, paypal_merchant_id, paypal_tracking_id) VALUES
  ('00000000-0000-0000-0000-00000000b001', 'Store 1', '{office_supplies}', 'TESTMERCH1', 'track-1'),
  ('00000000-0000-0000-0000-00000000b002', 'Store 2', '{office_supplies}', 'TESTMERCH2', 'track-2');
INSERT INTO slips (id, owner_id, agent_id, status, period_days, period_budget_cents, per_purchase_max_cents,
                   approve_above_cents, categories, source_text, current_period_starts_at, current_period_ends_at)
VALUES ('00000000-0000-0000-0000-00000000c001', 'owner-1', '00000000-0000-0000-0000-00000000a001', 'ACTIVE',
        28, 20000, 10000, 5000, '{office_supplies}', 'test', now(), now() + interval '28 days');
INSERT INTO slip_stores (slip_id, store_id, allocation_cents)
VALUES ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 20000);
INSERT INTO holds (id, owner_id, slip_id, store_id, period_index, status, amount_cents)
VALUES ('00000000-0000-0000-0000-00000000d001', 'owner-1', '00000000-0000-0000-0000-00000000c001',
        '00000000-0000-0000-0000-00000000b001', 0, 'ACTIVE', 5000);
INSERT INTO spend_requests (id, owner_id, agent_id, slip_id, store_id, hold_id, items, total_cents, currency,
                            purpose, cart_hash, status, decision, idempotency_key, request_hash)
VALUES ('00000000-0000-0000-0000-00000000e001', 'owner-1', '00000000-0000-0000-0000-00000000a001',
        '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001',
        '00000000-0000-0000-0000-00000000d001', '[]', 1000, 'USD', 'paper', 'h', 'COMPLETED', '{}', 'idem-key-0000001', 'r');
INSERT INTO activity_events (owner_id, type, summary) VALUES ('owner-1', 'SLIP_CREATED', 'test event');

-- Money
SELECT pg_temp.expect('hold cannot capture beyond its amount',
  $q$UPDATE holds SET captured_cents = 4000, reserved_cents = 1001 WHERE id = '00000000-0000-0000-0000-00000000d001'$q$, '23514');
SELECT pg_temp.expect('hold amounts cannot go negative',
  $q$UPDATE holds SET reserved_cents = -1 WHERE id = '00000000-0000-0000-0000-00000000d001'$q$, '23514');
SELECT pg_temp.expect('budget period cannot exceed 28 days',
  $q$UPDATE slips SET period_days = 29 WHERE id = '00000000-0000-0000-0000-00000000c001'$q$, '23514');
SELECT pg_temp.expect('only USD',
  $q$UPDATE slips SET currency = 'EUR' WHERE id = '00000000-0000-0000-0000-00000000c001'$q$, '23514');
SELECT pg_temp.expect('spend total must be positive',
  $q$UPDATE spend_requests SET total_cents = 0 WHERE id = '00000000-0000-0000-0000-00000000e001'$q$, '23514');

-- Duplicates
SELECT pg_temp.expect('same agent idempotency key cannot be stored twice',
  $q$INSERT INTO spend_requests (owner_id, agent_id, store_id, items, total_cents, currency, purpose, cart_hash, status,
       decision, idempotency_key, request_hash)
     VALUES ('owner-1', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001', '[]', 500, 'USD',
       'dup', 'h', 'DENIED', '{}', 'idem-key-0000001', 'r2')$q$, '23505');
SELECT pg_temp.expect('one live slip per agent',
  $q$INSERT INTO slips (owner_id, agent_id, status, period_days, period_budget_cents, per_purchase_max_cents,
       approve_above_cents, categories, source_text, current_period_starts_at, current_period_ends_at)
     VALUES ('owner-1', '00000000-0000-0000-0000-00000000a001', 'AWAITING_HOLDS', 7, 1000, 500, 100,
       '{office_supplies}', 'second', now(), now() + interval '7 days')$q$, '23505');
SELECT pg_temp.expect('one live hold per store per period',
  $q$INSERT INTO holds (owner_id, slip_id, store_id, period_index, amount_cents)
     VALUES ('owner-1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 0, 1000)$q$, '23505');

-- Owner isolation (IDOR at the database level)
SELECT pg_temp.expect('slip cannot use another owner''s agent',
  $q$INSERT INTO slips (owner_id, agent_id, status, period_days, period_budget_cents, per_purchase_max_cents,
       approve_above_cents, categories, source_text, current_period_starts_at, current_period_ends_at)
     VALUES ('owner-2', '00000000-0000-0000-0000-00000000a001', 'ENDED', 7, 1000, 500, 100, '{office_supplies}', 'x',
       now(), now() + interval '7 days')$q$, '23503');
SELECT pg_temp.expect('hold cannot attach to another owner''s slip',
  $q$INSERT INTO holds (owner_id, slip_id, store_id, period_index, amount_cents)
     VALUES ('owner-2', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 1, 1000)$q$, '23503');
SELECT pg_temp.expect('spend request cannot use another owner''s hold',
  $q$INSERT INTO spend_requests (owner_id, agent_id, store_id, hold_id, items, total_cents, currency, purpose, cart_hash,
       status, decision, idempotency_key, request_hash)
     VALUES ('owner-2', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000b001',
       '00000000-0000-0000-0000-00000000d001', '[]', 500, 'USD', 'x', 'h', 'DENIED', '{}', 'idem-key-0000002', 'r')$q$, '23503');
SELECT pg_temp.expect('approval cannot point at another owner''s request',
  $q$INSERT INTO approvals (owner_id, spend_request_id, cart_hash, total_cents, expires_at)
     VALUES ('owner-2', '00000000-0000-0000-0000-00000000e001', 'h', 1000, now() + interval '1 hour')$q$, '23503');
SELECT pg_temp.expect('activity cannot reference another owner''s agent',
  $q$INSERT INTO activity_events (owner_id, agent_id, type, summary)
     VALUES ('owner-2', '00000000-0000-0000-0000-00000000a001', 'X', 'x')$q$, '23503');
SELECT pg_temp.expect('hold store must be on the slip',
  $q$INSERT INTO holds (owner_id, slip_id, store_id, period_index, amount_cents)
     VALUES ('owner-1', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002', 0, 1000)$q$, '23503');

-- Append-only activity log
SELECT pg_temp.expect('activity log cannot be updated',
  $q$UPDATE activity_events SET summary = 'changed'$q$, '42501');
SELECT pg_temp.expect('activity log cannot be deleted',
  $q$DELETE FROM activity_events$q$, '42501');
SELECT pg_temp.expect('activity log cannot be truncated',
  $q$TRUNCATE activity_events$q$, '42501');

ROLLBACK;
