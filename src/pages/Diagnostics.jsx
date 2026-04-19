import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import './Diagnostics.css';

const TESTS = [
  {
    id: 'sl_glute_bridge',
    name: 'SL Glute Bridge Hold',
    description: 'Hold each side as long as possible',
    bilateral: true,
    unit: 'seconds',
    icon: '🍑',
    instruction: 'Lie on your back. Plant one foot, lift the other leg, and hold the bridge at the top. Stop when your hips drop.',
  },
  {
    id: 'hamstring_iso',
    name: 'Hamstring ISO Hold',
    description: 'Max isometric hold',
    bilateral: false,
    unit: 'seconds',
    icon: '🦵',
    instruction: 'Nordic hold or prone hamstring contraction. Hold peak contraction as long as possible.',
  },
  {
    id: 'calf_raises',
    name: 'Single Leg Calf Raises',
    description: 'Max reps each side',
    bilateral: true,
    unit: 'reps',
    icon: '🦶',
    instruction: 'Stand on one foot, full range of motion calf raise. Count reps to failure.',
  },
];

function imbalanceColor(pct) {
  if (pct <= 10) return 'var(--success)';
  if (pct <= 25) return '#ffaa00';
  return 'var(--danger)';
}

function imbalancePct(a, b) {
  if (!a || !b) return 0;
  return Math.round(Math.abs(a - b) / Math.max(a, b) * 100);
}

// ─── Body diagram SVG ─────────────────────────────────────────────────────────
function BodyDiagram({ results }) {
  const glute = results.sl_glute_bridge;
  const hamstring = results.hamstring_iso;
  const calf = results.calf_raises;

  const glutePct = glute ? imbalancePct(glute.leftValue, glute.rightValue) : null;
  const calfPct = calf ? imbalancePct(calf.leftValue, calf.rightValue) : null;

  const gluteColor = glutePct !== null ? imbalanceColor(glutePct) : 'var(--surface-3)';
  const hamColor = hamstring ? 'var(--info)' : 'var(--surface-3)';
  const calfLColor = calf ? imbalanceColor(calfPct) : 'var(--surface-3)';
  const calfRColor = calf ? imbalanceColor(calfPct) : 'var(--surface-3)';

  const bodyFill = 'var(--surface-2)';
  const bodyStroke = 'var(--border)';

  return (
    <div className="body-diagram">
      <svg viewBox="0 0 280 400" className="body-diagram__svg">
        {/* ── Silhouette ── */}
        {/* Head */}
        <circle cx="140" cy="38" r="26" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Neck */}
        <rect x="131" y="63" width="18" height="18" rx="4" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Left arm */}
        <rect x="82" y="82" width="26" height="75" rx="13" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Right arm */}
        <rect x="172" y="82" width="26" height="75" rx="13" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Torso */}
        <rect x="108" y="81" width="64" height="90" rx="10" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Hips / glutes zone */}
        <rect x="104" y="163" width="72" height="42" rx="10" fill={gluteColor} fillOpacity="0.35" stroke={gluteColor} strokeWidth="1.5" />
        {/* Left upper leg (hamstring zone) */}
        <rect x="107" y="200" width="28" height="78" rx="12" fill={hamColor} fillOpacity="0.3" stroke={hamColor} strokeWidth="1.5" />
        {/* Right upper leg (hamstring zone) */}
        <rect x="145" y="200" width="28" height="78" rx="12" fill={hamColor} fillOpacity="0.3" stroke={hamColor} strokeWidth="1.5" />
        {/* Left calf */}
        <rect x="109" y="278" width="24" height="72" rx="10" fill={calfLColor} fillOpacity="0.35" stroke={calfLColor} strokeWidth="1.5" />
        {/* Right calf */}
        <rect x="147" y="278" width="24" height="72" rx="10" fill={calfRColor} fillOpacity="0.35" stroke={calfRColor} strokeWidth="1.5" />
        {/* Left foot */}
        <ellipse cx="121" cy="358" rx="16" ry="8" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />
        {/* Right foot */}
        <ellipse cx="159" cy="358" rx="16" ry="8" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.5" />

        {/* ── Labels ── */}
        {/* Glutes label */}
        {glute && (
          <>
            <line x1="102" y1="184" x2="60" y2="184" stroke={gluteColor} strokeWidth="1" strokeDasharray="3,2" />
            <text x="56" y="180" textAnchor="end" fontSize="10" fontWeight="700" fill={gluteColor}>{glute.leftValue}s L</text>
            <text x="56" y="192" textAnchor="end" fontSize="10" fill="var(--text-secondary)">{glutePct}% diff</text>
            <line x1="178" y1="184" x2="220" y2="184" stroke={gluteColor} strokeWidth="1" strokeDasharray="3,2" />
            <text x="224" y="180" fontSize="10" fontWeight="700" fill={gluteColor}>R {glute.rightValue}s</text>
          </>
        )}
        {/* Hamstring label */}
        {hamstring && (
          <>
            <line x1="105" y1="238" x2="56" y2="238" stroke={hamColor} strokeWidth="1" strokeDasharray="3,2" />
            <text x="52" y="234" textAnchor="end" fontSize="10" fontWeight="700" fill={hamColor}>{hamstring.value}s</text>
            <text x="52" y="246" textAnchor="end" fontSize="9" fill="var(--text-secondary)">hamstring</text>
          </>
        )}
        {/* Calf labels */}
        {calf && (
          <>
            <line x1="107" y1="314" x2="58" y2="314" stroke={calfLColor} strokeWidth="1" strokeDasharray="3,2" />
            <text x="54" y="310" textAnchor="end" fontSize="10" fontWeight="700" fill={calfLColor}>{calf.leftValue} L</text>
            <text x="54" y="322" textAnchor="end" fontSize="9" fill="var(--text-secondary)">{calfPct}% diff</text>
            <line x1="173" y1="314" x2="222" y2="314" stroke={calfRColor} strokeWidth="1" strokeDasharray="3,2" />
            <text x="226" y="310" fontSize="10" fontWeight="700" fill={calfRColor}>R {calf.rightValue}</text>
          </>
        )}

        {/* Legend dots */}
        <circle cx="108" cy="380" r="4" fill="var(--success)" />
        <text x="116" y="384" fontSize="9" fill="var(--text-secondary)">Balanced</text>
        <circle cx="165" cy="380" r="4" fill="#ffaa00" />
        <text x="173" y="384" fontSize="9" fill="var(--text-secondary)">10-25%</text>
        <circle cx="218" cy="380" r="4" fill="var(--danger)" />
        <text x="226" y="384" fontSize="9" fill="var(--text-secondary)">&gt;25%</text>
      </svg>
    </div>
  );
}

// ─── Running test ─────────────────────────────────────────────────────────────
function RunningTest({ test, phase, elapsed, running, repCount, leftValue, onStart, onStop, onAddRep, onRepsDone, onBack }) {
  const phaseName = phase === 'single' ? null : (phase === 'left' ? 'Left Side' : 'Right Side');
  const isReps = test.unit === 'reps';
  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const timeStr = `${m}:${String(s).padStart(2, '0')}`;

  return (
    <div className="diag-running slide-in">
      <button className="diag-back-btn" onClick={onBack}>← Back</button>
      <div className="diag-running__test-name">{test.name}</div>
      {phaseName && <div className="diag-running__phase">{phaseName}</div>}
      <div className="diag-running__instruction">{test.instruction}</div>

      {!isReps ? (
        /* Timer mode */
        <div className="diag-running__timer-area">
          <div className="diag-running__timer">{timeStr}</div>
          {leftValue !== null && phase === 'right' && (
            <div className="diag-running__prev">Left: {leftValue}s</div>
          )}
          {!running ? (
            <button className="btn btn--primary diag-running__action-btn" onClick={onStart}>
              {elapsed > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button className="btn btn--danger diag-running__action-btn" onClick={onStop}>
              Stop
            </button>
          )}
        </div>
      ) : (
        /* Rep counter mode */
        <div className="diag-running__timer-area">
          <div className="diag-running__rep-count" onClick={onAddRep}>{repCount}</div>
          <div className="diag-running__rep-hint">Tap to count</div>
          {leftValue !== null && phase === 'right' && (
            <div className="diag-running__prev">Left: {leftValue} reps</div>
          )}
          <button className="btn btn--primary diag-running__action-btn" onClick={onRepsDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────
function ResultsView({ test, leftValue, rightValue, onSave, onDiscard }) {
  const isBilateral = test.bilateral;
  const pct = isBilateral ? imbalancePct(leftValue, rightValue) : null;
  const color = pct !== null ? imbalanceColor(pct) : 'var(--info)';
  const weaker = isBilateral
    ? (leftValue < rightValue ? 'Left' : leftValue > rightValue ? 'Right' : null)
    : null;

  return (
    <div className="diag-results slide-in">
      <div className="diag-results__title">{test.name}</div>
      <div className="diag-results__scores">
        {isBilateral ? (
          <>
            <div className="diag-results__score">
              <div className="diag-results__score-label">Left</div>
              <div className="diag-results__score-value" style={{ color: leftValue <= rightValue ? 'var(--danger)' : 'var(--success)' }}>
                {leftValue}{test.unit === 'seconds' ? 's' : ''}
              </div>
            </div>
            <div className="diag-results__score-divider">
              <div className="diag-results__imbalance" style={{ color }}>
                {pct}%{'\n'}diff
              </div>
            </div>
            <div className="diag-results__score">
              <div className="diag-results__score-label">Right</div>
              <div className="diag-results__score-value" style={{ color: rightValue <= leftValue ? 'var(--danger)' : 'var(--success)' }}>
                {rightValue}{test.unit === 'seconds' ? 's' : ''}
              </div>
            </div>
          </>
        ) : (
          <div className="diag-results__score">
            <div className="diag-results__score-label">Hold Time</div>
            <div className="diag-results__score-value" style={{ color: 'var(--info)' }}>{rightValue}s</div>
          </div>
        )}
      </div>
      {weaker && (
        <div className="diag-results__insight" style={{ borderColor: color, color }}>
          {weaker} side is weaker by {pct}%
        </div>
      )}
      {!weaker && pct === 0 && isBilateral && (
        <div className="diag-results__insight" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          Perfectly balanced
        </div>
      )}
      <button className="btn btn--primary btn--full" style={{ marginBottom: 10 }} onClick={onSave}>
        Save Results
      </button>
      <button className="btn btn--ghost btn--full" onClick={onDiscard}>
        Discard
      </button>
    </div>
  );
}

// ─── Test card ────────────────────────────────────────────────────────────────
function TestCard({ test, latest, onStart }) {
  let latestSummary = null;
  if (latest) {
    if (test.bilateral) {
      const pct = imbalancePct(latest.leftValue, latest.rightValue);
      const color = imbalanceColor(pct);
      latestSummary = (
        <span style={{ color, fontSize: 12, fontWeight: 700 }}>
          L:{latest.leftValue} R:{latest.rightValue} · {pct}% diff
        </span>
      );
    } else {
      latestSummary = (
        <span style={{ color: 'var(--info)', fontSize: 12, fontWeight: 700 }}>
          Last: {latest.value}s
        </span>
      );
    }
  }

  return (
    <div className="diag-test-card card">
      <div className="diag-test-card__row">
        <div className="diag-test-card__icon">{test.icon}</div>
        <div className="diag-test-card__info">
          <div className="diag-test-card__name">{test.name}</div>
          <div className="diag-test-card__desc">{test.description}</div>
          {latestSummary && <div style={{ marginTop: 4 }}>{latestSummary}</div>}
        </div>
        <button className="btn btn--secondary btn--sm diag-test-card__btn" onClick={onStart}>
          Test
        </button>
      </div>
    </div>
  );
}

// ─── Main diagnostics component ───────────────────────────────────────────────
export default function Diagnostics() {
  const [view, setView] = useState('tests'); // 'tests' | 'running' | 'results'
  const [activeTest, setActiveTest] = useState(null);
  const [phase, setPhase] = useState('left'); // 'left' | 'right' | 'single'
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [leftValue, setLeftValue] = useState(null);
  const [rightValue, setRightValue] = useState(null);
  const [repCount, setRepCount] = useState(0);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  const loadHistory = async () => {
    try {
      const rows = await db.diagnosticTests.orderBy('date').reverse().limit(30).toArray();
      setHistory(rows);
    } catch (_) {}
  };

  // Latest result per test type for the body diagram
  const latestByType = {};
  for (const row of history) {
    if (!latestByType[row.type]) latestByType[row.type] = row;
  }
  const hasAnyResults = Object.keys(latestByType).length > 0;

  const startTest = (test) => {
    setActiveTest(test);
    setPhase(test.bilateral ? 'left' : 'single');
    setElapsed(0);
    setRunning(false);
    setLeftValue(null);
    setRightValue(null);
    setRepCount(0);
    setView('running');
  };

  const startTimer = () => {
    startRef.current = Date.now() - elapsed;
    setRunning(true);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    setRunning(false);
    const secs = Math.floor(elapsed / 1000);
    if (phase === 'single') {
      setRightValue(secs);
      setView('results');
    } else if (phase === 'left') {
      setLeftValue(secs);
      setPhase('right');
      setElapsed(0);
    } else {
      setRightValue(secs);
      setView('results');
    }
  };

  const addRep = () => setRepCount(c => c + 1);

  const repsDone = () => {
    if (phase === 'left') {
      setLeftValue(repCount);
      setPhase('right');
      setRepCount(0);
    } else {
      setRightValue(repCount);
      setView('results');
    }
  };

  const saveResults = async () => {
    const record = {
      date: Date.now(),
      type: activeTest.id,
      leftValue: activeTest.bilateral ? leftValue : null,
      rightValue: activeTest.bilateral ? rightValue : null,
      value: !activeTest.bilateral ? rightValue : null,
    };
    await db.diagnosticTests.add(record);
    await loadHistory();
    setView('tests');
  };

  const goBack = () => {
    clearInterval(timerRef.current);
    setRunning(false);
    setView('tests');
  };

  if (view === 'running') {
    return (
      <RunningTest
        test={activeTest}
        phase={phase}
        elapsed={elapsed}
        running={running}
        repCount={repCount}
        leftValue={leftValue}
        onStart={startTimer}
        onStop={stopTimer}
        onAddRep={addRep}
        onRepsDone={repsDone}
        onBack={goBack}
      />
    );
  }

  if (view === 'results') {
    return (
      <ResultsView
        test={activeTest}
        leftValue={leftValue}
        rightValue={rightValue}
        onSave={saveResults}
        onDiscard={goBack}
      />
    );
  }

  return (
    <div className="diagnostics">
      {/* Body diagram with latest results */}
      {hasAnyResults && (
        <div className="card diag-body-card">
          <div className="diag-body-card__title">Current Status</div>
          <BodyDiagram results={latestByType} />
          <div className="diag-body-card__date">
            Last tested {new Date(Math.max(...Object.values(latestByType).map(r => r.date))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}

      {!hasAnyResults && (
        <div className="empty-state" style={{ paddingTop: 32, paddingBottom: 24 }}>
          <div className="empty-state__icon">📊</div>
          <div className="empty-state__title">No baseline yet</div>
          <div className="empty-state__subtitle">Run your first test to start tracking imbalances.</div>
        </div>
      )}

      {/* Test cards */}
      {TESTS.map(test => (
        <TestCard
          key={test.id}
          test={test}
          latest={latestByType[test.id]}
          onStart={() => startTest(test)}
        />
      ))}

      {/* History */}
      {history.length > 0 && (
        <div className="diag-history">
          <div className="diag-history__header">Test History</div>
          {history.map(row => {
            const test = TESTS.find(t => t.id === row.type);
            if (!test) return null;
            const summary = test.bilateral
              ? `L:${row.leftValue} R:${row.rightValue} · ${imbalancePct(row.leftValue, row.rightValue)}% diff`
              : `${row.value}s`;
            return (
              <div key={row.id} className="diag-history__row card--flat">
                <div>
                  <div className="diag-history__name">{test.name}</div>
                  <div className="diag-history__summary">{summary}</div>
                </div>
                <div className="diag-history__date">
                  {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
