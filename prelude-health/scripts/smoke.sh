#!/usr/bin/env bash
# Keyless end-to-end smoke test. Run with the dev server up:  npm run dev &
# Usage: bash scripts/smoke.sh [base_url]   (default http://localhost:3000)
set -e
BASE="${1:-http://localhost:3000}"
pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "── Prelude smoke test against $BASE ──"

# 1. Pages respond
for p in / /intake /dashboard; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")
  [ "$code" = "200" ] && pass "GET $p → 200" || fail "GET $p → $code"
done

# 2. Start an intake session
S=$(curl -s -X POST "$BASE/api/intake-session" -H 'Content-Type: application/json' \
  -d '{"patientName":"Smoke Test","appointmentType":"Sick visit"}')
PID=$(echo "$S" | python3 -c 'import json,sys;print(json.load(sys.stdin)["patientId"])') || fail "intake-session: $S"
EID=$(echo "$S" | python3 -c 'import json,sys;print(json.load(sys.stdin)["encounterId"])')
pass "intake-session → patient $PID"

# 3. Voice config resolves to a provider
PROV=$(curl -s "$BASE/api/voice-config" | python3 -c 'import json,sys;print(json.load(sys.stdin)["provider"])')
pass "voice-config → $PROV"

# 4. Generate note from a transcript
N=$(curl -s -X POST "$BASE/api/generate-note" -H 'Content-Type: application/json' \
  -d "{\"transcript\":\"Patient: I have an itchy rash on my arm for three days.\",\"patientId\":\"$PID\",\"encounterId\":\"$EID\",\"patientName\":\"Smoke Test\"}")
NOTE_ID=$(echo "$N" | python3 -c 'import json,sys;print(json.load(sys.stdin)["noteId"])') || fail "generate-note: $N"
CARE=$(echo "$N" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["care_recommendation"]["care_level"])')
COV=$(echo "$N" | python3 -c 'import json,sys;print(json.load(sys.stdin)["coverage"]["source"])')
pass "generate-note → note $NOTE_ID (care: $CARE, coverage: $COV)"

# 5. Dashboard queue includes the patient
curl -s "$BASE/api/patients" | python3 -c "
import json,sys
rows=json.load(sys.stdin)
assert any(r['id']=='$PID' for r in rows), 'patient missing from queue'
" && pass "patients queue includes new patient" || fail "patients queue"

# 6. Note readable + reviewable
curl -s "$BASE/api/notes/$NOTE_ID" | python3 -c 'import json,sys;n=json.load(sys.stdin);assert n["soap_subjective"]' \
  && pass "note GET has SOAP" || fail "note GET"
curl -s -X PATCH "$BASE/api/notes/$NOTE_ID" -H 'Content-Type: application/json' -d '{"status":"reviewed"}' \
  | python3 -c 'import json,sys;assert json.load(sys.stdin)["status"]=="reviewed"' \
  && pass "note PATCH → reviewed" || fail "note PATCH"

# 7. Eligibility + history endpoints
curl -s -X POST "$BASE/api/eligibility" -H 'Content-Type: application/json' -d '{"careLevel":"telehealth"}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("   eligibility source:",d["source"])' && pass "eligibility"
curl -s -X POST "$BASE/api/history" -H 'Content-Type: application/json' -d "{\"patientId\":\"$PID\",\"query\":\"previous rash\"}" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("   history source:",d["source"],"hits:",len(d["results"]))' && pass "history"

echo "── ALL SMOKE TESTS PASSED ──"
