// Auth service (phase 3): register/login/me + the shared PB-record → public
// user projection used across services.
//
// Registration runs through the anonymous PB client and therefore PB's own
// `users.createRule` (open signup per the phase-2 schema). PB does not return
// a token on record create, so registration immediately authenticates.
import type {
  AuthResponse,
  LoginBody,
  RegisterBody,
  UserPublic,
} from "../contracts"
import { pb } from "../repositories/pocketbase"

export const toPublicUser = (record: Record<string, unknown>): UserPublic => ({
  id: record.id as string,
  email: (record.email as string) ?? "",
  username: (record.username as string) ?? "",
  firstName: (record.firstName as string) ?? "",
  lastName: (record.lastName as string) ?? "",
  avatar: (record.avatar as string) ?? "",
  role: record.role === "admin" ? "admin" : "user",
})

export const authService = {
  async register(body: RegisterBody): Promise<AuthResponse> {
    await pb.collection("users").create({
      username: body.username,
      email: body.email,
      password: body.password,
      passwordConfirm: body.passwordConfirm,
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      avatar: "",
    })
    // PB create does not return a token — authenticate to mint one.
    return authService.login({ email: body.email, password: body.password })
  },

  async login(body: LoginBody): Promise<AuthResponse> {
    const auth = await pb
      .collection("users")
      .authWithPassword(body.email, body.password)
    return {
      token: auth.token,
      user: toPublicUser(auth.record as unknown as Record<string, unknown>),
    }
  },

  /** Returns the validated user from the middleware's auth-refresh pass. */
  me(auth: { record: Record<string, unknown> }): UserPublic {
    return toPublicUser(auth.record)
  },
}
