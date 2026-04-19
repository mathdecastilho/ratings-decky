// Removes all symbols and extra whitespace for name comparison
export function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase()
}
