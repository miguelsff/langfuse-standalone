import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { getDatabase } from "@/server/db";
import { LocalStateRepository } from "@/server/repositories/local-state";
import { getEvaluationRunner } from "@/server/evaluations/runner";

export const createTRPCContext = async () => {
  const database = await getDatabase();
  void getEvaluationRunner().initialize();
  return {
    database,
    state: new LocalStateRepository(database),
    projectId: "local" as const,
    userId: "local-user" as const,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
