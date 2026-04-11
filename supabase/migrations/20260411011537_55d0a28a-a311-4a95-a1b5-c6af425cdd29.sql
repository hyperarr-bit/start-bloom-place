
-- Add AbacatePay-specific columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS abacatepay_billing_id text,
ADD COLUMN IF NOT EXISTS customer_email text;

-- Allow service role to insert/update subscriptions (for webhook)
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
