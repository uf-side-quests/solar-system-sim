#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$project_root/src/physics/wasm/generated"

if [[ ! -f "$project_root/vendor/rebound/src/rebound.h" ]]; then
  echo "Missing pinned REBOUND source at vendor/rebound" >&2
  exit 1
fi

mkdir -p "$output_dir"

compile() {
  local environment="$1"
  local output="$2"
  docker run --rm \
    --volume "$project_root:/src" \
    --workdir /src \
    --user "$(id -u):$(id -g)" \
    emscripten/emsdk:6.0.4 \
    emcc \
    -O3 \
    -flto \
    -DREB_EMSCRIPTEN_NO_YIELD=1 \
    -Ivendor/rebound/src \
    vendor/rebound/src/*.c \
    src/physics/wasm/rebound_bridge.c \
    --no-entry \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sENVIRONMENT="$environment" \
    -sALLOW_MEMORY_GROWTH=1 \
    -sFILESYSTEM=0 \
    -sSTACK_SIZE=1048576 \
    -sWASM_BIGINT=1 \
    -sEXPORTED_FUNCTIONS='["_sste_create","_sste_add_body","_sste_move_to_barycentre","_sste_integrate","_sste_time","_sste_energy","_sste_body_count","_sste_active_body_count","_sste_body_value"]' \
    -o "$output"
}

compile "web,worker" "src/physics/wasm/generated/rebound.mjs"
compile "node" "src/physics/wasm/generated/rebound-node.mjs"
