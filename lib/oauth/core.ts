import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients, oauthCodes, oauthTokens, otpChallenges, type OauthClient } from "@/lib/db/schema";

/*
 * A small OAuth 2.1 authorization server for the MCP endpoint.
 *
 * - Public clients only (Claude, ChatGPT): PKCE S256 is mandatory, no secrets.
 * - Clients register by dynamic client registration (RFC 7591) or identify
 *   themselves with an https client ID metadata document (CIMD).
 * - The user signs in with a one-time code sent to their WhatsApp number, so
 *   the verified phone becomes the identity attached to every token.
 * - Codes, OTPs and tokens are stored as SHA-256 hashes only.
 */

export const OAUTH_SCOPE = "orders";
export const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 90; // 90 days
export const AUTH_CODE_TTL_S = 5 * 60;
export const OTP_TTL_S = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
const CIMD_CACHE_MS = 24 * 3600_000;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const newSecret = (bytes = 32) => b64url(randomBytes(bytes));

/** The public origin of this deployment, behind Vercel's proxy. */
export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  return new URL(req.url).origin;
}

export const mcpResourceUrl = (origin: string) => `${origin}/api/mcp`;

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/`,
  };
}

/* ------------------------------------------------------------- clients */

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.hash;
  } catch {
    return false;
  }
}

/** Redirect URIs must be https, or http on loopback for local clients. */
export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return true;
    // Native app schemes (e.g. cursor://) are allowed; javascript:/data: are not.
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "file:", "http:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export async function registerClient(input: { clientName: string; redirectUris: string[] }): Promise<OauthClient> {
  const clientId = `mrk_${newSecret(18)}`;
  const [row] = await db
    .insert(oauthClients)
    .values({ clientId, clientName: input.clientName.slice(0, 100), redirectUris: input.redirectUris, kind: "dcr" })
    .returning();
  return row;
}

async function fetchClientMetadataDocument(clientId: string): Promise<{ clientName: string; redirectUris: string[] } | null> {
  try {
    const res = await fetch(clientId, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 20_000) return null;
    const doc = JSON.parse(text) as { client_id?: unknown; client_name?: unknown; redirect_uris?: unknown };
    if (doc.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
    const redirectUris = doc.redirect_uris.filter((u): u is string => typeof u === "string" && isAllowedRedirectUri(u));
    if (redirectUris.length === 0) return null;
    return { clientName: typeof doc.client_name === "string" ? doc.client_name : new URL(clientId).hostname, redirectUris };
  } catch {
    return null;
  }
}

/** Looks a client up, fetching (and caching) its metadata document when client_id is an https URL. */
export async function resolveClient(clientId: string): Promise<OauthClient | null> {
  if (!clientId || clientId.length > 500) return null;
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);

  if (!isHttpsUrl(clientId)) return row ?? null;

  const fresh = row && Date.now() - row.updatedAt.getTime() < CIMD_CACHE_MS;
  if (fresh) return row;

  const doc = await fetchClientMetadataDocument(clientId);
  if (!doc) return row ?? null;
  const [saved] = await db
    .insert(oauthClients)
    .values({ clientId, clientName: doc.clientName.slice(0, 100), redirectUris: doc.redirectUris, kind: "cimd" })
    .onConflictDoUpdate({
      target: oauthClients.clientId,
      set: { clientName: doc.clientName.slice(0, 100), redirectUris: doc.redirectUris, updatedAt: new Date() },
    })
    .returning();
  return saved;
}

/** Friendly label for the consent screen. */
export function clientLabel(client: OauthClient): string {
  const name = client.clientName || "";
  const all = `${name} ${client.redirectUris.join(" ")}`.toLowerCase();
  if (all.includes("claude")) return "Claude";
  if (all.includes("chatgpt") || all.includes("openai")) return "ChatGPT";
  return name || "an AI assistant";
}

/* ---------------------------------------------------- authorize requests */

export interface AuthorizeParams {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
  resource: string;
}

export type ValidatedAuthorize =
  | { ok: true; client: OauthClient; params: AuthorizeParams }
  | { ok: false; message: string; redirect?: string };

export function readAuthorizeParams(sp: Record<string, string | string[] | undefined>): AuthorizeParams {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return {
    responseType: one("response_type"),
    clientId: one("client_id"),
    redirectUri: one("redirect_uri"),
    codeChallenge: one("code_challenge"),
    codeChallengeMethod: one("code_challenge_method") || "plain",
    state: one("state"),
    scope: one("scope") || OAUTH_SCOPE,
    resource: one("resource"),
  };
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string): string {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

/**
 * Validates an authorization request. Problems with the client or redirect URI
 * are shown on our own page (never redirect to an unverified URI); everything
 * else is returned to the client as an OAuth error redirect.
 */
export async function validateAuthorize(params: AuthorizeParams): Promise<ValidatedAuthorize> {
  const client = await resolveClient(params.clientId);
  if (!client) return { ok: false, message: "This assistant is not registered. Remove the connector and add it again." };
  if (!client.redirectUris.includes(params.redirectUri)) {
    return { ok: false, message: "The sign-in link has an unknown return address. Remove the connector and add it again." };
  }
  const fail = (error: string, description: string): ValidatedAuthorize => ({
    ok: false,
    message: description,
    redirect: errorRedirect(params.redirectUri, error, description, params.state),
  });
  if (params.responseType !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (params.codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(params.codeChallenge)) {
    return fail("invalid_request", "PKCE with S256 is required.");
  }
  if (params.scope.split(/\s+/).some((s) => s && s !== OAUTH_SCOPE)) return fail("invalid_scope", `Only the "${OAUTH_SCOPE}" scope is available.`);
  if (params.state.length > 1000) return fail("invalid_request", "state is too long.");
  return { ok: true, client, params: { ...params, scope: OAUTH_SCOPE } };
}

/* ------------------------------------------------------------------- OTP */

const otpPepper = () => process.env.ADMIN_SESSION_SECRET ?? "";
const otpHash = (challengeId: string, code: string) => sha256(`${otpPepper()}:${challengeId}:${code}`);

/**
 * Directory reviewers (OpenAI, Anthropic) need a login that works without a
 * real WhatsApp inbox. OAUTH_REVIEW_PHONE + OAUTH_REVIEW_CODE give exactly one
 * number a fixed code; nothing is sent to it, and its orders are marked as tests.
 */
export function reviewAccount(): { phone: string; code: string } | null {
  const phone = process.env.OAUTH_REVIEW_PHONE?.trim();
  const code = process.env.OAUTH_REVIEW_CODE?.trim();
  return phone && code && /^\d{6}$/.test(code) ? { phone, code } : null;
}

export const isReviewPhone = (phone: string) => reviewAccount()?.phone === phone;

export async function createOtp(phone: string): Promise<{ challengeId: string; code: string }> {
  const review = reviewAccount();
  const code = review && review.phone === phone ? review.code : String(randomInt(0, 1_000_000)).padStart(6, "0");
  const [row] = await db
    .insert(otpChallenges)
    .values({ phone, codeHash: "pending", expiresAt: new Date(Date.now() + OTP_TTL_S * 1000) })
    .returning({ id: otpChallenges.id });
  await db.update(otpChallenges).set({ codeHash: otpHash(row.id, code) }).where(eq(otpChallenges.id, row.id));
  return { challengeId: row.id, code };
}

export type OtpCheck = { ok: true; phone: string } | { ok: false; message: string };

export async function verifyOtp(challengeId: string, code: string): Promise<OtpCheck> {
  if (!/^[0-9a-f-]{36}$/.test(challengeId) || !/^\d{6}$/.test(code)) return { ok: false, message: "Enter the 6-digit code." };
  const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  if (!row || row.consumedAt || !row.phone) return { ok: false, message: "This code has expired. Request a new one." };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, message: "This code has expired. Request a new one." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, message: "Too many wrong tries. Request a new code." };

  // Count the attempt before comparing, so parallel guesses cannot slip through.
  await db.update(otpChallenges).set({ attempts: row.attempts + 1 }).where(eq(otpChallenges.id, row.id));
  if (otpHash(row.id, code) !== row.codeHash) {
    const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, message: left > 0 ? `That code is not right. ${left} tries left.` : "Too many wrong tries. Request a new code." };
  }
  const consumed = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, row.id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  if (consumed.length === 0) return { ok: false, message: "This code was already used. Request a new one." };
  return { ok: true, phone: row.phone };
}

/* ----------------------------------------------------------- reverse OTP */

/*
 * Reverse OTP: instead of us sending a code (which needs a Meta
 * authentication template and business verification), the customer sends
 * "MARK LOGIN 12345678" to our WhatsApp number. The webhook matches the code
 * and records the sender's number, which WhatsApp itself has verified.
 *
 * A pending challenge has phone = "" until the message arrives.
 */
export const REVERSE_TTL_S = 10 * 60;
export const REVERSE_PREFIX = "MARK LOGIN";
const reverseHash = (code: string) => sha256(`${otpPepper()}:reverse:${code}`);

export async function createReverseOtp(): Promise<{ challengeId: string; code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(10_000_000, 100_000_000));
    const hash = reverseHash(code);
    const [clash] = await db
      .select({ id: otpChallenges.id })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.codeHash, hash), gt(otpChallenges.expiresAt, new Date())))
      .limit(1);
    if (clash) continue;
    const [row] = await db
      .insert(otpChallenges)
      .values({ phone: "", codeHash: hash, expiresAt: new Date(Date.now() + REVERSE_TTL_S * 1000) })
      .returning({ id: otpChallenges.id });
    return { challengeId: row.id, code };
  }
  throw new Error("Could not allocate a login code");
}

/** Pulls the code out of an inbound WhatsApp text, e.g. "MARK LOGIN 12345678". */
export function parseReverseCode(text: string): string | null {
  const m = text.toUpperCase().match(/MARK\s*LOGIN\D{0,3}(\d{8})\b/);
  return m ? m[1] : null;
}

/** Called by the WhatsApp webhook. Returns true when the code matched a pending login. */
export async function completeReverseOtp(code: string, phone: string): Promise<boolean> {
  const updated = await db
    .update(otpChallenges)
    .set({ phone })
    .where(
      and(
        eq(otpChallenges.codeHash, reverseHash(code)),
        eq(otpChallenges.phone, ""),
        isNull(otpChallenges.consumedAt),
        gt(otpChallenges.expiresAt, new Date()),
      ),
    )
    .returning({ id: otpChallenges.id });
  return updated.length > 0;
}

export type ReverseStatus = { state: "waiting" } | { state: "expired" } | { state: "verified"; phone: string };

/** Polled by the sign-in page. Consumes the challenge the first time it reports "verified". */
export async function claimReverseOtp(challengeId: string): Promise<ReverseStatus> {
  if (!/^[0-9a-f-]{36}$/.test(challengeId)) return { state: "expired" };
  const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return { state: "expired" };
  if (!row.phone) return { state: "waiting" };
  const consumed = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, row.id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  return consumed.length ? { state: "verified", phone: row.phone } : { state: "expired" };
}

/** Seconds until another code may be sent to this phone (one per 45 s). */
export async function otpCooldownSeconds(phone: string): Promise<number> {
  const [last] = await db
    .select({ createdAt: otpChallenges.createdAt })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, new Date(Date.now() - 45_000))))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  return last ? Math.max(1, 45 - Math.floor((Date.now() - last.createdAt.getTime()) / 1000)) : 0;
}

/* ------------------------------------------------- codes and tokens */

export async function issueAuthorizationCode(params: AuthorizeParams, phone: string): Promise<string> {
  const code = newSecret(32);
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    phone,
    scope: params.scope,
    resource: params.resource || null,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_S * 1000),
  });
  const u = new URL(params.redirectUri);
  u.searchParams.set("code", code);
  if (params.state) u.searchParams.set("state", params.state);
  return u.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function mintTokens(input: { clientId: string; phone: string; scope: string; resource: string | null }): Promise<TokenResponse> {
  const access = `mrk_at_${newSecret(32)}`;
  const refresh = `mrk_rt_${newSecret(32)}`;
  const now = Date.now();
  await db.insert(oauthTokens).values({
    accessHash: sha256(access),
    refreshHash: sha256(refresh),
    clientId: input.clientId,
    phone: input.phone,
    scope: input.scope,
    resource: input.resource,
    accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_S * 1000),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_S * 1000),
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope: input.scope };
}

export type TokenResult = { ok: true; body: TokenResponse } | { ok: false; error: string; description: string };

const pkceMatches = (verifier: string, challenge: string) =>
  /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && b64url(createHash("sha256").update(verifier).digest()) === challenge;

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource?: string;
}): Promise<TokenResult> {
  const bad = (description: string): TokenResult => ({ ok: false, error: "invalid_grant", description });
  const [row] = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, sha256(input.code))).limit(1);
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return bad("The authorization code is invalid or expired.");

  // Single use: claim it first, so a replay loses the race.
  const claimed = await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthCodes.codeHash, row.codeHash), isNull(oauthCodes.usedAt)))
    .returning({ codeHash: oauthCodes.codeHash });
  if (claimed.length === 0) return bad("The authorization code was already used.");

  if (row.clientId !== input.clientId) return bad("The code was issued to another client.");
  if (row.redirectUri !== input.redirectUri) return bad("redirect_uri does not match.");
  if (!pkceMatches(input.codeVerifier, row.codeChallenge)) return bad("code_verifier does not match.");
  if (input.resource && row.resource && input.resource !== row.resource) return bad("resource does not match.");

  return { ok: true, body: await mintTokens({ clientId: row.clientId, phone: row.phone, scope: row.scope, resource: row.resource }) };
}

export async function refreshAccessToken(input: { refreshToken: string; clientId: string }): Promise<TokenResult> {
  const bad = (description: string): TokenResult => ({ ok: false, error: "invalid_grant", description });
  const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.refreshHash, sha256(input.refreshToken))).limit(1);
  if (!row || row.revokedAt || row.refreshExpiresAt.getTime() < Date.now()) return bad("The refresh token is invalid or expired.");
  if (row.clientId !== input.clientId) return bad("The refresh token was issued to another client.");

  // Rotate: the old pair stops working the moment a new one is issued.
  const revoked = await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.id, row.id), isNull(oauthTokens.revokedAt)))
    .returning({ id: oauthTokens.id });
  if (revoked.length === 0) return bad("The refresh token was already used.");

  return { ok: true, body: await mintTokens({ clientId: row.clientId, phone: row.phone, scope: row.scope, resource: row.resource }) };
}

export async function revokeToken(token: string): Promise<void> {
  const hash = sha256(token);
  const now = new Date();
  await db.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.accessHash, hash), isNull(oauthTokens.revokedAt)));
  await db.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.refreshHash, hash), isNull(oauthTokens.revokedAt)));
}

export interface VerifiedAccess {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  extra: { phone: string };
}

export async function verifyAccessToken(token: string | undefined): Promise<VerifiedAccess | undefined> {
  if (!token || !token.startsWith("mrk_at_") || token.length > 200) return undefined;
  const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.accessHash, sha256(token))).limit(1);
  if (!row || row.revokedAt || row.accessExpiresAt.getTime() < Date.now()) return undefined;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 10 * 60_000) {
    await db.update(oauthTokens).set({ lastUsedAt: new Date() }).where(eq(oauthTokens.id, row.id));
  }
  return {
    token,
    clientId: row.clientId,
    scopes: row.scope.split(/\s+/).filter(Boolean),
    expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000),
    extra: { phone: row.phone },
  };
}
