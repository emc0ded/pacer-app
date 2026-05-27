const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }       = require('firebase-functions/params')
const Anthropic               = require('@anthropic-ai/sdk')

// ── helpers ────────────────────────────────────────────────────
function parseJSON(text) {
  // Strip markdown fences
  let cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  // Extract the first {...} or [...] block in case there's surrounding text
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) cleaned = objMatch[0]
  return JSON.parse(cleaned)
}

/** Cap weeks to avoid token overflow — plans longer than 20 weeks get chunked */
const MAX_WEEKS = 20

// The API key is stored as a Firebase Secret — never in source code
const anthropicKey = defineSecret('ANTHROPIC_API_KEY')

// ── getRunCoaching ─────────────────────────────────────────────
// Accepts: { distanceKm, duration, pace }
// Returns: { coaching: string }
exports.getRunCoaching = onCall(
  { secrets: [anthropicKey], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const { distanceKm, duration, pace, feel } = request.data

    if (!distanceKm || !duration || !pace) {
      throw new HttpsError('invalid-argument', 'Missing run data.')
    }

    const feelLabels = { 1: 'Easy (1/5)', 2: 'Moderate (2/5)', 3: 'Hard (3/5)', 4: 'Very Hard (4/5)', 5: 'Max Effort (5/5)' }
    const feelLine = feel
      ? `- How it felt: ${feelLabels[feel] || feel}`
      : null

    const feelGuidance = feel
      ? {
          1: 'The runner found this easy — they have more in the tank. Encourage pushing the pace or distance next time.',
          2: 'The runner felt comfortable. Positive reinforcement; suggest a small goal for next run.',
          3: 'The runner worked hard. Remind them that recovery matters as much as effort.',
          4: 'The runner pushed really hard. Stress the importance of an easy recovery run next.',
          5: 'The runner went all-out. Emphasize rest — at least one full rest day before running again.',
        }[feel]
      : ''

    const client = new Anthropic({ apiKey: anthropicKey.value() })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
`You are an encouraging, knowledgeable running coach giving brief post-run feedback.

A runner just completed a run:
- Distance: ${distanceKm} km
- Total time: ${duration} (format is M:SS or H:MM:SS — e.g. "32:15" means 32 min 15 sec)
- Average pace: ${pace} per km${feelLine ? '\n' + feelLine : ''}
${feelGuidance ? '\nCoaching direction: ' + feelGuidance : ''}
Write a 2-3 sentence coaching note that:
1. Acknowledges something specific about their performance (distance or pace)
2. ${feel ? 'Directly references how they felt and gives advice tailored to that effort level' : 'Gives one concrete, actionable tip tailored to their numbers'}
3. Ends with a short motivating line for their next run

Tone: warm, direct, expert. No bullet points — flowing sentences only.`,
        },
      ],
    })

    return { coaching: msg.content[0].text }
  },
)

// ── generateRouteName ──────────────────────────────────────────
// Accepts: { distanceKm, pace, timeOfDay }
// Returns: { name: string }
exports.generateRouteName = onCall(
  { secrets: [anthropicKey], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const { distanceKm, pace, timeOfDay } = request.data

    const client = new Anthropic({ apiKey: anthropicKey.value() })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content:
`Generate a creative, evocative 2-4 word name for a ${distanceKm}km run at ${pace}/km pace${timeOfDay ? ` in the ${timeOfDay}` : ''}.

Good examples: "Harbor Tempo Loop", "Dawn Hills Run", "Easy River Miles", "Sunset Lakeside Stroll"

Return only the name — no punctuation, no explanation.`,
        },
      ],
    })

    return { name: msg.content[0].text.trim() }
  },
)

// ── generateTrainingPlan ───────────────────────────────────────
// Accepts: { goalType, goalDate, recentRuns, weeksUntilRace }
// Returns: { plan: { totalWeeks, weeks: [...] } }
exports.generateTrainingPlan = onCall(
  { secrets: [anthropicKey], region: 'us-central1', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const { goalType, goalDate, recentRuns = [], weeksUntilRace } = request.data

    if (!goalType || !goalDate || !weeksUntilRace) {
      throw new HttpsError('invalid-argument', 'Missing required plan data.')
    }

    const goalLabels = { '5k': '5K', '10k': '10K', 'half': 'Half Marathon', 'marathon': 'Marathon' }
    const goalLabel  = goalLabels[goalType] || goalType

    // Cap to MAX_WEEKS to avoid token overflow
    const weeks = Math.min(Math.max(4, Math.round(weeksUntilRace)), MAX_WEEKS)

    // Summarise recent fitness
    const recentSummary = recentRuns.length > 0
      ? recentRuns.slice(0, 6).map(r =>
          `- ${r.date}: ${Number(r.distanceMi).toFixed(2)} mi, ${r.durationMin} min`
        ).join('\n')
      : '- No prior runs (beginner)'

    const avgWeeklyMi = recentRuns.length > 0
      ? (recentRuns.reduce((s, r) => s + Number(r.distanceMi), 0) / Math.max(1, weeks * 0.5)).toFixed(1)
      : '0'

    // Monday of current week = plan start
    const today  = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const planStart = monday.toISOString().slice(0, 10)

    const client = new Anthropic({ apiKey: anthropicKey.value() })

    let rawText = ''
    try {
      const msg = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content:
`You are an expert running coach. Output a ${goalLabel} training plan as pure JSON only.

Goal: ${goalLabel} on ${goalDate}
Weeks to generate: ${weeks} (starting ${planStart})
Runner's recent runs:\n${recentSummary}
Estimated weekly mileage: ~${avgWeeklyMi} mi

Output ONLY this JSON structure, nothing else, no markdown:
{"totalWeeks":${weeks},"weeks":[{"weekNumber":1,"startDate":"YYYY-MM-DD","theme":"Base Building","workouts":[{"date":"YYYY-MM-DD","type":"Easy Run","distanceMi":3.0,"notes":"brief cue"}]}]}

Rules:
- Exactly ${weeks} week objects, 3 workouts each (keep it concise to fit in response)
- Types: Easy Run, Tempo, Long Run, Intervals, Strides
- No hard efforts on back-to-back days
- Long runs on Sat or Sun
- Taper last 2 weeks
- All dates between ${planStart} and ${goalDate}`,
        }],
      })
      rawText = msg.content[0].text
    } catch (aiErr) {
      console.error('[generateTrainingPlan] Anthropic error:', aiErr)
      throw new HttpsError('internal', 'AI request failed: ' + aiErr.message)
    }

    let plan
    try {
      plan = parseJSON(rawText)
    } catch (parseErr) {
      console.error('[generateTrainingPlan] JSON parse error. Raw:', rawText.slice(0, 500))
      throw new HttpsError('internal', 'Failed to parse AI response as JSON.')
    }

    if (!plan.weeks || !Array.isArray(plan.weeks)) {
      throw new HttpsError('internal', 'AI returned an unexpected plan structure.')
    }

    return { plan }
  },
)

// ── adaptTrainingPlan ──────────────────────────────────────────
// Accepts: { goalType, goalDate, completedWeek, actualRuns, remainingWeeks }
// Returns: { updatedWeeks: [...] }
exports.adaptTrainingPlan = onCall(
  { secrets: [anthropicKey], region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const { goalType, goalDate, completedWeek, actualRuns = [], remainingWeeks = [] } = request.data

    if (!goalType || !goalDate || !completedWeek) {
      throw new HttpsError('invalid-argument', 'Missing adaptation data.')
    }

    const goalLabels = { '5k': '5K', '10k': '10K', 'half': 'Half Marathon', 'marathon': 'Marathon' }
    const goalLabel  = goalLabels[goalType] || goalType

    const feelLabels = { 1: 'Easy', 2: 'Moderate', 3: 'Hard', 4: 'Very Hard', 5: 'Max Effort' }

    const plannedWorkouts = completedWeek.workouts || []
    const plannedSummary  = plannedWorkouts.map(w =>
      `  - ${w.date} (${w.type}): ${w.distanceMi} mi planned`
    ).join('\n') || '  - Nothing planned'

    const actualSummary = actualRuns.length > 0
      ? actualRuns.map(r => {
          const feelStr = r.effort ? ` — felt ${feelLabels[r.effort] || r.effort} (${r.effort}/5)` : ''
          return `  - ${r.date}: ${r.distanceMi.toFixed(2)} mi in ${r.durationMin} min${feelStr}`
        }).join('\n')
      : '  - No runs completed (full rest week)'

    const plannedCount   = plannedWorkouts.length
    const completedCount = actualRuns.length
    const completionPct  = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0

    // Summarise how hard the week felt overall
    const effortValues = actualRuns.map(r => r.effort).filter(Boolean)
    const avgEffort    = effortValues.length > 0
      ? (effortValues.reduce((s, e) => s + e, 0) / effortValues.length).toFixed(1)
      : null

    const adaptationNotes = [
      `Completion rate: ${completedCount}/${plannedCount} workouts (${completionPct}%)`,
      avgEffort ? `Average perceived effort: ${avgEffort}/5 (${avgEffort <= 2 ? 'felt easy overall' : avgEffort <= 3.5 ? 'felt appropriate' : 'felt very hard overall'})` : 'No effort ratings provided',
    ].join('\n')

    const client = new Anthropic({ apiKey: anthropicKey.value() })

    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content:
`You are an expert running coach adapting a ${goalLabel} training plan.

RACE DATE: ${goalDate}
COMPLETED WEEK ${completedWeek.weekNumber} (theme: ${completedWeek.theme}):

PLANNED:
${plannedSummary}

ACTUALLY COMPLETED:
${actualSummary}

WEEK SUMMARY:
${adaptationNotes}

UPCOMING WEEKS TO ADJUST (${remainingWeeks.length} weeks remaining):
${JSON.stringify(remainingWeeks, null, 2)}

Adapt the remaining weeks using these guidelines:
- If completion < 50%: reduce next week's volume by ~15-20% to ease back in
- If completion 50-80%: keep volume similar, note where runner struggled
- If completion >= 80%: maintain or slightly increase volume as planned
- If avg effort > 4 on easy/moderate runs: the runner is pushing too hard — reduce intensity, add more easy days
- If avg effort <= 2 on all runs: runner has more capacity — can nudge volume/pace up slightly
- If avg effort is 3-4 (as expected): plan is well-calibrated, make minimal changes
- Always preserve the race-day taper in the final 2 weeks
- Never increase weekly volume by more than 10% week-over-week

Return ONLY valid JSON — no explanation, no markdown fences. Use this exact schema:
{
  "updatedWeeks": [ <same week objects as input, modified as needed> ]
}`,
      }],
    })

    const result = parseJSON(msg.content[0].text)
    return { updatedWeeks: result.updatedWeeks }
  },
)
