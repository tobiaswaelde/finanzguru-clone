/** A source attempted to use a tool outside the explicit read allowlist. */
export class ForbiddenToolError extends Error {}
/** A source requires fresh owner authentication. */
export class AuthExpiredError extends Error {}
/** The upstream provider failed or returned unusable data. */
export class UpstreamError extends Error {}
/** The source is reserved but cannot fetch data yet. */
export class NotImplementedError extends Error {}
