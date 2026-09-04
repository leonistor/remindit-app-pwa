// API contracts (D8): Zod schemas are the published shape frontends consume
// through Hono RPC (`hc<AppType>`), and services return data that satisfies
// them — the compiler keeps both sides honest. Request bodies are validated
// with @hono/zod-validator; response shapes are what services construct.

import { z } from "zod"

// --- shared ------------------------------------------------------------------

export const usernameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "letters, digits, _ and - only")

export const userRoleSchema = z.enum(["user", "admin"])
export type UserRole = z.infer<typeof userRoleSchema>

export const userPublicSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatar: z.string(),
  role: userRoleSchema.optional(),
})
export type UserPublic = z.infer<typeof userPublicSchema>

export const errorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
})

// --- auth --------------------------------------------------------------------

export const registerBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
    username: usernameSchema,
    firstName: z.string().max(64).optional(),
    lastName: z.string().max(64).optional(),
  })
  .refine((body) => body.password === body.passwordConfirm, {
    message: "passwords do not match",
    path: ["passwordConfirm"],
  })
export type RegisterBody = z.infer<typeof registerBodySchema>

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginBody = z.infer<typeof loginBodySchema>

export const authResponseSchema = z.object({
  token: z.string(),
  user: userPublicSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

// PB record timestamps, as-is from the wire.
const recordStamps = z.object({
  created: z.string().optional(),
  updated: z.string().optional(),
})

// --- groups ------------------------------------------------------------------

export const groupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    owner: z.string(),
  })
  .merge(recordStamps)
export type Group = z.infer<typeof groupSchema>

export const groupCreateBodySchema = z.object({
  name: z.string().min(1).max(120),
})
export type GroupCreateBody = z.infer<typeof groupCreateBodySchema>

export const memberRoleSchema = z.enum(["owner", "member"])
export type MemberRole = z.infer<typeof memberRoleSchema>

export const memberSchema = z.object({
  id: z.string(),
  role: memberRoleSchema,
  group: z.string(),
  user: userPublicSchema,
})
export type Member = z.infer<typeof memberSchema>

export const memberInviteBodySchema = z.object({
  userId: z.string().min(1),
  role: memberRoleSchema,
})
export type MemberInviteBody = z.infer<typeof memberInviteBodySchema>

// Username → userId resolution for the invite flow (GET /api/users/lookup).
// The response reuses userPublicSchema; the service masks email to "" (same
// precedent as team_member_details rows — UserPublic allows it).
export const userLookupQuerySchema = z.object({
  username: usernameSchema,
})
export type UserLookupQuery = z.infer<typeof userLookupQuerySchema>

// --- notifications (reserved, D4 — list + mark-read only for now) ------------

export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
  read: z.boolean(),
  user: z.string(),
  group: z.string().optional(),
})
export type Notification = z.infer<typeof notificationSchema>

export const notificationMarkReadBodySchema = z.object({
  read: z.boolean(),
})
export type NotificationMarkReadBody = z.infer<
  typeof notificationMarkReadBodySchema
>

// --- admin (phase 6) — role-guarded server-side endpoints ---------------------

export const adminOverviewSchema = z.object({
  users: z.number().int().nonnegative(),
  groups: z.number().int().nonnegative(),
  items: z.number().int().nonnegative(),
  listEntries: z.number().int().nonnegative(),
  historyEvents: z.number().int().nonnegative(),
})
export type AdminOverview = z.infer<typeof adminOverviewSchema>

export const adminUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    avatar: z.string(),
    role: userRoleSchema,
  })
  .merge(recordStamps)
export type AdminUser = z.infer<typeof adminUserSchema>

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int().nonnegative(),
})
export type AdminUserPage = z.infer<typeof adminUserPageSchema>

export const adminUserCreateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: usernameSchema,
  role: userRoleSchema,
  firstName: z.string().max(64).optional(),
  lastName: z.string().max(64).optional(),
})
export type AdminUserCreateBody = z.infer<typeof adminUserCreateBodySchema>

export const adminGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    owner: z.string(),
    ownerUsername: z.string().optional(),
    membersCount: z.number().int().nonnegative(),
  })
  .merge(recordStamps)
export type AdminGroup = z.infer<typeof adminGroupSchema>

// --- feedback (phase 5) — the Answer sidecar bridge --------------------------

export const feedbackTagSchema = z.enum([
  "bug",
  "feature-request",
  "discussion",
])
export type FeedbackTag = z.infer<typeof feedbackTagSchema>

export const feedbackFromModuleSchema = z.enum(["pwa", "web"])
export type FeedbackFromModule = z.infer<typeof feedbackFromModuleSchema>

export const feedbackSubmitBodySchema = z.object({
  subject: z.string().min(6).max(150),
  text: z.string().min(6).max(5000),
  tag: feedbackTagSchema,
  fromModule: feedbackFromModuleSchema,
  route: z.string().max(300).optional(),
})
export type FeedbackSubmitBody = z.infer<typeof feedbackSubmitBodySchema>

export const feedbackGuestBodySchema = z.object({
  subject: z.string().min(6).max(150),
  text: z.string().min(6).max(5000),
  tag: feedbackTagSchema,
  contactEmail: z.string().email().optional(),
})
export type FeedbackGuestBody = z.infer<typeof feedbackGuestBodySchema>

export const feedbackResponseSchema = z.object({ questionUrl: z.string() })
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>

// --- stats (public, aggregate-only — marketing site, phase 4) -----------------

export const statsSchema = z.object({
  users: z.number().int().nonnegative(),
  groups: z.number().int().nonnegative(),
})
export type Stats = z.infer<typeof statsSchema>

// --- health ------------------------------------------------------------------

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("remindit-bff"),
  pb: z.object({
    status: z.enum(["up", "down"]),
  }),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
