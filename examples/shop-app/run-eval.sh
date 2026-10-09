#!/usr/bin/env bash
# Runs the ShopBank suite on v1 (green baseline, fingerprints recorded), then on
# a later release (v2, or the v3 holdout) with healing on, and scores the result. Nothing is applied to
# the test files. Usage: ./run-eval.sh [v2|v3]
set -euo pipefail
cd "$(dirname "$0")"
release="${1:-v2}"
export CHROMIUM_PATH="${CHROMIUM_PATH:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}"
heal() { node --import tsx ../../src/cli.ts "$@"; }
rm -rf .heal ".results/$release" && mkdir -p ".results/$release"

APP_VERSION=v1 TRUTH_LOG="$PWD/.results/$release/truth-v1.jsonl" heal run -- npx playwright test
HEAL_OFF=1 APP_VERSION="$release" npx playwright test --reporter=line > ".results/$release/no-healing.txt" 2>&1 || true
APP_VERSION="$release" TRUTH_LOG="$PWD/.results/$release/truth-$release.jsonl" heal run -- npx playwright test > ".results/$release/healing.txt" 2>&1 || true
tail -40 ".results/$release/healing.txt"
echo
echo "Without healing: $(grep -Eo '[0-9]+ (passed|failed)' ".results/$release/no-healing.txt" | tr '\n' ' ')"
echo "With healing:    $(grep -Eo '^ +[0-9]+ (passed|failed)' ".results/$release/healing.txt" | tr -s ' ' | tr '\n' ' ')"
node --import tsx evaluate.ts .heal ".results/$release/truth-v1.jsonl" ".results/$release/truth-$release.jsonl" "ShopBank v1 -> $release" | tee ".results/$release/score.md"
