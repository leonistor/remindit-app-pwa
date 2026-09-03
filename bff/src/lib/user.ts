import type { UserPublic } from "../contracts"

export const toPublicUser = (
  record: Record<string, unknown>,
  opts?: { maskEmail?: boolean }
): UserPublic => ({
  id: record.id as string,
  email: opts?.maskEmail ? "" : ((record.email as string) ?? ""),
  username: (record.username as string) ?? "",
  firstName: (record.firstName as string) ?? "",
  lastName: (record.lastName as string) ?? "",
  avatar: (record.avatar as string) ?? "",
  role: record.role === "admin" ? "admin" : "user",
})
