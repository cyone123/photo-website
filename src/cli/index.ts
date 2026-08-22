import path from "node:path";
import { readImportEnv } from "@/config/env";
import { loadProjectEnv } from "@/config/load-env";
import { collectImageFiles } from "@/importer/file-utils";
import { dryRunPhotoImport, importPhoto, prepareImportAlbum } from "@/importer/import-photo";
import { inspectImage } from "@/importer/inspect-image";
import { setAlbumChapter, updateAlbum } from "@/importer/manage-album";
import { updatePhoto } from "@/importer/manage-photo";
import { revalidatePublishedGallery } from "@/importer/revalidate-site";

const DEFAULT_IMPORT_CONCURRENCY = 2;
const MAX_IMPORT_CONCURRENCY = 4;

function printHelp() {
  console.log(`Photo Website CLI

Usage:
  pnpm photo inspect <image-path>
  pnpm photo import <file-or-directory>... --album <album-slug> [options]
  pnpm photo update <photo-id> [options]
  pnpm photo album update <album-slug> [options]
  pnpm photo album chapter <album-slug> --photo <photo-id> [options]

Commands:
  inspect   Read image dimensions and EXIF metadata without uploading.
  import    Import photos into R2 and PostgreSQL.
  update    Edit an existing photo title or description.
  album     Edit album context, cover focus and chapter copy.

Import options:
  --album <slug>          Album to create or use; required.
  --album-title <title>  Title used when the album is created.
  --title <title>         Custom title for one photo; defaults to its filename.
  --dry-run               Parse and process locally without database or R2 writes.
  --force                 Re-upload an already READY photo.
  --concurrency <1-4>     Photos processed concurrently (default: 2).
  --help                  Show this help.

Photo update options:
  --title <title>         Public photo title.
  --description <text>    Public photo description.

Album update options:
  --description <text>    Public album summary.
  --context <text>        Shooting background shown before the gallery.
  --cover <photo-id>      Cover photo; it must already belong to the album.
  --focus-x <0-100>       Horizontal cover focal point.
  --focus-y <0-100>       Vertical cover focal point.

Album chapter options:
  --photo <photo-id>      First photo in the chapter; required.
  --title <text>          Chapter heading.
  --text <text>           Chapter introduction.

Examples:
  pnpm photo import ./photos --album japan-2026 --album-title "Japan 2026"
  pnpm photo import ./photo.jpg --album favorites --title "Snow at dusk"
  pnpm photo import ./photo.jpg --album favorites --dry-run
  pnpm photo update <uuid> --title "Snow at dusk"
  pnpm photo album update japan-2026 --context "雨季的东京" --focus-x 42 --focus-y 30
  pnpm photo album chapter japan-2026 --photo <uuid> --title "清晨" --text "从第一班电车开始。"
`);
}

interface ImportArguments {
  inputPaths: string[];
  albumSlug: string;
  albumTitle?: string;
  photoTitle?: string;
  dryRun: boolean;
  force: boolean;
  concurrency: number;
}

function parseImportArguments(args: string[]): ImportArguments | null {
  const inputPaths: string[] = [];
  let albumSlug: string | undefined;
  let albumTitle: string | undefined;
  let photoTitle: string | undefined;
  let dryRun = false;
  let force = false;
  let concurrency = DEFAULT_IMPORT_CONCURRENCY;

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

    if (arg === "--concurrency") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }

      const parsedConcurrency = Number(value);

      if (
        !Number.isInteger(parsedConcurrency) ||
        parsedConcurrency < 1 ||
        parsedConcurrency > MAX_IMPORT_CONCURRENCY
      ) {
        throw new Error(`--concurrency must be an integer from 1 to ${MAX_IMPORT_CONCURRENCY}.`);
      }

      concurrency = parsedConcurrency;
      index += 1;
      continue;
    }

    if (arg === "--album" || arg === "--album-title" || arg === "--title") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }

      if (arg === "--album") {
        albumSlug = value;
      } else if (arg === "--album-title") {
        albumTitle = value;
      } else {
        photoTitle = value;
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

  return { inputPaths, albumSlug, albumTitle, photoTitle, dryRun, force, concurrency };
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

  if (parsed.photoTitle !== undefined && files.length !== 1) {
    throw new Error("--title can only be used when importing exactly one photo.");
  }

  if (!parsed.dryRun) {
    loadProjectEnv();
    readImportEnv();
  }

  const preparedAlbum = parsed.dryRun
    ? undefined
    : await prepareImportAlbum(parsed.albumSlug, parsed.albumTitle);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `${parsed.dryRun ? "Checking" : "Importing"} ${files.length} image(s) with concurrency ${parsed.concurrency}...`,
  );

  let cursor = 0;
  const workerCount = Math.min(parsed.concurrency, files.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < files.length) {
      const filePath = files[cursor];
      cursor += 1;

      try {
        const result = parsed.dryRun
          ? await dryRunPhotoImport({
              filePath,
              albumSlug: parsed.albumSlug,
              albumTitle: parsed.albumTitle,
              photoTitle: parsed.photoTitle,
              dryRun: true,
              force: parsed.force,
            })
          : await importPhoto({
              filePath,
              albumSlug: preparedAlbum?.albumSlug ?? parsed.albumSlug,
              albumId: preparedAlbum?.album.id,
              albumTitle: parsed.albumTitle,
              photoTitle: parsed.photoTitle,
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
  });

  await Promise.all(workers);

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

function optionValue(args: string[], name: string) {
  const index = args.indexOf(name);

  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

async function runPhotoUpdate(args: string[]) {
  const [id, ...options] = args;

  if (!id) {
    throw new Error("Photo id is required.");
  }

  loadProjectEnv();
  const updated = await updatePhoto({
    id,
    title: optionValue(options, "--title"),
    description: optionValue(options, "--description"),
  });
  console.log(`[photo]     Updated ${updated.id}: ${updated.title ?? "untitled"}.`);

  try {
    await revalidatePublishedGallery();
  } catch (error) {
    console.warn(`[cache]     ${formatError(error)} The hourly fallback remains active.`);
  }
}

async function runAlbum(args: string[]) {
  const [action, slug, ...options] = args;

  if (!action || !slug || (action !== "update" && action !== "chapter")) {
    throw new Error("Use `album update <slug>` or `album chapter <slug>`. ");
  }

  loadProjectEnv();

  if (action === "update") {
    const focalX = optionValue(options, "--focus-x");
    const focalY = optionValue(options, "--focus-y");
    const updated = await updateAlbum({
      slug,
      description: optionValue(options, "--description"),
      shootingContext: optionValue(options, "--context"),
      coverPhotoId: optionValue(options, "--cover"),
      coverFocalX: focalX === undefined ? undefined : Number(focalX),
      coverFocalY: focalY === undefined ? undefined : Number(focalY),
    });
    console.log(`[album]     Updated ${updated.slug}.`);
  } else {
    const photoId = optionValue(options, "--photo");

    if (!photoId) {
      throw new Error("--photo is required for an album chapter.");
    }

    await setAlbumChapter({
      slug,
      photoId,
      title: optionValue(options, "--title"),
      text: optionValue(options, "--text"),
    });
    console.log(`[chapter]   Updated chapter before ${photoId}.`);
  }

  try {
    await revalidatePublishedGallery();
  } catch (error) {
    console.warn(`[cache]     ${formatError(error)} The hourly fallback remains active.`);
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

  if (command === "update") {
    await runPhotoUpdate(args);
    return;
  }

  if (command === "album") {
    await runAlbum(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
