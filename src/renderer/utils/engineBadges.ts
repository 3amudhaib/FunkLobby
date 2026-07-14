export interface EngineBadge {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const ENGINE_BADGE_MAP: Record<string, EngineBadge> = {
  psych: { label: 'Psych', color: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-500/30' },
  codename: { label: 'Codename', color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  cdev: { label: 'CDEV', color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  forever: { label: 'Forever', color: 'text-green-300', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  'v-slice': { label: 'V-Slice', color: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  'fps-plus': { label: 'FPS Plus', color: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  'micd-up': { label: "Mic'd Up", color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  yoshicrafter: { label: 'Yoshi', color: 'text-lime-300', bg: 'bg-lime-500/15', border: 'border-lime-500/30' },
  dragon: { label: 'Dragon', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  shadow: { label: 'Shadow', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
  shattered: { label: 'Shattered', color: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
  slushi: { label: 'Slushi', color: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/30' },
  troll: { label: 'Troll', color: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  universe: { label: 'Solar', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  vanilla: { label: 'Vanilla', color: 'text-gray-300', bg: 'bg-gray-500/15', border: 'border-gray-500/30' },
  'js-engine': { label: 'JS Engine', color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/30' },
  'fnf-love': { label: 'FNF Love', color: 'text-rose-200', bg: 'bg-rose-400/15', border: 'border-rose-400/30' },
  standalone: { label: 'Standalone', color: 'text-surface-300', bg: 'bg-surface-500/15', border: 'border-surface-500/30' },
};

export function getEngineBadge(engineId: string): EngineBadge {
  const key = engineId?.toLowerCase() || 'standalone';
  return ENGINE_BADGE_MAP[key] || { label: engineId || 'Standalone', color: 'text-surface-300', bg: 'bg-surface-500/15', border: 'border-surface-500/30' };
}
