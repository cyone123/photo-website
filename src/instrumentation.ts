import type { Instrumentation } from "next";

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    digest: "digest" in error ? String(error.digest) : undefined,
    stack: error.stack,
  };
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "request.failed",
      timestamp: new Date().toISOString(),
      request: {
        method: request.method,
        path: request.path,
      },
      context: {
        routePath: context.routePath,
        routeType: context.routeType,
        routerKind: context.routerKind,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
      },
      error: errorDetails(error),
    }),
  );
};
