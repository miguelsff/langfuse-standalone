import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type MockRecord = Record<string, any> & { id?: string };

export const mockRecordSchema = z.record(z.string(), z.unknown());

export const mockBundleSchema = z.record(z.string(), z.unknown());

export type MockBundle = Record<string, unknown>;

export type MockDataStore = Record<string, MockRecord[]> & {
  sourceFiles: string[];
};
