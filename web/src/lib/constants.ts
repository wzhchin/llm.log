// Provider colors — mapped onto the viewer.html palette.
// Hex values are required because recharts does not resolve CSS vars.
export const PROVIDER_COLORS: Record<string, string> = {
  openai: '#7eb85c',      // green
  anthropic: '#d4a853',   // amber
  deepseek: '#6ba4f8',    // blue
  groq: '#b392f0',        // violet
  mistral: '#e05555',     // red
  together: '#e0964a',    // orange
  fireworks: '#f687b3',   // pink
  openrouter: '#5cbfb5',  // cyan
  perplexity: '#b392f0',  // violet
  xai: '#6ba4f8',         // blue
};

export const FALLBACK_COLORS = [
  '#d4a853', '#6ba4f8', '#5cbfb5', '#7eb85c', '#b392f0',
  '#e0964a', '#e05555', '#f687b3',
];

export function getProviderColor(name: string, index: number = 0): string {
  return PROVIDER_COLORS[name.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// Chart colors — viewer palette
export const CHART_COLORS = {
  primary: '#d4a853',     // amber — main line/area
  input: '#6ba4f8',       // blue — input tokens
  output: '#7eb85c',      // green — output tokens
  cacheRead: '#5cbfb5',   // cyan — cache read
  cacheWrite: '#b392f0',  // violet — cache write
  cost: '#d4a853',        // amber — cost charts
  cacheHit: '#5cbfb5',    // cyan — cache hit rate
  latency: '#e0964a',     // orange — latency
} as const;
