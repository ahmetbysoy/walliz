# LANKA v2 — Ürün ve Özellik Backlog'u

Bu doküman, mevcut mobil UX kapsamı dışında tutulan, ileride değerlendirilebilecek fikirleri ve gerçek cihaz kısıtlamalarına dair notları içerir.

---

## 1. Gelecek Özellikler (Park Edilen Fikirler)

### 1.1 Gelişmiş Grafik ve Analiz
- **Kişiselleştirilebilir İndikatör Katmanları:** RSI, MACD veya Bollinger Bantlarının opsiyonel overlay olarak lightweight-charts üzerine eklenebilmesi.
- **Kullanıcı Çizim Araçları:** Trend çizgisi, yatay destek/direnç çizgisi çizme.
- **Çoklu Grafik Görünümü (Split Chart):** Tablet / geniş ekranlarda 2 coin'i yan yana izleme modu.

### 1.2 Model ve Öğrenme İyileştirmeleri
- **Ağırlık Eğrileri Grafiği:** Model ağırlıklarının zaman içindeki değişimini görselleştiren çizgi grafik.
- **Çevrimdışı Backtest Simülatörü:** Yerel geçmiş veri üzerinden model hiperparametrelerini (öğrenme hızı, momentum penceresi) test etme arayüzü.
- **Model Dışa/İçe Aktarımında Çoklu Sembol:** Tüm sembollerin öğrenme durumunu tek bir ZIP/JSON paketinde yedekleme.

### 1.3 Gelişmiş Bildirimler ve Entegrasyon
- **PWA Push Bildirimleri (Web Push):** Tarayıcı kapalıyken sunucu tabanlı (Service Worker push) kritik duvar kırılma bildirimleri.
- **Telegram / Discord Bot Webhook:** Duvar alarmı tetiklendiğinde webhook üzerinden mesaj iletme.

---

## 2. Doğrulama Durumu ve Cihaz Notları (UNVERIFIED)

| Konu | Durum | Not |
|---|---|---|
| **Eski Android Cihazlarda Titreşim (Haptics)** | `UNVERIFIED` | `navigator.vibrate` bazı eski Android WebView ve MIUI/ColorOS tarayıcılarında varsayılan olarak kullanıcı izni olmadan engellenebilir. |
| **iOS Safari 15.0-15.3 Safe Area Dynamic Notch** | `UNVERIFIED` | Safari dinamik alt bar açılıp kapandığında `env(safe-area-inset-bottom)` geç tepki verebilir. iOS 16.4+ ve güncel sürümlerde `dvh` ile stabil çalışmaktadır. |
| **Lightweight-charts Canvas Touch Gestures on Low-End GPUs** | `UNVERIFIED` | Düşük bellekli (2GB altı RAM) giriş seviyesi mobil cihazlarda 100ms aralıklı orderbook çizimi GPU darboğazı yaratabilir; throttle 150-200ms opsiyonu gerekebilir. |
| **Notification API İzin Akışı** | `UNVERIFIED` | Bazı mobil tarayıcılarda (ör. iOS Safari PWA olarak ana ekrana eklenmeden önce) `Notification.requestPermission()` kısıtlıdır. Uygulama içi Sonner toast alternatifi sorunsuz çalışmaktadır. |
