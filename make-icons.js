// Generate PWA icons (PNG 192/512) from icons/icon.svg using macOS built-in tooling.
// Usage: node make-icons.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const svgPath = path.join(root, 'icons', 'icon.svg');

function render(size) {
  const out = path.join(root, 'icons', `icon-${size}.png`);
  try {
    // Try rsvg-convert first
    execSync(`rsvg-convert -w ${size} -h ${size} "${svgPath}" -o "${out}"`);
  } catch {
    try {
      // qlmanage fallback (macOS)
      const tmp = path.join(root, 'icons', `icon.svgz.png`);
      fs.copyFileSync(svgPath, tmp);
      execSync(`qlmanage -t -s ${size} -o "${path.join(root, 'icons')}" "${svgPath}" >/dev/null 2>&1`);
      const gen = path.join(root, 'icons', `icon.svg.png`);
      if (fs.existsSync(gen)) {
        fs.renameSync(gen, out);
      }
    } catch (e) {
      console.error(`Could not render ${size}px:`, e.message);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`OK icon-${size}.png`);
}

render(192);
render(512);
