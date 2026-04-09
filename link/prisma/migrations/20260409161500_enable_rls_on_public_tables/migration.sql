-- Supabase exposes the public schema through its Data API.
-- Enable RLS on the Prisma-managed public tables so the Security Advisor
-- no longer flags them as publicly accessible without row-level protection.
--
-- This app reads and writes through server-side Prisma connections rather
-- than the browser Data API, so we intentionally do not add anon/authenticated
-- policies here. With RLS enabled and no policies, direct Data API access is
-- denied by default while Prisma can continue using its privileged database role.

ALTER TABLE public."Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Response" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
