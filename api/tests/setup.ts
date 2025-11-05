// Silence noisy console during tests (guard for non-Jest runtimes)
try {
  // @ts-ignore
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // @ts-ignore
  jest.spyOn(console, 'error').mockImplementation(() => {});
} catch {}

// Provide a basic global.fetch mock for ML calls
(global as any).fetch = async (url: string, init?: any) => {
  // Return a simple ML predict response for /ml/predict
  if (String(url).includes('/ml/predict')) {
    const body = JSON.stringify({ predicted_total: 2000, confidence: 0.8, model_version: 'test-model-1' });
    return {
      ok: true,
      status: 200,
      async text() { return body; },
    } as any;
  }
  // Default minimal 404
  return {
    ok: false,
    status: 404,
    async text() { return ''; },
  } as any;
};
