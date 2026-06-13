#!/usr/bin/env node
// Copies Cesium static assets into public/cesium/ so Next.js can serve them
// at the base URL used by window.CESIUM_BASE_URL = '/cesium'
const fs = require("fs")
const path = require("path")

const src = path.join(__dirname, "..", "node_modules", "cesium", "Build", "Cesium")
const dest = path.join(__dirname, "..", "public", "cesium")

const folders = ["Workers", "ThirdParty", "Assets", "Widgets"]

function copyDir(from, to) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name)
    const destPath = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

for (const folder of folders) {
  copyDir(path.join(src, folder), path.join(dest, folder))
}

console.log("✓ Cesium static assets copied to public/cesium/")
