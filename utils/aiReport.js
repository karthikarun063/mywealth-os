'use strict';

/**
 * Calls OpenRouter with a free model to generate plain-English financial guidance.
 * Falls back to deterministic text if the API call fails or key is missing.
 *
 * Set OPENROUTER_API_KEY in your Vercel environment variables.
 * Free model: mistralai/mistral-7b-instruct:free
 */

const FALLBACK = {
  positives:   ['Unable to generate AI guidance at this time.'],
  negatives:   ['AI service temporarily unavailable.'],
  suggestions: ['Please check back later for personalised advice.'],
  raw:         'AI guidance temporarily unavailable.',
};

/**
 * Generate AI financial guidance from a summarised data object.
 * @param {object} summary - condensed financial metrics
 * @returns {{ positives, negatives, suggestions, raw }}
 */
async function generateAIGuidance(summary) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[AI] OPENROUTER_API_KEY not set — using fallback.');
    return buildFallback(summary);
  }

  const prompt = buildPrompt(summary);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'HTTP-Referer':   'https://mywealth-os.vercel.app',
        'X-Title':        'MyWealth OS',
      },
      body: JSON.stringify({
        model:      'mistralai/mistral-7b-instruct:free',
        max_tokens: 500,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[AI] OpenRouter error:', res.status, err.slice(0, 200));
      return buildFallback(summary);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAIResponse(text);
  } catch (err) {
    console.error('[AI] Fetch failed:', err.message);
    return buildFallback(summary);
  }
}

function buildPrompt(s) {
  return `You are a financial guidance assistant. Analyze the following personal finance summary and respond in simple plain English.

Data:
Total Assets: ₹${fmt(s.totalAssets)}
Total Liabilities: ₹${fmt(s.totalLiabilities)}
Net Worth: ₹${fmt(s.netWorth)}
Monthly Income: ₹${fmt(s.monthlyIncome)}
Monthly Expenses: ₹${fmt(s.monthlyExpense)}
Savings Rate: ${s.savingsRate.toFixed(1)}%
Emergency Fund Coverage: ${s.efMonths.toFixed(1)} months
Debt-to-Income Ratio: ${s.dtiRatio.toFixed(0)}%
Top Asset Class: ${s.topAssetClass}
Financial Score: ${s.score}/100

Return your response STRICTLY in this format (do not add anything else):

Positives:
- [positive 1]
- [positive 2]

Negatives:
- [negative 1]
- [negative 2]

Suggestions:
- [suggestion 1]
- [suggestion 2]
- [suggestion 3]

Keep advice basic, safe, practical, and non-regulated. Do not recommend specific stocks or risky financial products.`;
}

function fmt(n) {
  const abs = Math.abs(+n || 0);
  if (abs >= 1e7) return `${(abs/1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(abs/1e5).toFixed(1)} L`;
  if (abs >= 1e3) return `${(abs/1e3).toFixed(1)} K`;
  return `${Math.round(abs)}`;
}

function parseAIResponse(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sections = { positives: [], negatives: [], suggestions: [] };
  let current = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('positive'))  { current = 'positives';   continue; }
    if (lower.startsWith('negative'))  { current = 'negatives';   continue; }
    if (lower.startsWith('suggestion')){ current = 'suggestions'; continue; }
    if (line.startsWith('-') && current) {
      sections[current].push(line.replace(/^-\s*/, '').trim());
    }
  }

  // Ensure at least one entry per section
  if (!sections.positives.length)   sections.positives   = ['Your financial data has been reviewed.'];
  if (!sections.negatives.length)   sections.negatives   = ['Some areas need attention.'];
  if (!sections.suggestions.length) sections.suggestions = ['Continue tracking your expenses regularly.'];

  return {
    ...sections,
    raw: text,
  };
}

/** Deterministic fallback based on the actual metrics */
function buildFallback(s) {
  const positives   = [];
  const negatives   = [];
  const suggestions = [];

  if (s.savingsRate >= 20)     positives.push(`Strong savings rate of ${s.savingsRate.toFixed(1)}% — well above the recommended 20%.`);
  if (s.efMonths >= 6)         positives.push(`Emergency fund is healthy at ${s.efMonths.toFixed(1)} months coverage.`);
  if (s.netWorth > 0)          positives.push(`Positive net worth of ₹${fmt(s.netWorth)} indicates financial stability.`);
  if (s.dtiRatio < 20)         positives.push(`Debt-to-income ratio is safe at ${s.dtiRatio.toFixed(0)}%.`);
  if (!positives.length)       positives.push('You have taken the important step of tracking your finances.');

  if (s.savingsRate < 10)      negatives.push(`Savings rate of ${s.savingsRate.toFixed(1)}% is below the minimum recommended 10%.`);
  if (s.efMonths < 3)          negatives.push(`Emergency fund only covers ${s.efMonths.toFixed(1)} months — critically low.`);
  if (s.dtiRatio > 35)         negatives.push(`High debt-to-income ratio of ${s.dtiRatio.toFixed(0)}% strains cash flow.`);
  if (!negatives.length)       negatives.push('No critical financial risks detected at this time.');

  if (s.efMonths < 6)          suggestions.push(`Increase emergency fund to 6 months (target: ₹${fmt(s.monthlyExpense * 6)}).`);
  if (s.savingsRate < 20)      suggestions.push('Automate savings transfers on salary day to hit 20%+ savings rate.');
  if (s.dtiRatio > 20)         suggestions.push('Focus extra payments on high-interest debts using the avalanche method.');
  suggestions.push('Review and reduce the top 2 expense categories each month.');

  return { positives, negatives, suggestions, raw: '' };
}

module.exports = { generateAIGuidance };
