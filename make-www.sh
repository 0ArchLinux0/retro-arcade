#!/bin/zsh
# Assemble a clean web bundle (www/) for Capacitor from repo root assets.
# Capacitor requires webDir to be a subdirectory — root "." is rejected.
set -e
cd "$(dirname "$0")"

rm -rf www
mkdir -p www

cp index.html manifest.json sw.js privacy.html www/
cp -R css js icons www/

echo "www/ assembled:"
find www -type f | sort
