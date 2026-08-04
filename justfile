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
