#!/usr/bin/env bash

# Clean dist directory
rm -rf dist
mkdir -p dist

# Build JavaScript files with Bun
echo "Building JavaScript files..."
bun build ./src/index.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./src/circuit-breaker.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./src/manager.ts --outdir ./dist --target node --format esm --sourcemap=external
bun build ./src/types.ts --outdir ./dist --target node --format esm --sourcemap=external

echo "Build complete!"
echo "Note: TypeScript uses source .ts files for type checking"
