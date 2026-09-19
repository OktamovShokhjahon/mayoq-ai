import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import { Tenant } from "../tenants/tenant.model";
import { User, type UserDoc } from "../users/user.model";
import { Subscription } from "../subscriptions/subscription.model";
import type { JwtAccessPayload, Role } from "../../shared/types";

export interface RegisterClinicInput {
  clinicName: string;
  contactEmail?: string;
  adminFullName: string;
  adminEmail: string;
  password: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function issueAccessToken(user: Pick<UserDoc, "_id" | "tenantId" | "role" | "tokenVersion">): string {
  const payload: JwtAccessPayload = {
    sub: String(user._id),
    tenantId: String(user.tenantId),
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"],
  });
}

export function issueRefreshToken(user: Pick<UserDoc, "_id" | "tokenVersion">): string {
  return jwt.sign({ sub: String(user._id), tokenVersion: user.tokenVersion }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl as jwt.SignOptions["expiresIn"],
  });
}

export async function registerClinic(input: RegisterClinicInput) {
  const slug = slugify(input.clinicName) || new Types.ObjectId().toString();
  const existing = await Tenant.findOne({ slug });
  if (existing) {
    throw new HttpError(409, "A clinic with a similar name is already registered");
  }

  const tenant = await Tenant.create({
    name: input.clinicName,
    slug,
    contactEmail: input.contactEmail ?? input.adminEmail,
    status: "active",
    trialEndsAt: new Date(Date.now() + env.demoTrialDays * 24 * 60 * 60 * 1000),
  });

  const passwordHash = await hashPassword(input.password);
  const admin = await User.create({
    tenantId: tenant._id,
    role: "ADMIN" as Role,
    fullName: input.adminFullName,
    email: input.adminEmail,
    passwordHash,
    status: "active",
  });

  const subscription = await Subscription.create({
    tenantId: tenant._id,
    plan: "DEMO",
    state: "trialing",
    trialEndsAt: tenant.trialEndsAt,
  });

  tenant.subscriptionId = subscription._id;
  await tenant.save();

  return { tenant, admin, subscription };
}

export async function login(email: string, password: string, tenantSlug?: string) {
  const query: Record<string, unknown> = { email: email.toLowerCase() };
  if (tenantSlug) {
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) throw new HttpError(401, "Invalid credentials");
    query.tenantId = tenant._id;
  }

  const user = await User.findOne(query);
  if (!user) throw new HttpError(401, "Invalid credentials");
  if (user.status === "inactive") throw new HttpError(403, "Account is deactivated");

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) throw new HttpError(401, "Invalid credentials");

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user,
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user),
  };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { sub: string; tokenVersion: number };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as { sub: string; tokenVersion: number };
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion || user.status === "inactive") {
    throw new HttpError(401, "Refresh token no longer valid");
  }

  return {
    accessToken: issueAccessToken(user),
    refreshToken: issueRefreshToken(user),
  };
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "User not found");

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new HttpError(401, "Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  user.status = "active";
  user.tokenVersion += 1;
  await user.save();
}
