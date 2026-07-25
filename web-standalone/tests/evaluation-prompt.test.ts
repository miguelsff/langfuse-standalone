import { describe, expect, it } from "vitest";
import { renderEvaluationPrompt } from "@/server/evaluations/prompt";

describe("evaluation prompt rendering", () => {
  it("resolves direct and mapped dotted paths", () => {
    const prompt = renderEvaluationPrompt(
      "Input: {{input.text}}\nAnswer: {{answer}}",
      { input: { text: "Hello" }, output: { value: 42 } },
      { answer: "output.value" },
    );
    expect(prompt).toBe("Input: Hello\nAnswer: 42");
  });
});
