import { COINS } from '@/shared/config/coins'
import { Select } from '@/shared/ui/Select'

export function CoinSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (symbol: string) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      ariaLabel="Coin seç"
      options={COINS.map((c) => ({ value: c.symbol, label: c.base, hint: c.name }))}
      className="min-h-[44px] h-8 px-2.5 py-1 text-sm font-semibold min-w-[76px]"
    />
  )
}
