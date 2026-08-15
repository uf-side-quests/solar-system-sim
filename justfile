default:
    @just --list

setup:
    pnpm install --frozen-lockfile

fmt:
    pnpm format

check:
    pnpm check

test:
    pnpm test

build-wasm:
    pnpm wasm:build

complete:
    pnpm complete

# Build and publish the public SPA to its permanent here.now site.
publish:
    pnpm build
    bash /Users/laurencehook/.codex/skills/here-now/scripts/publish.sh dist --slug fern-essence-m26j --spa --client codex
