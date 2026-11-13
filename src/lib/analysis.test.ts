import { describe, expect, it } from "vitest";
import { analyzeFiles, type SourceFile } from "./analysis";

describe("analyzeFiles", () => {
  it("reports missing page titles and brief documentation", () => {
    const files: SourceFile[] = [{
      path: "README.md",
      content: "Tiny.",
    }];

    expect(analyzeFiles(files).map(({ type }) => type)).toEqual([
      "docs.missing-title",
      "docs.short-content",
    ]);
  });

  it("does not flag exported symbols mentioned in a sufficiently titled page", () => {
    const files: SourceFile[] = [
      {
        path: "docs/api.md",
        content: "# API reference\n\n" + "The createClient function configures requests and returns a client. ".repeat(3),
      },
      {
        path: "src/client.ts",
        content: "export function createClient() { return {}; }",
      },
    ];

    expect(analyzeFiles(files)).toEqual([]);
  });

  it("reports exported symbols when no Markdown page mentions them", () => {
    const files: SourceFile[] = [{
      path: "src/client.ts",
      content: "export const buildClient = () => ({});",
    }];

    expect(analyzeFiles(files)).toMatchObject([{
      type: "source.symbol-undocumented",
      path: "src/client.ts",
      severity: "medium",
    }]);
  });
});
