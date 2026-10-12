-- The activity log is append-only: rows can be inserted, never changed or removed.
CREATE OR REPLACE FUNCTION activity_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_events is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER activity_events_no_update_delete
  BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION activity_events_append_only();
--> statement-breakpoint
CREATE TRIGGER activity_events_no_truncate
  BEFORE TRUNCATE ON activity_events
  FOR EACH STATEMENT EXECUTE FUNCTION activity_events_append_only();
