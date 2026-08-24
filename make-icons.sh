#!/bin/zsh
# Generate store-ready icon set from icons/icon.svg
# Outputs: icon-1024.png (iOS master), maskable-512, android densities, favicon-32
set -e
cd "$(dirname "$0")"

SRC="icons/icon.svg"
OUT="icons"

# 1) iOS App Store master (1024x1024, square — no rounded corners baked in;
#    iOS masks automatically. We render the SVG without rx for the master.)
python3 - "$SRC" "$OUT" <<'PY'
import re, sys
src_path, out = sys.argv[1], sys.argv[2]
svg = open(src_path).read()
# strip rounded corners + gradient padding-safe margins stay as-is
flat = re.sub(r'rx="\d+"', '', svg)
open(f"{out}/icon-flat.svg", "w").write(flat)
print("flat svg written")
PY

# 2) rasterize everything with qlmanage/sips (rsvg not guaranteed)
#    Use WebKit via qlmanage? Simpler: use `sips` can't do svg reliably on all systems.
#    Fallback chain: rsvg-convert -> inkscape -> qlmanage -> python cairosvg
render() { # $1 src  $2 size  $3 out
  if command -v rsvg-convert >/dev/null; then
    rsvg-convert -w "$2" -h "$2" "$1" -o "$3"
  elif command -v magick >/dev/null; then
    magick -background none "$1" -resize "${2}x${2}" "$3"
  else
    qlmanage -t -s "$2" -o "$(dirname "$3")" "$1" >/dev/null 2>&1 && \
      mv "$(dirname "$3")/$(basename "${1}").png" "$3"
  fi
}

render "icons/icon-flat.svg" 1024 "icons/ios-icon-1024.png"
render "$SRC" 512  "icons/icon-maskable-512.png"
render "$SRC" 512  "icons/icon-512.png"
render "$SRC" 192  "icons/icon-192.png"

# Android adaptive-style density set from the 1024 master
for pair in "mdpi:48" "hdpi:72" "xhdpi:96" "xxhdpi:144" "xxxhdpi:192"; do
  name="${pair%%:*}"; size="${pair##*:}"
  render "icons/icon-flat.svg" "$size" "icons/android-${name}.png" || true
done

rm -f icons/icon-flat.svg
ls -la icons/
echo "ICON SET DONE"
