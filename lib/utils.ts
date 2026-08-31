import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a human-readable message from an unknown error thrown by the axios
 * client, falling back to `fallback` when the shape is not recognised.
 *
 * The backend envelope is `{ success, data, message, error }`, so an axios
 * rejection carries the useful text at `err.response.data.message`.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: unknown } } } | null)?.response;
  const message = response?.data?.message;
  if (typeof message === "string" && message.length > 0) return message;
  if (Array.isArray(message)) {
    const first = message.find((m) => typeof m === "string" && m.length > 0);
    if (typeof first === "string") return first;
  }
  return fallback;
}
