import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { Pool } from "pg";

const team = process.env.CF_ACCESS_TEAM_DOMAIN;
const audience = process.env.CF_ACCESS_AUD;
const jwks = team ? createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)) : null;
const pool = new Pool({ host: process.env.DB_HOST, database: "postcard", user: "identity_reader", password: process.env.DB_PASSWORD, max: 3 });

export type Identity = { id: string; email: string };

export const getIdentity = cache(async (): Promise<Identity> => {
  const token = (await headers()).get("cf-access-jwt-assertion");
  if (!token || !jwks || !team || !audience) throw new Error("Cloudflare Access identity is required");
  const { payload } = await jwtVerify(token, jwks, { issuer: `https://${team}`, audience });
  if (typeof payload.email !== "string") throw new Error("Cloudflare Access email is missing");
  const { rows } = await pool.query<Identity>(
    "select id, email from auth.users where lower(email) = lower($1) and enabled = true",
    [payload.email],
  );
  if (!rows[0]) throw new Error("This email is not enabled for Postcard Atlas");
  return rows[0];
});

export async function internalToken(userId: string): Promise<string> {
  const secret = process.env.API_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("API_JWT_SECRET must be at least 32 characters");
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}
