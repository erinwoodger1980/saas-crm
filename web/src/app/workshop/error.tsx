"use client";

import React from "react";

export default function WorkshopError({ error, reset }: { error: any; reset: () => void }) {
  React.useEffect(() => {
    // Log full error details to help debugging production-only issues
    // eslint-disable-next-line no-console
    console.error("/workshop error boundary:", error);
  }, [error]);

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong loading the workshop</h1>
      <p className="text-sm text-muted-foreground">Try refreshing. If this keeps happening, we’ll need the console error details.</p>
      {error?.message ? (
        <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
          {String(error.message)}
        </pre>
      ) : null}
      <button className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
