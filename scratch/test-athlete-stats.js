/**
 * Verification test suite for athlete stats calculation formulas and age brackets.
 * Run with: node scratch/test-athlete-stats.js
 */

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

// Transpile and load src/lib/athlete-stats.ts dynamically
function loadModule() {
  const tsPath = path.resolve(__dirname, '../src/lib/athlete-stats.ts')
  const code = fs.readFileSync(tsPath, 'utf8')
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const customModule = { exports: {} }
  const fn = new Function('module', 'exports', 'require', transpiled)
  fn(customModule, customModule.exports, require)
  return customModule.exports
}

const stats = loadModule()

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++
    console.log(`  ✓ ${message} (Got: ${actual})`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`)
  }
}

console.log('==================================================')
console.log('   TEST SUITE: ATHLETE STATS & CALCULATION LOGIC  ')
console.log('==================================================\n')

// 1. AGE CALCULATION & EDGE CASES
console.log('[Test Group 1] calculateAge & isChildCategory')
const refDate = new Date('2026-11-16T00:00:00Z')

assertEqual(stats.calculateAge('2014-11-16', refDate), 12, 'Exact 12th birthday today')
assertEqual(stats.calculateAge('2014-11-16T23:59:59Z', refDate), 12, 'ISO timestamp with time tokenized cleanly without day shift')
assertEqual(stats.calculateAge('2014-11-16T00:00:00.000Z', refDate), 12, 'ISO timestamp with midnight tokenized cleanly')
assertEqual(stats.calculateAge('2014-11-17', refDate), 11, '1 day before 12th birthday (age 11)')
assertEqual(stats.calculateAge('2014-11-15', refDate), 12, '1 day after 12th birthday (age 12)')
assertEqual(stats.calculateAge('2018-05-20', refDate), 8, '8 years old child')
assertEqual(stats.calculateAge('2006-03-01', refDate), 20, '20 years old adult')
assertEqual(stats.calculateAge(null, refDate), 0, 'Null birthdate defaults safely to 0')
assertEqual(stats.calculateAge('', refDate), 0, 'Empty string birthdate defaults safely to 0')
assertEqual(stats.calculateAge('invalid-date', refDate), 0, 'Invalid birthdate string defaults safely to 0')
assertEqual(stats.calculateAge('2030-01-01', refDate), 0, 'Future birthdate returns 0')

assertEqual(stats.isChildCategory(11), true, 'Age 11 is child category (< 12)')
assertEqual(stats.isChildCategory(12), false, 'Age 12 is NOT child category (>= 12)')
assertEqual(stats.isChildCategory(0), true, 'Age 0 is child category')

// 2. DISCIPLINE SCORE & ATTENDANCE ZERO EDGE CASE
console.log('\n[Test Group 2] calculateDisciplineScore (Zero attendance & Normal)')
assertEqual(stats.calculateDisciplineScore(0, 0, 85), 85, 'Zero total sessions bypasses division, returns attitude score')
assertEqual(stats.calculateDisciplineScore(0, 0), 85, 'Zero total sessions with default attitude score')
assertEqual(stats.calculateDisciplineScore(4, 4, 80), 90, '100% attendance (50) + 80 attitude (40) = 90')
assertEqual(stats.calculateDisciplineScore(2, 4, 80), 65, '50% attendance (25) + 80 attitude (40) = 65')
assertEqual(stats.calculateDisciplineScore(0, 4, 80), 40, '0% attendance (0) + 80 attitude (40) = 40')

// 3. RAW PHYSICAL TESTS TO SCORE (<12 vs >=12)
console.log('\n[Test Group 3] convertRawTestToScore - Physical test conversions')

// Push-up / Sit-up Child (< 12 thn: <10 -> 60, 10-18 -> 72, 19-28 -> 82, >=29 -> 95)
assertEqual(stats.convertRawTestToScore('pushup', 5, 10), 60, 'Pushup Child < 10 -> 60')
assertEqual(stats.convertRawTestToScore('pushup', 9, 10), 60, 'Pushup Child 9 -> 60')
assertEqual(stats.convertRawTestToScore('pushup', 10, 10), 72, 'Pushup Child 10 -> 72')
assertEqual(stats.convertRawTestToScore('pushup', 18, 10), 72, 'Pushup Child 18 -> 72')
assertEqual(stats.convertRawTestToScore('pushup', 19, 10), 82, 'Pushup Child 19 -> 82')
assertEqual(stats.convertRawTestToScore('pushup', 28, 10), 82, 'Pushup Child 28 -> 82')
assertEqual(stats.convertRawTestToScore('pushup', 29, 10), 95, 'Pushup Child 29 -> 95')
assertEqual(stats.convertRawTestToScore('pushup', 40, 10), 95, 'Pushup Child 40 -> 95')

// Push-up / Sit-up Adult (>= 12 thn: <15 -> 60, 15-25 -> 72, 26-38 -> 82, >=39 -> 95)
assertEqual(stats.convertRawTestToScore('pushup', 10, 14), 60, 'Pushup Adult 10 -> 60')
assertEqual(stats.convertRawTestToScore('pushup', 14, 14), 60, 'Pushup Adult 14 -> 60')
assertEqual(stats.convertRawTestToScore('pushup', 15, 14), 72, 'Pushup Adult 15 -> 72')
assertEqual(stats.convertRawTestToScore('pushup', 25, 14), 72, 'Pushup Adult 25 -> 72')
assertEqual(stats.convertRawTestToScore('pushup', 26, 14), 82, 'Pushup Adult 26 -> 82')
assertEqual(stats.convertRawTestToScore('pushup', 38, 14), 82, 'Pushup Adult 38 -> 82')
assertEqual(stats.convertRawTestToScore('pushup', 39, 14), 95, 'Pushup Adult 39 -> 95')
assertEqual(stats.convertRawTestToScore('pushup', 50, 14), 95, 'Pushup Adult 50 -> 95')

// Kicking Speed 30s Child (< 12 thn: <22 -> 60, 22-30 -> 72, 31-40 -> 82, >=41 -> 95)
assertEqual(stats.convertRawTestToScore('kicking_speed', 21, 10), 60, 'Kicking Speed Child 21 -> 60')
assertEqual(stats.convertRawTestToScore('kicking_speed', 22, 10), 72, 'Kicking Speed Child 22 -> 72')
assertEqual(stats.convertRawTestToScore('kicking_speed', 30, 10), 72, 'Kicking Speed Child 30 -> 72')
assertEqual(stats.convertRawTestToScore('kicking_speed', 31, 10), 82, 'Kicking Speed Child 31 -> 82')
assertEqual(stats.convertRawTestToScore('kicking_speed', 40, 10), 82, 'Kicking Speed Child 40 -> 82')
assertEqual(stats.convertRawTestToScore('kicking_speed', 41, 10), 95, 'Kicking Speed Child 41 -> 95')

// Kicking Speed 30s Adult (>= 12 thn: <25 -> 60, 25-34 -> 72, 35-44 -> 82, >=45 -> 95)
assertEqual(stats.convertRawTestToScore('kicking_speed', 24, 15), 60, 'Kicking Speed Adult 24 -> 60')
assertEqual(stats.convertRawTestToScore('kicking_speed', 25, 15), 72, 'Kicking Speed Adult 25 -> 72')
assertEqual(stats.convertRawTestToScore('kicking_speed', 34, 15), 72, 'Kicking Speed Adult 34 -> 72')
assertEqual(stats.convertRawTestToScore('kicking_speed', 35, 15), 82, 'Kicking Speed Adult 35 -> 82')
assertEqual(stats.convertRawTestToScore('kicking_speed', 44, 15), 82, 'Kicking Speed Adult 44 -> 82')
assertEqual(stats.convertRawTestToScore('kicking_speed', 45, 15), 95, 'Kicking Speed Adult 45 -> 95')

// Split Distance cm (0cm flat -> 98, 1-5cm -> 90, 6-10cm -> 80, 11-20cm -> 70, >20cm -> 60)
assertEqual(stats.convertRawTestToScore('split', 0, 10), 98, 'Split 0cm flat -> 98')
assertEqual(stats.convertRawTestToScore('split', -1, 10), 98, 'Split negative cm -> 98')
assertEqual(stats.convertRawTestToScore('split', 3, 10), 90, 'Split 3cm -> 90')
assertEqual(stats.convertRawTestToScore('split', 5, 10), 90, 'Split 5cm -> 90')
assertEqual(stats.convertRawTestToScore('split', 6, 10), 80, 'Split 6cm -> 80')
assertEqual(stats.convertRawTestToScore('split', 10, 10), 80, 'Split 10cm -> 80')
assertEqual(stats.convertRawTestToScore('split', 11, 10), 70, 'Split 11cm -> 70')
assertEqual(stats.convertRawTestToScore('split', 20, 10), 70, 'Split 20cm -> 70')
assertEqual(stats.convertRawTestToScore('split', 25, 10), 60, 'Split 25cm -> 60')

// Skipping / Jumping Jack sec (<60s -> 60, 60-90s -> 72, 91-120s -> 82, >120s -> 95)
assertEqual(stats.convertRawTestToScore('skipping', 50, 10), 60, 'Skipping 50s -> 60')
assertEqual(stats.convertRawTestToScore('skipping', 60, 10), 72, 'Skipping 60s -> 72')
assertEqual(stats.convertRawTestToScore('skipping', 90, 10), 72, 'Skipping 90s -> 72')
assertEqual(stats.convertRawTestToScore('skipping', 91, 10), 82, 'Skipping 91s -> 82')
assertEqual(stats.convertRawTestToScore('skipping', 120, 10), 82, 'Skipping 120s -> 82')
assertEqual(stats.convertRawTestToScore('skipping', 130, 10), 95, 'Skipping 130s -> 95')

// Technique Stars
assertEqual(stats.convertRawTestToScore('technique', 1, 10), 55, 'Technique 1 star -> 55')
assertEqual(stats.convertRawTestToScore('technique', 2, 10), 65, 'Technique 2 stars -> 65')
assertEqual(stats.convertRawTestToScore('technique', 3, 10), 75, 'Technique 3 stars -> 75')
assertEqual(stats.convertRawTestToScore('technique', 4, 10), 85, 'Technique 4 stars -> 85')
assertEqual(stats.convertRawTestToScore('technique', 5, 10), 95, 'Technique 5 stars -> 95')

// 4. OVR CALCULATION & TIERS
console.log('\n[Test Group 4] calculateOVR & getOVRTier')
const sampleScores = {
  skor_str: 80,
  skor_agi: 85,
  skor_flx: 90,
  skor_sta: 75,
  skor_tec: 85,
  skor_dis: 95,
}
// Sum = 510, 510 / 6 = 85
assertEqual(stats.calculateOVR(sampleScores), 85, 'OVR average calculation is accurate (85)')
assertEqual(stats.getOVRTier(85).badge, 'GOLD TIER', 'OVR 85 is GOLD TIER')
assertEqual(stats.getOVRTier(92).badge, 'DIAMOND TIER', 'OVR 92 is DIAMOND TIER')
assertEqual(stats.getOVRTier(75).badge, 'SILVER TIER', 'OVR 75 is SILVER TIER')
assertEqual(stats.getOVRTier(65).badge, 'BRONZE TIER', 'OVR 65 is BRONZE TIER')

// 5. ARCHETYPE DETERMINATION
console.log('\n[Test Group 5] determineArchetype')
// All-Rounder (max - min <= 7)
const balancedScores = {
  skor_str: 80,
  skor_agi: 82,
  skor_flx: 78,
  skor_sta: 85,
  skor_tec: 80,
  skor_dis: 82,
}
assertEqual(stats.determineArchetype(balancedScores), 'All-Rounder Fighter', 'Balanced scores yield All-Rounder Fighter')

// Specific archetypes when max - min > 7
assertEqual(
  stats.determineArchetype({ skor_str: 70, skor_agi: 95, skor_flx: 75, skor_sta: 75, skor_tec: 75, skor_dis: 75 }),
  '⚡ Speed Striker',
  'AGI dominant yields ⚡ Speed Striker'
)
assertEqual(
  stats.determineArchetype({ skor_str: 95, skor_agi: 70, skor_flx: 75, skor_sta: 75, skor_tec: 75, skor_dis: 75 }),
  '💥 Power Kicker',
  'STR dominant yields 💥 Power Kicker'
)
assertEqual(
  stats.determineArchetype({ skor_str: 75, skor_agi: 70, skor_flx: 98, skor_sta: 75, skor_tec: 75, skor_dis: 75 }),
  '🤸 Flex Master',
  'FLX dominant yields 🤸 Flex Master'
)
assertEqual(
  stats.determineArchetype({ skor_str: 75, skor_agi: 70, skor_flx: 75, skor_sta: 95, skor_tec: 75, skor_dis: 75 }),
  '🫁 Iron Engine',
  'STA dominant yields 🫁 Iron Engine'
)
assertEqual(
  stats.determineArchetype({ skor_str: 75, skor_agi: 70, skor_flx: 75, skor_sta: 75, skor_tec: 95, skor_dis: 75 }),
  '🥋 Poomsae Specialist',
  'TEC dominant yields 🥋 Poomsae Specialist'
)
assertEqual(
  stats.determineArchetype({ skor_str: 75, skor_agi: 70, skor_flx: 75, skor_sta: 75, skor_tec: 75, skor_dis: 95 }),
  '⭐ Disciplined Guardian',
  'DIS dominant yields ⭐ Disciplined Guardian'
)

// 6. LEVEL UP MISSIONS GENERATION
console.log('\n[Test Group 6] generateLevelUpMissions')
const studentWithWeakness = {
  skor_str: 85,
  skor_agi: 90,
  skor_flx: 60, // lowest 1
  skor_sta: 68, // lowest 2
  skor_tec: 80,
  skor_dis: 95,
}
const missions = stats.generateLevelUpMissions(studentWithWeakness)
assertEqual(missions.length, 2, 'Generates exactly 2 missions for lowest attributes')
assertEqual(missions[0].attribute, 'skor_flx', 'First mission targets lowest attribute (FLX)')
assertEqual(missions[0].score, 60, 'First mission reflects correct score')
assert(missions[0].title.length > 0, 'First mission has descriptive title')
assert(missions[0].target.length > 0, 'First mission has actionable target')
assertEqual(missions[1].attribute, 'skor_sta', 'Second mission targets second lowest attribute (STA)')

// 7. FALLBACK MAPPER FOR LEGACY DATA
console.log('\n[Test Group 7] mapLegacyPenilaianToStats')
// Already has 6 attributes
const modernData = {
  skor_str: 88,
  skor_agi: 86,
  skor_flx: 82,
  skor_sta: 80,
  skor_tec: 90,
  skor_dis: 95,
}
const mappedModern = stats.mapLegacyPenilaianToStats(modernData)
assertEqual(mappedModern.skor_str, 88, 'Modern data retains original skor_str')
assertEqual(mappedModern.skor_tec, 90, 'Modern data retains original skor_tec')

// Legitimate score of 0 should be preserved, not fall back to legacy formula
const zeroScorePenilaian = {
  skor_str: 0,
  skor_agi: 70,
  skor_flx: 65,
  skor_sta: 60,
  skor_tec: 55,
  skor_dis: 80,
}
const mappedZero = stats.mapLegacyPenilaianToStats(zeroScorePenilaian)
assertEqual(mappedZero.skor_str, 0, 'Legitimate score of 0 for skor_str is retained without fallback')

// Legacy data (only 4 pillars)
const legacyData = {
  skor_fisik: 80,
  skor_kyorugi: 84,
  skor_poomsae: 78,
  skor_disiplin: 92,
}
const mappedLegacy = stats.mapLegacyPenilaianToStats(legacyData)
assertEqual(mappedLegacy.skor_tec, 78, 'Legacy poomsae maps to skor_tec')
assertEqual(mappedLegacy.skor_dis, 92, 'Legacy disiplin maps to skor_dis')
assertEqual(mappedLegacy.skor_sta, 80, 'Legacy fisik maps to skor_sta')
assert(mappedLegacy.skor_str >= 80 && mappedLegacy.skor_str <= 85, 'Legacy kyorugi & fisik map to skor_str')
assert(mappedLegacy.skor_flx >= 75 && mappedLegacy.skor_flx <= 85, 'Legacy fisik & poomsae map to skor_flx')

// Empty / Null input
const emptyResult = stats.mapLegacyPenilaianToStats(null)
assertEqual(emptyResult.skor_str, 75, 'Null input safely yields default skor_str (75)')
assertEqual(emptyResult.skor_dis, 85, 'Null input safely yields default skor_dis (85)')

// 8. RADAR FORMATTER
console.log('\n[Test Group 8] formatAttributesForRadar')
const radarFormatted = stats.formatAttributesForRadar(sampleScores)
assertEqual(radarFormatted.length, 6, 'Radar formatted array has 6 attributes')
assertEqual(radarFormatted[0].attribute, 'STR', 'Radar item 1 is STR')
assertEqual(radarFormatted[0].value, 80, 'Radar item 1 has correct value')

console.log('\n==================================================')
console.log(`TOTAL TESTS: ${passed + failed}`)
console.log(`PASSED: ${passed}`)
console.log(`FAILED: ${failed}`)
console.log('==================================================')

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!')
}
