import path from "node:path";
import { inspectImage } from "@/importer/inspect-image";

function printHelp() {
  console.log(`Photo Website CLI

Usage:
  pnpm photo inspect <image-path>
  pnpm photo import <image-path> --album <album-slug>

Commands:
  inspect   Read image dimensions and EXIF metadata without uploading.
  import    Reserved for the idempotent R2/PostgreSQL import pipeline.
`);
}

async function main() {
  const [command, inputPath] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "inspect") {
    if (!inputPath) {
      throw new Error("Please provide an image path.");
    }

    console.log(JSON.stringify(await inspectImage(path.resolve(inputPath)), null, 2));
    return;
  }

  if (command === "import") {
    throw new Error("The import pipeline is scaffolded but not implemented yet.");
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
