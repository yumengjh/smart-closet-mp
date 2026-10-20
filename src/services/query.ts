/** Encode query values without depending on browser URL utilities. */
export function queryString(values: object): string {
  return Object.entries(values).filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
}
