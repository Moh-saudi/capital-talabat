// Only token/account failures mean a session is invalid. Provider permission,
// credential and network failures must remain server failures.
export function isInvalidIdentityError(error: unknown): boolean {
  const code = (error as {code?:unknown})?.code;
  return typeof code === 'string' && new Set([
    'auth/argument-error','auth/invalid-id-token','auth/id-token-expired',
    'auth/id-token-revoked','auth/user-disabled','auth/user-not-found',
  ]).has(code);
}
