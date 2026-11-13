import { unified } from "unified";
import remarkParse from "remark-parse";
import ts from "typescript";

export type SourceFile = {
  path: string;
  content: string;
};

export type Finding = {
  path: string | null;
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
};

type MarkdownNode = {
  type: string;
  value?: string;
  depth?: number;
  children?: MarkdownNode[];
};

function textFromNode(node: MarkdownNode): string {
  return `${node.value ?? ""} ${(node.children ?? []).map(textFromNode).join(" ")}`.trim();
}

function parseMarkdown(file: SourceFile): { text: string; headings: string[]; hasTitle: boolean } {
  const tree = unified().use(remarkParse).parse(file.content) as MarkdownNode;
  const headings: string[] = [];
  const hasTitle = tree.children?.some((child) =>
    child.type === "heading" && child.depth === 1 && textFromNode(child).length > 0,
  ) ?? false;

  const walk = (node: MarkdownNode) => {
    if (node.type === "heading") headings.push(textFromNode(node));
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);

  return { text: textFromNode(tree), headings, hasTitle };
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node)?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword,
    ) ?? false);
}

function getExportedSymbols(file: SourceFile): string[] {
  const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
  const symbols: string[] = [];

  for (const statement of source.statements) {
    if (!isExported(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) symbols.push(declaration.name.text);
      }
    } else if (
      ts.isFunctionDeclaration(statement)
      || ts.isClassDeclaration(statement)
      || ts.isInterfaceDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement)
      || ts.isEnumDeclaration(statement)
    ) {
      if (statement.name) symbols.push(statement.name.text);
    }
  }

  return symbols;
}

export function analyzeFiles(files: SourceFile[]): Finding[] {
  const markdownFiles = files.filter(({ path }) => /\.mdx?$/i.test(path));
  const sourceFiles = files.filter(({ path }) => /\.[jt]sx?$/i.test(path) && !/\.d\.ts$/i.test(path));
  const parsedMarkdown = markdownFiles.map((file) => ({
    file,
    ...parseMarkdown(file),
  }));
  const allDocumentation = parsedMarkdown.map(({ text }) => text.toLocaleLowerCase()).join("\n");
  const findings: Finding[] = [];

  for (const document of parsedMarkdown) {
    if (!document.hasTitle) {
      findings.push({
        path: document.file.path,
        type: "docs.missing-title",
        severity: "low",
        title: "Documentation is missing a page title",
        description: "Add a level-one heading so readers and documentation tools can identify this page.",
      });
    }

    if (document.text.replace(/\s+/g, " ").trim().length < 100) {
      findings.push({
        path: document.file.path,
        type: "docs.short-content",
        severity: "low",
        title: "Documentation may be too brief",
        description: "This page contains fewer than 100 characters of readable text.",
      });
    }
  }

  for (const file of sourceFiles) {
    for (const symbol of getExportedSymbols(file)) {
      if (!allDocumentation.includes(symbol.toLocaleLowerCase())) {
        findings.push({
          path: file.path,
          type: "source.symbol-undocumented",
          severity: "medium",
          title: `Exported symbol "${symbol}" is not mentioned in documentation`,
          description: `No Markdown page mentions the exported symbol ${symbol}.`,
        });
      }
    }
  }

  return findings;
}

export function getMarkdownDocuments(files: SourceFile[]): SourceFile[] {
  return files.filter(({ path }) => /\.mdx?$/i.test(path));
}
