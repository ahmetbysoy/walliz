#!/usr/bin/env bash
# GitHub Pages'e gerçek yayın (elle çalıştırılabilir deploy).
#
# Ne yapar:
#   1. `VITE_BASE_PATH=/<repo>/` ile production build alır (Pages proje siteleri alt
#      dizinden servis edilir; taban yol olmadan varlıklar 404 olur).
#   2. `dist/` içeriğini geçici bir depoda tek commit yapıp `gh-pages` dalına
#      force-push eder (dal geçmişi şişmez, her deploy öncekinin yerini alır).
#   3. `.nojekyll` ekler (Jekyll'in `_` ile başlayan dosyaları yok saymasını engeller).
#
# Kullanım (repo kökünde):
#   bash scripts/deploy-pages.sh
#   PAGES_BASE_PATH=/ozel/ bash scripts/deploy-pages.sh   # taban yolu elle
#   PAGES_BRANCH=gh-pages REMOTE=origin bash scripts/deploy-pages.sh
#
# Ön koşul (tek seferlik, repo sahibi tarafından):
#   GitHub → Settings → Pages → Source: "Deploy from a branch" → gh-pages / (root)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

export PATH="$PWD/node_modules/.bin:$PATH"

REMOTE="${REMOTE:-origin}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"

remote_url="$(git remote get-url "$REMOTE")"

# depo adı ve sahibi: (git@github.com:owner/repo.git | https://github.com/owner/repo.git)
slug="$(printf '%s' "$remote_url" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
owner="${slug%%/*}"
repo="${slug##*/}"

# taban yol: /<repo>/ (baştan ve sondan eğik çizgi garantili)
raw_base="${PAGES_BASE_PATH:-/$repo/}"
raw_base="/${raw_base#/}"
raw_base="${raw_base%/}/"
base="$raw_base"

echo "→ depo      : $owner/$repo"
echo "→ uzak dal  : $REMOTE:$PAGES_BRANCH"
echo "→ taban yol : $base"

echo "→ build alınıyor (VITE_BASE_PATH=$base)…"
VITE_BASE_PATH="$base" npm run build

# .nojekyll: Jekyll dosya işlemesini kapatır
touch dist/.nojekyll

if [ ! -f dist/index.html ]; then
  echo "!! build çıktısı yok (dist/index.html bulunamadı)" >&2
  exit 1
fi

short_sha="$(git rev-parse --short HEAD)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cp -a dist/. "$tmp"/
cd "$tmp"

git init -q -b "$PAGES_BRANCH"
git add -A
git -c user.name="lanka-deploy" -c user.email="deploy@users.noreply.github.com" \
  commit -q -m "deploy: LANKA v2 · taban=$base · kaynak=$short_sha"

echo "→ $PAGES_BRANCH dalına gönderiliyor…"
git push --force "$remote_url" "HEAD:$PAGES_BRANCH"

echo
echo "✅ Yayın gönderildi: https://$owner.github.io/$repo/"
echo "   (Pages ilk kez kuruluyorsa: Settings → Pages → Source: Deploy from a branch →"
echo "    $PAGES_BRANCH / (root). Yayına alındıktan sonra bu adres ~1 dakikada canlı olur.)"
