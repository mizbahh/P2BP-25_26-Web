// Mirrors the Angular app's environment.ts/environment.prod.ts split: empty string
// in production (same-origin deploy), a local dev URL otherwise.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";
