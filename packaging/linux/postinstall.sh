#!/bin/sh
set -e

ln -sf /opt/klovi/bin/launcher /usr/bin/klovi

if command -v update-desktop-database > /dev/null 2>&1; then
  update-desktop-database /usr/share/applications
fi

if command -v gtk-update-icon-cache > /dev/null 2>&1; then
  gtk-update-icon-cache /usr/share/icons/hicolor
fi
