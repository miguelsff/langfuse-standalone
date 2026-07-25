import { type Observation } from "@langfuse/shared";

// unreachable code check

export function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here");
}

// primitive type checks

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

// non-primitive type checks

export type NestedObservation = any;

export type Event = Observation & {
  type: "EVENT";
};

export type Span = Observation & {
  type: "SPAN";
  endTime: Date; // not null
};

export type Generation = Observation & {
  type: "GENERATION";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelParameters: {
    [key: string]: string | number | boolean;
  };
};

export type Agent = Observation & {
  type: "AGENT";
};

export type Tool = Observation & {
  type: "TOOL";
};

export type Chain = Observation & {
  type: "CHAIN";
};

export type Retriever = Observation & {
  type: "RETRIEVER";
};

export type Evaluator = Observation & {
  type: "EVALUATOR";
};

export type Embedding = Observation & {
  type: "EMBEDDING";
};

export type Guardrail = Observation & {
  type: "GUARDRAIL";
};

// The standalone UI deliberately does not import Langfuse's server router.
// Components retain the same names while the JSON mock server supplies the
// runtime contracts.
export type RouterInput = any;
export type RouterOutput = any;

export const isUndefinedOrNull = <T>(val?: T | null): val is undefined | null =>
  val === undefined || val === null;

export const isNotNullOrUndefined = <T>(
  val?: T | null,
): val is Exclude<T, null | undefined> => !isUndefinedOrNull(val);
