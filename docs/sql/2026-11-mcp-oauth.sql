-- Tables for WhatsApp sign-in on the MCP connector (lib/oauth). Applied to production Neon on 2026-11-25.
-- Equivalent to `npm run db:push` for the oauth_* and otp_challenges tables in lib/db/schema.ts.
CREATE TABLE IF NOT EXISTS public.oauth_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    redirect_uris text[] DEFAULT '{}'::text[] NOT NULL,
    kind text DEFAULT 'dcr'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.oauth_codes (
    code_hash text NOT NULL,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    phone text NOT NULL,
    scope text DEFAULT ''::text NOT NULL,
    resource text,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_hash text NOT NULL,
    refresh_hash text NOT NULL,
    client_id text NOT NULL,
    phone text NOT NULL,
    scope text DEFAULT ''::text NOT NULL,
    resource text,
    access_expires_at timestamp with time zone NOT NULL,
    refresh_expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.otp_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.oauth_codes
    ADD CONSTRAINT oauth_codes_pkey PRIMARY KEY (code_hash);
ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.otp_challenges
    ADD CONSTRAINT otp_challenges_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_clients_client_id_idx ON public.oauth_clients USING btree (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_tokens_access_idx ON public.oauth_tokens USING btree (access_hash);
CREATE INDEX IF NOT EXISTS oauth_tokens_phone_idx ON public.oauth_tokens USING btree (phone);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_tokens_refresh_idx ON public.oauth_tokens USING btree (refresh_hash);
CREATE INDEX IF NOT EXISTS otp_challenges_phone_idx ON public.otp_challenges USING btree (phone, created_at);
