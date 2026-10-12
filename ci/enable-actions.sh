#!/usr/bin/env bash
# GitHub Actions iş akışlarını devreye alır.
#
# Neden böyle: bu oturumda kullanılan GitHub App'inin `workflows` izni yok, bu yüzden
# `.github/workflows/*` dosyaları App üzerinden push EDİLEMİYOR. İş akışları `ci/`
# altında hazır duruyor; bu script onları yerine kopyalayıp commit'ler.
#
# Kullanım (kendi makinenizde, repo kökünde):
#   bash ci/enable-actions.sh
#
# Gereksinim: git kimlik doğrulaması olan bir kullanıcı (sizin hesabınız).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "→ dal: $BRANCH"

mkdir -p .github/workflows

changed=0
for file in ci/ci.yml ci/market-watch.yml; do
  if [ ! -f "$file" ]; then
    echo "!! kaynak bulunamadı: $file" >&2
    exit 1
  fi
  target=".github/workflows/$(basename "$file")"
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target"
  echo "→ kopyalandı: $file → $target"
done

git add .github/workflows

if git diff --cached --quiet; then
  echo "→ Değişiklik yok: iş akışları zaten güncel."
else
  changed=1
  git commit -m "ci: GitHub Actions iş akışlarını devreye al (CI + piyasa nöbeti)"
  echo "→ commit oluşturuldu"
fi

if [ "$changed" = "0" ]; then
  exit 0
fi

echo
echo "Şimdi push edin:  git push origin $BRANCH"
echo "Sonra: GitHub → Actions sekmesi → 'CI' ve 'Piyasa Nöbeti (gerçek veri)' görünür."
echo
echo "Alternatif (push izni sorun çıkarırsa): GitHub arayüzünde"
echo "  Actions → New workflow → 'set up a workflow yourself' → ci/ci.yml içeriğini yapıştırın."
