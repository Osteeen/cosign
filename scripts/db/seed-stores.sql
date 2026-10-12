-- The two Cosign demo stores, onboarded through PayPal Partner Referrals in the
-- sandbox on 2026-10-09. Safe to run more than once.
--   psql -X -q -d cosign_dev -f scripts/db/seed-stores.sql

INSERT INTO stores (name, categories, website, paypal_merchant_id, paypal_tracking_id, payments_receivable)
VALUES
  ('Paper Co', '{office_supplies}', '/shop/paper-co', 'BN6SH9J6J47X6', 'cosign-store1-1791504332178', true),
  ('Bean Supply', '{groceries,food_and_drink}', '/shop/bean-supply', 'DJFTWTJ7DFNG4', 'cosign-store2-1791504334738', true)
ON CONFLICT (paypal_merchant_id) DO UPDATE SET website = EXCLUDED.website;
-- website: the demo store's pages in this app (src/lib/demo/catalog.ts); relative to the app URL.
