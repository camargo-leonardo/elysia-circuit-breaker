#!/usr/bin/env bash

# Clean dist directory
rm -rf dist
mkdir -p dist

# Build JavaScript files with Bun
echo "Building JavaScript files..."
bun build ./index.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./circuit-breaker.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./manager.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./types.ts --outdir ./dist --target node --format esm --sourcemap=external

echo "Build complete!"
echo "Note: TypeScript uses source .ts files for type checking"
