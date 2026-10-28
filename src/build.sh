#!/bin/bash
# Builds the standalone (GitHub Pages) version of Ledgerline into ./site
set -e
cd "$(dirname "$0")/.."
VER=$(date +%Y%m%d%H%M%S)
{
cat <<HEAD
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Ledgerline">
<meta name="application-name" content="Ledgerline">
<meta name="theme-color" content="#0F7B5C" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A110F" media="(prefers-color-scheme: dark)">
<meta name="description" content="Your money, all in one place.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);--band:#0F7B5C}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--band:#0A110F;color-scheme:dark}}
:root[data-theme="dark"]{--band:#0A110F;color-scheme:dark}
body{margin:0;font:14px system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}
img{max-width:100%}
[hidden]{display:none!important}
</style>
HEAD
sed '/claude:viewport-fit-sides/d' src/head.html
cat <<'STY'
<style>body::before{background:var(--band)!important}</style>
</head>
<body>
STY
cat src/body.html
cat <<'LIBS'
<script>window.LL_LIB={xlsx:'vendor/xlsx.full.min.js',pdf:'vendor/pdf.min.js',pdfw:'vendor/pdf.worker.min.js'};</script>
<script src="vendor/chart.umd.js"></script>
LIBS
echo '<script>'
sed '/^if (typeof module !== .undefined.) module.exports/d' src/core.js
echo
cat src/ui.js
echo '</script>'
cat <<'SW'
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); }); }
</script>
</body>
</html>
SW
} > index.html
sed "s/__VER__/$VER/" src/sw.template.js > sw.js
touch .nojekyll
echo "built site v$VER ($(wc -c < index.html) bytes)"
