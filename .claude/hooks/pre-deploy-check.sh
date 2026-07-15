#!/bin/bash
# Gate de deploy: bloqueia `git push` / `vercel` se algo estiver quebrado.
# Chamado como PreToolUse hook (Bash) — recebe JSON no stdin.
#
# Checks (nesta ordem):
#   1. tsc --noEmit vs BASELINE — bloqueia só erro de tipo NOVO
#      (o repo tem 19 erros antigos catalogados em tsc-baseline.txt;
#       ao corrigir um antigo, regenere o baseline — comando no fim do arquivo)
#   2. npm run build  — o mesmo build que a Vercel roda
#   3. npm run test   — vitest

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

case "$CMD" in
  *"git push"*|*"vercel deploy"*|*"vercel --prod"*) ;;
  *) exit 0 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

BASELINE="$REPO_ROOT/.claude/hooks/tsc-baseline.txt"
LOG=$(mktemp)
CURR=$(mktemp)
trap 'rm -f "$LOG" "$CURR"' EXIT

# --- 1. typecheck com baseline (tsconfig raiz e solution-style; usar o do app)
npx tsc --noEmit -p tsconfig.app.json >"$LOG" 2>&1
grep -E '^[^ ]+\([0-9]+,[0-9]+\): error TS' "$LOG" \
  | sed -E 's/^([^(]+)\([0-9]+,[0-9]+\): error (TS[0-9]+):.*/\1|\2/' \
  | sort | uniq -c | awk '{print $1" "$2}' >"$CURR"

NEW_KEYS=$(awk 'NR==FNR{base[$2]=$1;next}{if($1 > base[$2]+0) print $2}' "$BASELINE" "$CURR")
if [ -n "$NEW_KEYS" ]; then
  echo "DEPLOY BLOQUEADO: erro de tipo NOVO (alem do baseline de erros antigos conhecidos). Corrija antes do push:" >&2
  while IFS= read -r key; do
    FILE="${key%%|*}"
    CODE="${key##*|}"
    grep -F "$FILE" "$LOG" | grep -F "error $CODE" >&2
  done <<< "$NEW_KEYS"
  exit 2
fi

# --- 2. build de producao (mesmo comando da Vercel)
if ! npm run build >"$LOG" 2>&1; then
  echo "DEPLOY BLOQUEADO: build de producao (npm run build) falhou. Corrija antes do push:" >&2
  tail -40 "$LOG" >&2
  exit 2
fi

# --- 3. testes
if ! npm run test >"$LOG" 2>&1; then
  echo "DEPLOY BLOQUEADO: testes (vitest) falharam. Corrija antes do push:" >&2
  tail -40 "$LOG" >&2
  exit 2
fi

echo "Pre-deploy OK: sem erro de tipo novo, build e testes passaram." >&2
exit 0

# Regenerar baseline (apos corrigir erros antigos de proposito):
#   npx tsc --noEmit -p tsconfig.app.json 2>&1 \
#     | grep -E '^[^ ]+\([0-9]+,[0-9]+\): error TS' \
#     | sed -E 's/^([^(]+)\([0-9]+,[0-9]+\): error (TS[0-9]+):.*/\1|\2/' \
#     | sort | uniq -c | awk '{print $1" "$2}' > .claude/hooks/tsc-baseline.txt
