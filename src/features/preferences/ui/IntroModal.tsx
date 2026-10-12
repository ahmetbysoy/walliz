import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BrainCircuit, ChevronRight, HelpCircle, Layers, LineChart, X } from 'lucide-react'
import { loadPreferences, savePreferences } from '@/shared/lib/learningRepo'
import { Button } from '@/shared/ui/Button'
import { haptic } from '@/shared/lib/haptics'

const STEPS = [
  {
    icon: Layers,
    title: '1. Duvar Nedir?',
    desc: 'Orderbook üzerindeki yoğun alım (bid) veya satım (ask) emir yığılmalarıdır. Fiyat bu seviyelere yaklaştığında tepki görebilir; güçlü duvarlar destek/direnç işlevi görebilir.',
  },
  {
    icon: BrainCircuit,
    title: '2. Sinyal Gücü Ne Demek?',
    desc: 'Modelin anlık emir defteri ve fiyat hareketinden çıkardığı skorun şiddetidir. Kesin bir olasılık veya garanti DEĞİLDİR; gerçek başarı oranı geçmiş isabet istatistiğiyle ölçülür.',
  },
  {
    icon: LineChart,
    title: '3. Nasıl Okunur?',
    desc: 'Grafikteki kesikli çizgiler en güçlü duvar seviyeleridir. Grafiğin altındaki şeritten yön tahminini izleyebilir, dokunarak modelin geçmiş isabet oranını ve kova dağılımını görebilirsiniz.',
  },
]

export function IntroModal({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [step, setStep] = useState(0)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (o: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(o)
    } else {
      setInternalOpen(o)
    }
  }

  // İlk açılış kontrolü (yalnızca kontrol edilmeyen modda)
  useEffect(() => {
    if (isControlled) return
    void loadPreferences().then((p) => {
      if (!p.hasSeenIntro) {
        setInternalOpen(true)
      }
    })
  }, [isControlled])

  const completeIntro = () => {
    haptic(10)
    void loadPreferences().then((p) => savePreferences({ ...p, hasSeenIntro: true }))
    setOpen(false)
    setStep(0)
  }

  const nextStep = () => {
    haptic(10)
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      completeIntro()
    }
  }

  const CurrentIcon = STEPS[step].icon

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-mint">
              <HelpCircle className="size-4" />
              <span>LANKA Hızlı Rehber</span>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={completeIntro}
                aria-label="Kapat"
                className="flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="my-4 flex flex-col items-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-mint shadow-inner">
              <CurrentIcon className="size-7" />
            </div>
            <Dialog.Title className="text-base font-semibold text-text">
              {STEPS[step].title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted">
              {STEPS[step].desc}
            </Dialog.Description>
          </div>

          {/* Adım noktaları */}
          <div className="flex justify-center gap-1.5 py-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-mint' : 'w-1.5 bg-line'
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={completeIntro}
              className="flex-1 text-xs text-muted"
            >
              Atla
            </Button>
            <Button variant="primary" size="sm" onClick={nextStep} className="flex-1 text-xs">
              {step < STEPS.length - 1 ? (
                <>
                  İleri <ChevronRight className="ml-1 size-3.5" />
                </>
              ) : (
                'Anladım'
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
