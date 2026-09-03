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
import { toPublicUser } from "../lib/user"
import { pb } from "../repositories/pocketbase"
import { feedbackService } from "./feedback"

export const authService = {
  async register(body: RegisterBody): Promise<AuthResponse> {
    const created = await pb.collection("users").create({
      username: body.username,
      email: body.email,
      password: body.password,
      passwordConfirm: body.passwordConfirm,
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      avatar: "",
    })
    // One-way feedback bridge — awaited (not fire-and-forget): PB record
    // PATCHes are load-merge-write, so a provisioning update racing a
    // subsequent same-record update loses fields (seen as wiped role fields in
    // the admin integration suite). Non-fatal inside — an Answer outage never
    // fails registration (the backfill script covers skipped users later).
    // The email is passed explicitly: PB hides it on create responses.
    await feedbackService.provisionQuietly(created, { email: body.email })
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

  /** Returns the validated user from the auth middleware's auth context. */
  me(auth: {
    record: () => Promise<Record<string, unknown>>
  }): Promise<UserPublic> {
    return auth.record().then(toPublicUser)
  },
}
