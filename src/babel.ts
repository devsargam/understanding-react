import fs from "node:fs";
import path from "node:path";
import { buildAstExplorerReport } from "./astExplorer";
import { parseArgs, printUsage, toDisplayPath } from "./cli";

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(printUsage());
    return;
  }

  const absoluteFilePath = path.resolve(process.cwd(), options.filePath);
  if (!fs.existsSync(absoluteFilePath)) {
    throw new Error(`File not found: ${toDisplayPath(absoluteFilePath)}`);
  }

  const code = fs.readFileSync(absoluteFilePath, "utf8");
  const report = buildAstExplorerReport(toDisplayPath(absoluteFilePath), code, {
    showCode: options.showCode,
    showSummary: options.showSummary,
    showLocations: options.showLocations,
  });

  console.clear();
  console.log(report);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  console.error("");
  console.error(printUsage());
  process.exitCode = 1;
}
