import { useState, useEffect } from 'react'
import { Brain, Layers, Settings, Sun, Moon, Eye, Smartphone, HelpCircle, Bell } from 'lucide-react'
import { PyramidPanel } from '@/features/pyramid/ui/PyramidPanel'
import { LearningPanel } from '@/features/learning-memory/ui/LearningPanel'
import { IntroModal } from '@/features/preferences/ui/IntroModal'
import { loadPreferences, savePreferences } from '@/shared/lib/learningRepo'
import { setHapticsEnabled, haptic } from '@/shared/lib/haptics'
import { Card, CardTitle } from '@/shared/ui/Card'
import { clsx } from 'clsx'

export function ModelPanel() {
  const [subTab, setSubTab] = useState<'kovalar' | 'hafiza' | 'ayarlar'>('kovalar')
  const [showIntro, setShowIntro] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [colorblind, setColorblind] = useState(false)
  const [vibrate, setVibrate] = useState(true)
  const [wallAlertThreshold, setWallAlertThreshold] = useState(0.5)

  useEffect(() => {
    void loadPreferences().then((p) => {
      if (p.theme) {
        setTheme(p.theme)
        if (p.theme === 'light') document.documentElement.dataset.theme = 'light'
        else delete document.documentElement.dataset.theme
      }
      if (p.colorblind != null) {
        setColorblind(p.colorblind)
        if (p.colorblind) document.documentElement.dataset.colorblind = 'on'
        else delete document.documentElement.dataset.colorblind
      }
      if (p.haptics != null) {
        setVibrate(p.haptics)
        setHapticsEnabled(p.haptics)
      }
      if (p.wallAlertThreshold != null) {
        setWallAlertThreshold(p.wallAlertThreshold)
      }
    })
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    haptic(15)
    if (next === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    void loadPreferences().then((p) => savePreferences({ ...p, theme: next }))
  }

  const toggleColorblind = () => {
    const next = !colorblind
    setColorblind(next)
    haptic(15)
    if (next) document.documentElement.dataset.colorblind = 'on'
    else delete document.documentElement.dataset.colorblind
    void loadPreferences().then((p) => savePreferences({ ...p, colorblind: next }))
  }

  const toggleVibrate = () => {
    const next = !vibrate
    setVibrate(next)
    setHapticsEnabled(next)
    if (next) haptic(25)
    void loadPreferences().then((p) => savePreferences({ ...p, haptics: next }))
  }

  const handleThresholdChange = (val: number) => {
    setWallAlertThreshold(val)
    void loadPreferences().then((p) => savePreferences({ ...p, wallAlertThreshold: val }))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-tab seçici */}
      <div
        role="tablist"
        aria-label="Model görünümleri"
        className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'kovalar'}
          aria-label="Kovalar sekmesi"
          onClick={() => {
            haptic(10)
            setSubTab('kovalar')
          }}
          className={clsx(
            'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
            subTab === 'kovalar' ? 'bg-surface-2 text-mint shadow-xs' : 'text-muted hover:text-text',
          )}
        >
          <Layers className="size-4" aria-hidden />
          <span>Kovalar</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'hafiza'}
          aria-label="Hafıza sekmesi"
          onClick={() => {
            haptic(10)
            setSubTab('hafiza')
          }}
          className={clsx(
            'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
            subTab === 'hafiza' ? 'bg-surface-2 text-mint shadow-xs' : 'text-muted hover:text-text',
          )}
        >
          <Brain className="size-4" aria-hidden />
          <span>Hafıza</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'ayarlar'}
          aria-label="Ayarlar sekmesi"
          onClick={() => {
            haptic(10)
            setSubTab('ayarlar')
          }}
          className={clsx(
            'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
            subTab === 'ayarlar' ? 'bg-surface-2 text-mint shadow-xs' : 'text-muted hover:text-text',
          )}
        >
          <Settings className="size-4" aria-hidden />
          <span>Ayarlar</span>
        </button>
      </div>

      {/* Sub-tab içerikleri */}
      {subTab === 'kovalar' && (
        <section id="panel-kovalar" aria-label="Kovalar">
          <PyramidPanel />
        </section>
      )}

      {subTab === 'hafiza' && (
        <section id="panel-hafiza" aria-label="Hafıza">
          <LearningPanel />
        </section>
      )}

      {subTab === 'ayarlar' && (
        <section aria-label="Görünüm ve Bildirim Ayarları" className="flex flex-col gap-3">
          {/* T-P2-4: Tema, Renk Körü, Titreşim */}
          <Card>
            <CardTitle className="mb-3 flex items-center gap-1.5">
              <Settings className="size-3.5" aria-hidden /> Görünüm ve Geri Bildirim
            </CardTitle>
            <div className="flex flex-col divide-y divide-line text-sm">
              <div className="flex min-h-[44px] items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="size-4 text-muted" /> : <Sun className="size-4 text-amber" />}
                  <span>Koyu / Açık Tema</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Tema değiştir: şu an ${theme === 'dark' ? 'Koyu' : 'Açık'}`}
                  className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text active:scale-95"
                >
                  {theme === 'dark' ? '🌙 Koyu' : '☀️ Açık'}
                </button>
              </div>

              <div className="flex min-h-[44px] items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-muted" />
                  <span>Renk Körü Modu (Mavi / Turuncu)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleColorblind}
                  aria-label={`Renk körü modu ${colorblind ? 'kapat' : 'aç'}`}
                  className={clsx(
                    'rounded-lg border border-line px-3 py-1.5 text-xs font-semibold active:scale-95',
                    colorblind ? 'bg-mint text-bg' : 'bg-surface-2 text-text',
                  )}
                >
                  {colorblind ? 'Açık' : 'Kapalı'}
                </button>
              </div>

              <div className="flex min-h-[44px] items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-muted" />
                  <span>Dokunma Titreşimi (Haptics)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVibrate}
                  aria-label={`Titreşim ${vibrate ? 'kapat' : 'aç'}`}
                  className={clsx(
                    'rounded-lg border border-line px-3 py-1.5 text-xs font-semibold active:scale-95',
                    vibrate ? 'bg-mint text-bg' : 'bg-surface-2 text-text',
                  )}
                >
                  {vibrate ? 'Açık' : 'Kapalı'}
                </button>
              </div>
            </div>
          </Card>

          {/* T-P2-1: Duvar Uyarıları */}
          <Card>
            <CardTitle className="mb-2 flex items-center gap-1.5">
              <Bell className="size-3.5" aria-hidden /> Duvar Uyarıları
            </CardTitle>
            <p className="text-xs text-muted leading-relaxed">
              Fiyata yakın güçlü alıcı veya satıcı duvarı belirdiğinde uygulama içinde bildirim ve titreşim verilir.
              <span className="block mt-1 font-medium text-text/80">
                ⚠️ Not: PWA arka plan push bildirimi desteklemez; uyarılar yalnızca <u>uygulama açıkken</u> çalışır.
              </span>
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
              <span className="text-muted">Yakınlık Eşiği:</span>
              <div className="flex items-center gap-1.5">
                {[0.2, 0.5, 1.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleThresholdChange(val)}
                    className={clsx(
                      'rounded-md border border-line px-2.5 py-1 text-xs tabular-nums',
                      wallAlertThreshold === val ? 'bg-mint text-bg font-semibold' : 'bg-surface-2 text-muted',
                    )}
                  >
                    %{val}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Tanıtım / Rehber */}
          <Card>
            <CardTitle className="mb-2 flex items-center gap-1.5">
              <HelpCircle className="size-3.5" aria-hidden /> Yardım & Rehber
            </CardTitle>
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-text hover:border-mint/40 active:scale-[0.99]"
            >
              <span>Hızlı Tanıtım Rehberini Aç</span>
              <HelpCircle className="size-4 text-mint" />
            </button>
          </Card>
        </section>
      )}

      <IntroModal open={showIntro} onOpenChange={setShowIntro} />
    </div>
  )
}
