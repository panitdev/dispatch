import { Configuration, FrontendApi } from "@ory/kratos-client";

const kratosPublicUrl =
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

/**
 * Singleton Kratos FrontendApi client.
 *
 * Browser: the session cookie is forwarded automatically.
 * Server component / route handler: pass `cookie` explicitly to each method.
 */
export const kratosClient = new FrontendApi(
  new Configuration({ basePath: kratosPublicUrl }),
);

export type { Identity, Session } from "@ory/kratos-client";
