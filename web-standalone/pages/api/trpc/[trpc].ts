import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/router";
import { createTRPCContext } from "@/server/trpc";

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    process.env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(`tRPC failed on ${path ?? "unknown"}: ${error.message}`);
        }
      : undefined,
});
