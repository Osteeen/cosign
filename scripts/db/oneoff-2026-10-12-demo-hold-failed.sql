-- One-off (Oct 12, 2026): remove the two "PayPal could not open a budget hold"
-- lines from the DEMO account's activity log. They came from a seed run that
-- had no PayPal keys; nothing reached PayPal. activity_events is append-only
-- (trigger), so the trigger is switched off for this one statement only, inside
-- one transaction: if anything fails, everything rolls back and the trigger
-- stays on. Only the demo owner's HOLD_FAILED rows, and exactly two of them.
--   DATABASE_URL='<external url>?sslmode=verify-full' node scripts/db/run-sql.mjs scripts/db/oneoff-2026-10-12-demo-hold-failed.sql
BEGIN;
ALTER TABLE activity_events DISABLE TRIGGER activity_events_no_update_delete;
DO $$
DECLARE n integer;
BEGIN
  DELETE FROM activity_events WHERE owner_id = 'demo-owner' AND type = 'HOLD_FAILED';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected 2 demo HOLD_FAILED rows, found % - nothing deleted', n;
  END IF;
END $$;
ALTER TABLE activity_events ENABLE TRIGGER activity_events_no_update_delete;
COMMIT;
