import { Brain, CandlestickChart, Layers } from 'lucide-react'

export type TabId = 'grafik' | 'duvarlar' | 'model'

export const TABS: { id: TabId; label: string; icon: typeof CandlestickChart }[] = [
  { id: 'grafik', label: 'Grafik', icon: CandlestickChart },
  { id: 'duvarlar', label: 'Duvarlar', icon: Layers },
  { id: 'model', label: 'Model', icon: Brain },
]

export function nextTab(tab: TabId, dir: 1 | -1): TabId {
  const i = TABS.findIndex((t) => t.id === tab)
  return TABS[(i + dir + TABS.length) % TABS.length].id
}
