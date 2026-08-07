/*
  Fix RLS infinite recursion ("stack depth limit exceeded").

  The organization_directory_scope policy on `organizations` evaluates
  `id = default_organization_id()`. That function queries `organizations`,
  but because it is SECURITY INVOKER (the default), the query is subject to
  the same RLS policy, which calls default_organization_id() again → infinite
  recursion.

  Making the function SECURITY DEFINER lets it read the organizations row while
  bypassing RLS, exactly like the already-SECURITY-DEFINER is_organization_member().
*/

CREATE OR REPLACE FUNCTION default_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM organizations WHERE slug = 'default' LIMIT 1;
$$;

