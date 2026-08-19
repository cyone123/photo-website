import path from "node:path";
import { readImportEnv } from "@/config/env";
import { loadProjectEnv } from "@/config/load-env";
import { collectImageFiles } from "@/importer/file-utils";
import { dryRunPhotoImport, importPhoto } from "@/importer/import-photo";
import { inspectImage } from "@/importer/inspect-image";
import { revalidatePublishedGallery } from "@/importer/revalidate-site";

function printHelp() {
  console.log(`Photo Website CLI

Usage:
  pnpm photo inspect <image-path>
  pnpm photo import <file-or-directory>... --album <album-slug> [options]

Commands:
  inspect   Read image dimensions and EXIF metadata without uploading.
  import    Import photos into R2 and PostgreSQL.

Import options:
  --album <slug>          Album to create or use; required.
  --album-title <title>  Title used when the album is created.
  --dry-run               Parse and process locally without database or R2 writes.
  --force                 Re-upload an already READY photo.
  --help                  Show this help.

Examples:
  pnpm photo import ./photos --album japan-2026 --album-title "Japan 2026"
  pnpm photo import ./photo.jpg --album favorites --dry-run
`);
}

interface ImportArguments {
  inputPaths: string[];
  albumSlug: string;
  albumTitle?: string;
  dryRun: boolean;
  force: boolean;
}

function parseImportArguments(args: string[]): ImportArguments | null {
  const inputPaths: string[] = [];
  let albumSlug: string | undefined;
  let albumTitle: string | undefined;
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--album" || arg === "--album-title") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }

      if (arg === "--album") {
        albumSlug = value;
      } else {
        albumTitle = value;
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    inputPaths.push(arg);
  }

  if (!albumSlug) {
    throw new Error("--album is required for photo import.");
  }

  return { inputPaths, albumSlug, albumTitle, dryRun, force };
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function runImport(args: string[]) {
  const parsed = parseImportArguments(args);

  if (!parsed) {
    printHelp();
    return;
  }

  const files = await collectImageFiles(parsed.inputPaths);

  if (files.length === 0) {
    throw new Error("No supported image files were found.");
  }

  if (!parsed.dryRun) {
    loadProjectEnv();
    readImportEnv();
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`${parsed.dryRun ? "Checking" : "Importing"} ${files.length} image(s)...`);

  for (const filePath of files) {
    try {
      const result = parsed.dryRun
        ? await dryRunPhotoImport({
            filePath,
            albumSlug: parsed.albumSlug,
            albumTitle: parsed.albumTitle,
            dryRun: true,
            force: parsed.force,
          })
        : await importPhoto({
            filePath,
            albumSlug: parsed.albumSlug,
            albumTitle: parsed.albumTitle,
            force: parsed.force,
          });

      if (result.status === "imported") {
        imported += 1;
        console.log(`[imported] ${result.filePath} (${result.variantCount} variants)`);
      } else if (result.status === "skipped") {
        skipped += 1;
        console.log(`[skipped]  ${result.filePath} (${result.photoId})`);
      } else {
        console.log(`[dry-run]  ${result.filePath} (${result.variantCount} variants)`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[failed]   ${path.resolve(filePath)}: ${formatError(error)}`);
    }
  }

  console.log(`Summary: ${imported} imported, ${skipped} skipped, ${failed} failed.`);

  if (!parsed.dryRun && imported + skipped > 0) {
    try {
      const revalidation = await revalidatePublishedGallery();

      if (revalidation.status === "revalidated") {
        console.log("[cache]     Gallery cache revalidated.");
      }
    } catch (error) {
      console.warn(`[cache]     ${formatError(error)} The hourly fallback remains active.`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "inspect") {
    const inputPath = args[0];

    if (!inputPath) {
      throw new Error("Please provide an image path.");
    }

    console.log(JSON.stringify(await inspectImage(path.resolve(inputPath)), null, 2));
    return;
  }

  if (command === "import") {
    await runImport(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
