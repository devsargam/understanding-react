import { formatRootLabel, formatSet, parseJsxRoots, renderTree, summarizeRoots } from "./jsxTree";

export interface ExplorerOptions {
  showCode?: boolean;
  showSummary?: boolean;
  showLocations?: boolean;
  maxPreviewLength?: number;
}

export function buildAstExplorerReport(
  filePath: string,
  code: string,
  options: ExplorerOptions = {},
) {
  const config = {
    showCode: options.showCode ?? false,
    showSummary: options.showSummary ?? true,
    showLocations: options.showLocations ?? true,
    maxPreviewLength: options.maxPreviewLength ?? 72,
  };

  const roots = parseJsxRoots(code, config.maxPreviewLength);
  const summary = summarizeRoots(roots);
  const lines: string[] = [];

  lines.push("AST Explorer");
  lines.push(`file: ${filePath}`);
  lines.push(`jsx roots: ${roots.length}`);

  if (config.showCode) {
    lines.push("");
    lines.push("Source");
    lines.push(code.trimEnd());
  }

  if (config.showSummary) {
    lines.push("");
    lines.push("Summary");
    lines.push(`- elements: ${summary.elementCount}`);
    lines.push(`- fragments: ${summary.fragmentCount}`);
    lines.push(`- text nodes: ${summary.textCount}`);
    lines.push(`- expression containers: ${summary.expressionCount}`);
    lines.push(`- spread children: ${summary.spreadCount}`);
    lines.push(`- props: ${summary.propCount}`);
    lines.push(`- max depth: ${summary.maxDepth}`);
    lines.push(`- component tags: ${formatSet(summary.componentTags)}`);
    lines.push(`- DOM tags: ${formatSet(summary.domTags)}`);
  }

  lines.push("");
  lines.push("Roots");

  if (roots.length === 0) {
    lines.push("No JSX roots found.");
    return lines.join("\n");
  }

  roots.forEach((root, index) => {
    lines.push(
      `${index + 1}. ${root.context} -> ${formatRootLabel(root)}${config.showLocations ? ` ${root.location}` : ""}`,
    );
    lines.push(...renderTree(root.tree, config.showLocations));

    if (index < roots.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}
