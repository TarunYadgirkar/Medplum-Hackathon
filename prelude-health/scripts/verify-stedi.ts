// Stedi verification — run with:  npx tsx scripts/verify-stedi.ts
//
// Without STEDI_API_KEY: unit-checks parseStediResponse against a canned 271
// sample built from Stedi's documented response shape.
// With STEDI_API_KEY (test key): fires a real test-mode eligibility check for
// every payer in MOCK_PAYERS and prints the parsed CoverageSummary — every
// row should print source=stedi with a sensible plan status.
import { checkEligibility, parseStediResponse, MOCK_PAYERS } from '../src/lib/stedi';

// Canned benefitsInformation per Stedi docs: code 1=Active, B=Co-Payment,
// C=Deductible (timeQualifierCode 23=annual, 29=remaining), A=Co-Insurance
// (benefitPercent is a string fraction). Amounts are strings.
const SAMPLE_271 = {
  benefitsInformation: [
    { code: '1', name: 'Active Coverage', serviceTypeCodes: ['30'] },
    { code: 'B', name: 'Co-Payment', benefitAmount: '20', coverageLevelCode: 'IND', inPlanNetworkIndicatorCode: 'Y', timeQualifierCode: '27' },
    { code: 'B', name: 'Co-Payment', benefitAmount: '75', coverageLevelCode: 'IND', inPlanNetworkIndicatorCode: 'N', timeQualifierCode: '27' },
    { code: 'C', name: 'Deductible', benefitAmount: '1000', coverageLevelCode: 'IND', inPlanNetworkIndicatorCode: 'Y', timeQualifierCode: '23' },
    { code: 'C', name: 'Deductible', benefitAmount: '400', coverageLevelCode: 'IND', inPlanNetworkIndicatorCode: 'Y', timeQualifierCode: '29' },
    { code: 'A', name: 'Co-Insurance', benefitPercent: '0.20', coverageLevelCode: 'IND', inPlanNetworkIndicatorCode: 'Y' },
  ],
};

function assertEq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✅' : '❌'} ${label}: got ${JSON.stringify(got)}${ok ? '' : ` — expected ${JSON.stringify(want)}`}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log('── parse check (canned 271 per Stedi docs) ──');
  const parsed = parseStediResponse(SAMPLE_271, 'Test Payer', 'primary_care', { min: 35, max: 120 });
  assertEq('plan_status', parsed.plan_status, 'Active Coverage');
  assertEq('copay (in-network preferred)', parsed.copay, 20);
  assertEq('deductible_remaining (timeQualifier 29 preferred)', parsed.deductible_remaining, 400);
  assertEq('coinsurance_percent (string fraction → pct)', parsed.coinsurance_percent, 20);
  assertEq('source', parsed.source, 'stedi');

  if (!process.env.STEDI_API_KEY) {
    console.log('\nSTEDI_API_KEY not set — skipping live checks. Set it and rerun for the real test.');
    return;
  }

  console.log('\n── live test-mode checks (one per mock payer) ──');
  for (const key of Object.keys(MOCK_PAYERS)) {
    const cov = await checkEligibility({ payerKey: key, careLevel: 'primary_care' });
    const ok = cov.source === 'stedi';
    console.log(`${ok ? '✅' : '❌'} ${key}: source=${cov.source} status="${cov.plan_status}" copay=${cov.copay} coins=${cov.coinsurance_percent}% ded=${cov.deductible_remaining}`);
    console.log(`   spoken: ${cov.spoken_summary}`);
    if (!ok) process.exitCode = 1;
  }
}

main();
