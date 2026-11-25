-- Staff operational access and database security/performance improvements.
-- This migration is committed to the feature branch only and is NOT applied
-- to the live Supabase project by this change.

REVOKE ALL PRIVILEGES ON TABLE
  public.categories, public.customers, public.sales, public.sale_items,
  public.invoices, public.invoice_items, public.stock_transactions,
  public.payments, public.expenses, public.products, public.pathao_parcels,
  public.pathao_status_history, public.profiles
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.categories, public.customers, public.sales, public.sale_items,
  public.invoices, public.invoice_items, public.stock_transactions,
  public.payments, public.expenses, public.products
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.pathao_parcels, public.pathao_status_history
TO authenticated;

DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','customers','sales','sale_items','invoices','invoice_items',
    'stock_transactions','payments','expenses','products'
  ] LOOP
    policy_name := 'Owner admin staff manage ' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Owner and admin can manage ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (get_my_role() = ANY (ARRAY[''owner'',''admin'',''staff''])) WITH CHECK (get_my_role() = ANY (ARRAY[''owner'',''admin'',''staff'']))',
      policy_name, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read Pathao parcels" ON public.pathao_parcels;
CREATE POLICY "Active staff can read Pathao parcels"
  ON public.pathao_parcels FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['owner','admin','staff']));
CREATE POLICY "Owner can insert Pathao parcels"
  ON public.pathao_parcels FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can update Pathao parcels"
  ON public.pathao_parcels FOR UPDATE TO authenticated
  USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can delete Pathao parcels"
  ON public.pathao_parcels FOR DELETE TO authenticated
  USING (get_my_role() = 'owner');

DROP POLICY IF EXISTS "Authenticated users can read Pathao status history" ON public.pathao_status_history;
CREATE POLICY "Active staff can read Pathao status history"
  ON public.pathao_status_history FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['owner','admin','staff']));
CREATE POLICY "Owner can insert Pathao status history"
  ON public.pathao_status_history FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can update Pathao status history"
  ON public.pathao_status_history FOR UPDATE TO authenticated
  USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can delete Pathao status history"
  ON public.pathao_status_history FOR DELETE TO authenticated
  USING (get_my_role() = 'owner');

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owner can manage profiles" ON public.profiles;
CREATE POLICY "Users can read own profile or owner can read all"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR get_my_role() = 'owner');
CREATE POLICY "Owner can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "Owner can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (get_my_role() = 'owner');

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_pathao_status_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items (product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_pathao_status_history_sale_id ON public.pathao_status_history (sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items (product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_user_id ON public.stock_transactions (user_id);
