export async function fetchJson(path, options) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error(`${path} API request failed`);
  }

  return response.json();
}

export function shouldUseApi() {
  return import.meta.env.PROD || import.meta.env.VITE_USE_DB_API === "true";
}
