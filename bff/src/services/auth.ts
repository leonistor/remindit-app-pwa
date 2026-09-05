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
import { forToken, pb } from "../repositories/pocketbase"

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
    // Auth on a per-call client (never the shared `pb` singleton): the
    // singleton must stay anonymous so the next register's create still hits
    // the guest createRule (`@request.auth.id = ""`). Authing it here would
    // make every later registration 400 "Failed to create record" — the
    // singleton survived the first login with a now-rejected id.
    const client = forToken("")
    const auth = await client
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
