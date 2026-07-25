import { createElement, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueries as useReactQueries,
  useInfiniteQuery as useReactInfiniteQuery,
  useMutation as useReactMutation,
  useQuery as useReactQuery,
  useQueryClient,
} from "@tanstack/react-query";

/**
 * The product UI is intentionally kept on Langfuse's original tRPC surface.
 * This file is the only seam that changes for the standalone replica: the
 * same `api.foo.bar.useQuery()` calls now resolve against the JSON mock server.
 */

const MOCK_ENDPOINT = "/api/mock";
const queryKeyFor = (path: string, input?: unknown) => ["mock", path, input];

function reviveMockDates(value: any): any {
  if (Array.isArray(value)) return value.map(reviveMockDates);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, reviveMockDates(entry)]),
  );
}

async function callMock(path: string, input?: unknown): Promise<any> {
  const response = await fetch(
    `${MOCK_ENDPOINT}?path=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Mock procedure failed: ${path}`);
  }

  const data = reviveMockDates(payload?.data);
  if (
    data &&
    typeof data === "object" &&
    data.commentCounts &&
    !(data.commentCounts instanceof Map)
  ) {
    data.commentCounts = new Map(Object.entries(data.commentCounts));
  }
  return data;
}

function cleanOptions(options: Record<string, any> | undefined) {
  if (!options) return {};
  const { queryKey: _queryKey, queryFn: _queryFn, mutationFn: _mutationFn, ...rest } = options;
  return rest;
}

function makeProcedure(path: string): any {
  const procedure = (...args: any[]) => ({
    queryKey: queryKeyFor(path, args[0]),
    queryFn: () => callMock(path, args[0]),
    ...cleanOptions(args[1]),
  });

    Object.defineProperties(procedure, {
      useQuery: {
      value: (input?: unknown, options?: Record<string, any>) => {
        const queryOptions = cleanOptions(options);
        // A small optimistic seed prevents SSR-only onboarding components
        // from executing browser-only code before the mock request resolves.
        // The JSON response remains authoritative immediately after mount.
        if (
          queryOptions.initialData === undefined &&
          (path === "traces.hasTracingConfigured" || path === "prompts.hasAny")
        ) {
          queryOptions.initialData = true;
        }
        // The hook is intentionally invoked from a Proxy property that
        // mirrors tRPC's generated `useQuery` member.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useReactQuery({
          queryKey: queryKeyFor(path, input),
          queryFn: () => callMock(path, input),
          networkMode: "always",
          ...queryOptions,
        }) as any;
      },
    },
    useInfiniteQuery: {
      value: (input?: unknown, options?: Record<string, any>) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useReactInfiniteQuery({
          queryKey: queryKeyFor(path, input),
          queryFn: ({ pageParam }) =>
            callMock(path, {
              ...(input && typeof input === "object" ? input : {}),
              ...(pageParam && typeof pageParam === "object" ? pageParam : {}),
              cursor: pageParam,
            }),
          initialPageParam: options?.initialPageParam ?? undefined,
          getNextPageParam: (lastPage: any) => lastPage?.meta?.nextPage,
          networkMode: "always",
          ...cleanOptions(options),
        }) as any,
    },
    useMutation: {
      value: (options?: Record<string, any>) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useReactMutation({
          ...cleanOptions(options),
          mutationFn: (input: unknown) => callMock(path, input),
          networkMode: "always",
        }) as any,
    },
    query: {
      value: (input?: unknown) => callMock(path, input),
    },
    mutate: {
      value: (input?: unknown) => callMock(path, input),
    },
  });

  return procedure;
}

function makeApiProxy(prefix = ""): any {
  const target = function () {
    return undefined;
  };

  return new Proxy(target, {
    get(_target, property: string | symbol) {
      if (typeof property === "symbol") return undefined;

      if (property === "useUtils" && prefix === "") {
        return () => {
          const queryClient = useQueryClient();
          return makeUtilsProxy(queryClient);
        };
      }

      if (property === "withTRPC" && prefix === "") {
        return withTRPC;
      }

      if (prefix && property === "useQuery") {
        return (input?: unknown, options?: Record<string, any>) =>
          makeProcedure(prefix).useQuery(input, options);
      }

      if (prefix && property === "useInfiniteQuery") {
        return (input?: unknown, options?: Record<string, any>) =>
          makeProcedure(prefix).useInfiniteQuery(input, options);
      }

      if (prefix && property === "useMutation") {
        return (options?: Record<string, any>) =>
          makeProcedure(prefix).useMutation(options);
      }

      if (prefix && (property === "query" || property === "mutate")) {
        return (input?: unknown) => callMock(prefix, input);
      }

      if (property === "useQueries" && prefix === "") {
        return (builder: (t: any) => any[], options?: Record<string, any>) => {
          const queries = builder(makeCallableBuilder());
          return useReactQueries({
            queries,
            ...cleanOptions(options),
          } as any) as any;
        };
      }

      const path = prefix ? `${prefix}.${property}` : property;
      return makeApiProxy(path);
    },
    apply(_target, _thisArg, args) {
      return makeProcedure(prefix)(...args);
    },
  });
}

function makeCallableBuilder(prefix = ""): any {
  const target = function (...args: any[]) {
    return makeProcedure(prefix)(...args);
  };

  return new Proxy(target, {
    get(_target, property: string | symbol) {
      if (typeof property === "symbol") return undefined;
      return makeCallableBuilder(prefix ? `${prefix}.${property}` : property);
    },
    apply(_target, _thisArg, args) {
      return makeProcedure(prefix)(...args);
    },
  });
}

function makeUtilsProxy(queryClient: QueryClient, prefix = ""): any {
  const target = function () {
    return undefined;
  };

  return new Proxy(target, {
    get(_target, property: string | symbol) {
      if (typeof property === "symbol") return undefined;
      if (["invalidate", "cancel", "getData", "setData", "prefetch", "fetch", "reset"].includes(property)) {
        if (property === "getData") {
          return (input?: unknown) => queryClient.getQueryData(queryKeyFor(prefix, input));
        }
        if (property === "setData") {
          return (input?: unknown, updater?: unknown) =>
            queryClient.setQueryData(queryKeyFor(prefix, input), updater as any);
        }
        return async (input?: unknown) => {
          const key = queryKeyFor(prefix, input);
          if (property === "invalidate") return queryClient.invalidateQueries({ queryKey: key });
          if (property === "cancel") return queryClient.cancelQueries({ queryKey: key });
          if (property === "prefetch") {
            return queryClient.prefetchQuery({ queryKey: key, queryFn: () => callMock(prefix, input) });
          }
          if (property === "fetch") {
            return queryClient.fetchQuery({ queryKey: key, queryFn: () => callMock(prefix, input) });
          }
          return queryClient.resetQueries({ queryKey: key });
        };
      }

      return makeUtilsProxy(queryClient, prefix ? `${prefix}.${property}` : property);
    },
  });
}

function MockApiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 30_000, networkMode: "always" },
          mutations: { retry: false, networkMode: "always" },
        },
      }),
  );

  return createElement(QueryClientProvider, { client: queryClient }, children);
}

export const api: any = makeApiProxy();

export const directApi: any = makeApiProxy();

export const sendAsPostOption = {
  trpc: { context: { sendAsPost: true } },
} as const;

export const getPathnameWithoutBasePath = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
};

export const EXPECTED_TRPC_ERROR_CODES = [
  "NOT_FOUND",
  "FORBIDDEN",
  "UNAUTHORIZED",
] as const;

export const getTrpcErrorCode = (error: unknown): string | undefined =>
  error instanceof Error ? error.name : undefined;

export const getTrpcErrorPath = (): string | undefined => undefined;
export const isExpectedTrpcClientError = (): boolean => false;
export const isNetworkConnectivityError = (): boolean => false;

export type APIError = Error & {
  data?: { code?: string };
};
export type RouterInputs = any;
export type RouterOutputs = any;

export function withTRPC<T extends React.ComponentType<any>>(Component: T) {
  return function MockApiWrappedApp(props: React.ComponentProps<T>) {
    return createElement(MockApiProvider, null, createElement(Component, props));
  };
}

api.withTRPC = withTRPC;
