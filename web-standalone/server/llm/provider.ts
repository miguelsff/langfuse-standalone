import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogle } from "@ai-sdk/google";
import { createGoogleVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  assertSafeOutboundUrl,
  safeProviderFetch,
} from "@/server/security/outbound-url";

export type DecryptedConnection = {
  adapter: string;
  apiKey: string;
  baseUrl: string | null;
  headers: Record<string, string>;
  config: Record<string, unknown>;
};

const optionalString = (
  config: Record<string, unknown>,
  key: string,
): string | undefined =>
  typeof config[key] === "string" && config[key]
    ? (config[key] as string)
    : undefined;

export const createLanguageModel = async (
  connection: DecryptedConnection,
  modelId: string,
): Promise<LanguageModel> => {
  if (connection.baseUrl) {
    await assertSafeOutboundUrl(connection.baseUrl);
  }

  const common = {
    apiKey: connection.apiKey,
    baseURL: connection.baseUrl ?? undefined,
    headers: connection.headers,
    fetch: safeProviderFetch,
  };

  switch (connection.adapter) {
    case "OPENAI":
      return createOpenAI(common)(modelId);
    case "OPENAI_COMPATIBLE":
      if (!connection.baseUrl) {
        throw new Error("OpenAI-compatible connections require a base URL");
      }
      return createOpenAICompatible({
        ...common,
        baseURL: connection.baseUrl,
        name: optionalString(connection.config, "providerName") ?? "compatible",
        supportsStructuredOutputs: true,
      })(modelId);
    case "ANTHROPIC":
      return createAnthropic(common)(modelId);
    case "AZURE_OPENAI":
      return createAzure({
        ...common,
        resourceName: optionalString(connection.config, "resourceName"),
        apiVersion: optionalString(connection.config, "apiVersion"),
        useDeploymentBasedUrls:
          connection.config.useDeploymentBasedUrls === true,
      })(modelId);
    case "GOOGLE_AI":
      return createGoogle(common)(modelId);
    case "AMAZON_BEDROCK":
      return createAmazonBedrock({
        ...common,
        region: optionalString(connection.config, "region"),
        accessKeyId: optionalString(connection.config, "accessKeyId"),
        secretAccessKey: optionalString(
          connection.config,
          "secretAccessKey",
        ),
        sessionToken: optionalString(connection.config, "sessionToken"),
      })(modelId);
    case "GOOGLE_VERTEX":
      return createGoogleVertex({
        ...common,
        project: optionalString(connection.config, "project"),
        location: optionalString(connection.config, "location"),
      })(modelId);
    default:
      throw new Error(`Unsupported provider adapter: ${connection.adapter}`);
  }
};
