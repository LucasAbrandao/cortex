export const healthMessage = (status: string): string =>
  status === "ok" ? "API healthy" : "API unavailable";
