// Shared interface for all rating providers
export interface RatingResult {
  score: number | null  // percentage 0-100 (or null if unavailable)
  label: string         // display text, e.g. "78%" or "N/A"
  url: string           // link to the corresponding critic page
  error: string | null
}
