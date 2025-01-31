import path from "node:path";

export interface CliOptions {
  filePath: string;
  showCode: boolean;
  showSummary: boolean;
  showLocations: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    filePath: "src/App.tsx",
    showCode: false,
    showSummary: true,
    showLocations: true,
    help: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--code":
        options.showCode = true;
        break;
      case "--no-summary":
        options.showSummary = false;
        break;
      case "--no-loc":
        options.showLocations = false;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }

        options.filePath = arg;
        break;
    }
  }

  return options;
}

export function printUsage() {
  return [
    "Usage",
    "pnpm start -- [file] [--code] [--no-summary] [--no-loc]",
    "",
    "Options",
    "--code        Print the source file before the explorer output",
    "--no-summary  Hide the aggregate counts",
    "--no-loc      Hide line and column locations",
    "--help        Show this message",
  ].join("\n");
}

export function toDisplayPath(filePath: string) {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath && !relativePath.startsWith("..") ? relativePath : filePath;
}
