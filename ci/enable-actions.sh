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

copied=0
for file in ci/*.yml; do
  if [ ! -f "$file" ]; then
    echo "!! iş akışı bulunamadı: $file" >&2
    exit 1
  fi
  target=".github/workflows/$(basename "$file")"
  cp "$file" "$target"
  echo "→ kopyalandı: $file → $target"
  copied=$((copied + 1))
done

if [ "$copied" -eq 0 ]; then
  echo "!! ci/ altında hiç .yml bulunamadı" >&2
  exit 1
fi

git add .github/workflows

if git diff --cached --quiet; then
  echo "→ Değişiklik yok: iş akışları zaten güncel."
  exit 0
fi

git commit -m "ci: GitHub Actions iş akışlarını devreye al (CI + piyasa nöbeti + Pages)"
echo "→ commit oluşturuldu"

echo
echo "Şimdi push edin:  git push origin $BRANCH"
echo "Sonra: GitHub → Actions sekmesinde 'CI' ve 'Piyasa Nöbeti (gerçek veri)' görünür."
echo
echo "Pages yayını için ayrıca: Settings → Pages → Source."
echo "  · 'GitHub Actions'  → ci/deploy-pages.yml otomatik yayınlar"
echo "  · 'Deploy from a branch' → gh-pages / (root)  (bkz. scripts/deploy-pages.sh)"
echo
echo "Alternatif (push izni sorun çıkarırsa): GitHub arayüzünde"
echo "  Actions → New workflow → 'set up a workflow yourself' → dosya içeriğini yapıştırın."
