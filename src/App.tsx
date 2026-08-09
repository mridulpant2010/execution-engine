import { useState, useEffect } from 'react';
import { Check, Flame, ShieldAlert, Dumbbell, BrainCircuit, Moon, FileText, Activity, Loader2, Footprints, TrendingDown, Hammer, Zap, Trophy, ChevronLeft, ChevronRight, CalendarDays, Plus, X, Gauge, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { format, subDays, addDays, subMonths, eachDayOfInterval, differenceInDays, parseISO, isToday, isFuture } from 'date-fns';


const iconMap: Record<string, any> = {
  Activity, Dumbbell, BrainCircuit, FileText, Moon, Flame, ShieldAlert, Footprints, TrendingDown, Hammer
};

// ── System Design Instant Challenge Bank ────────────────────────────
const SYSTEM_DESIGN_CHALLENGES = [
  {
    id: 'rate-limiter',
    title: 'Distributed Rate Limiter',
    prompt: 'You are designing a Rate Limiter for 500k QPS across 3 geographic regions using Redis. What is the #1 single-point-of-failure under a multi-region network partition, and how do you prevent race conditions?',
    keyConcepts: ['lua', 'atomic', 'clock', 'drift', 'local', 'fallback', 'token', 'partition', 'memory', 'race'],
    goldenRule: 'Always use Lua scripts for atomic Redis token bucket ops and local in-memory fallbacks on partition timeouts.'
  },
  {
    id: 'unique-id',
    title: 'Distributed Unique ID Generator',
    prompt: 'Design a 64-bit unique ID generator handling 10M events/sec. How do you handle NTP clock backward drift on a worker node without producing duplicate IDs?',
    keyConcepts: ['drift', 'ntp', 'sequence', 'sleep', 'buffer', 'worker', 'timestamp', 'clock', 'wait'],
    goldenRule: 'If clock drift is detected, refuse ID generation or wait until the clock catches up to the last timestamp.'
  },
  {
    id: 'message-queue',
    title: 'High-Throughput Log Pipeline',
    prompt: 'Design a logging pipeline handling 1M events/sec. Producers append logs asynchronously. What is the single biggest bottleneck if consumer processing slows down?',
    keyConcepts: ['backpressure', 'disk', 'batch', 'partition', 'buffer', 'consumer', 'lag', 'zero-copy'],
    goldenRule: 'Enforce explicit backpressure upstream and use partitioned log topics to scale consumer parallel processing.'
  },
  {
    id: 'cache-stampede',
    title: 'Consistent Hashing & Cache Stampede',
    prompt: 'You are sharding 100 cache nodes. Node 42 crashes. How do you prevent a massive cache stampede (thundering herd) on the underlying database for keys on Node 42?',
    keyConcepts: ['single-flight', 'probabilistic', 'virtual', 'stampede', 'mutex', 'lock', 'ttl', 'warm'],
    goldenRule: 'Use single-flight request collapsing (mutex per key) and virtual nodes to distribute load smoothly on failure.'
  },
  {
    id: 'distributed-lock',
    title: 'Distributed Locks (Redlock vs Fencing)',
    prompt: 'You need a distributed lock for a payment ledger to prevent double-spending. Why can Redis Redlock fail under long Java/Python GC pauses?',
    keyConcepts: ['gc', 'pause', 'fencing', 'token', 'lease', 'expired', 'monotonic', 'zookeeper', 'consensus'],
    goldenRule: 'Always use monotonically increasing fencing tokens at the storage layer to invalidate stale lock holders.'
  },
  {
    id: 'saga-pattern',
    title: 'Distributed Ledger & Microservice Transactions',
    prompt: 'You are processing a payment involving 4 microservices (Order, Payment, Inventory, Delivery). Why is 2-Phase Commit (2PC) unsuitable for high availability, and how does the Saga pattern help?',
    keyConcepts: ['saga', 'compensating', '2pc', 'lock', 'blocking', 'event', 'orchestration', 'choreography'],
    goldenRule: 'Avoid blocking 2PC across microservices; use Sagas with compensating transactions for eventual consistency.'
  },
  {
    id: 'leaderboard',
    title: 'Real-time Gaming Leaderboard',
    prompt: 'Design a real-time leaderboard for 50M active users showing Top 100 global ranks and user relative rank. Why does traditional relational DB indexing fail at 100k QPS?',
    keyConcepts: ['zset', 'redis', 'skip', 'list', 'log', 'rank', 'partition', 'shard'],
    goldenRule: 'Use Redis Sorted Sets (ZSET) with skip lists for logarithmic O(log N) rank lookups and updates.'
  },
  {
    id: 'geospatial-uber',
    title: 'Geospatial Driver Matching (Uber/Tinder)',
    prompt: 'Design a driver location tracking service updating 1M active driver coordinates every 4 seconds. How do you efficiently query drivers within a 3km radius without scanning all DB rows?',
    keyConcepts: ['geohash', 'quadtree', 'spatial', 'index', 'radius', 'in-memory', 'pubsub'],
    goldenRule: 'Index dynamic locations using Geohashing or QuadTrees in memory rather than querying B-tree relational indexes.'
  },
  {
    id: 'notification-engine',
    title: 'Push Notification Gateway at Scale',
    prompt: 'Design a push notification gateway delivering 100M alerts/day via Apple APNS & Android FCM. How do you prevent duplicate pushes if APNS drops the connection midway?',
    keyConcepts: ['idempotency', 'dedup', 'ack', 'queue', 'retry', 'exponential', 'backoff', 'token'],
    goldenRule: 'Attach unique idempotency keys to every notification payload and enforce deduplication at the worker queue.'
  },
  {
    id: 'cdc-pipeline',
    title: 'Change Data Capture (CDC) & Outbox Pattern',
    prompt: 'You need to update Elasticsearch whenever a SQL database record changes. Why is updating ES directly inside the HTTP request handler a dangerous anti-pattern?',
    keyConcepts: ['outbox', 'cdc', 'debezium', 'wal', 'atomicity', 'dual-write', 'transaction', 'eventual'],
    goldenRule: 'Avoid dual-write race conditions in application code; use the Transactional Outbox Pattern with CDC streaming.'
  },
  {
    id: 'blob-storage',
    title: 'Distributed Object Storage (S3 Architecture)',
    prompt: 'Design a high-scale Blob Storage service for multi-gigabyte video uploads. How do you ensure high durability without multiplying storage costs by 3x replication?',
    keyConcepts: ['erasure', 'coding', 'chunk', 'multipart', 'metadata', 'reed-solomon', 'data', 'parity'],
    goldenRule: 'Use Erasure Coding (e.g. Reed-Solomon 8+4) to achieve 99.999999999% durability at 1.5x storage overhead.'
  },
  {
    id: 'search-engine',
    title: 'Distributed Search (Inverted Index Sharding)',
    prompt: 'Design an inverted index search engine for 1 Billion articles. Should you shard by Document ID or by Term, and why?',
    keyConcepts: ['inverted', 'index', 'document', 'term', 'shard', 'scatter', 'gather', 'segment'],
    goldenRule: 'Shard by Document ID (scatter-gather) for balanced index updates and parallel query execution across nodes.'
  },
  {
    id: 'crdt-collaborative',
    title: 'Real-Time Collaborative Doc Editor',
    prompt: 'Design a real-time collaborative document editor like Google Docs. How do you resolve concurrent edits when two users type at the exact same position offline?',
    keyConcepts: ['crdt', 'ot', 'operational', 'transformation', 'conflict', 'vector', 'clock', 'sequence'],
    goldenRule: 'Use Conflict-free Replicated Data Types (CRDTs) or Operational Transformation (OT) for deterministic convergence.'
  },
  {
    id: 'metrics-tsdb',
    title: 'Time-Series Monitoring (Prometheus TSDB)',
    prompt: 'Design a metrics engine collecting 100k server metrics every 10 seconds. Why do traditional B-Trees degrade under continuous time-series writes?',
    keyConcepts: ['tsdb', 'append', 'lsm', 'tree', 'downsample', 'wal', 'write-ahead', 'chunk', 'compression'],
    goldenRule: 'Use append-only time-series chunking with Delta-of-Delta compression rather than B-Tree random disk updates.'
  },
  {
    id: 'db-sharding-rebalance',
    title: 'Database Sharding & Zero-Downtime Rebalancing',
    prompt: 'Your database is sharded across 16 PostgreSQL nodes using Hash Sharding (`hash(user_id) % 16`). You need to scale to 32 nodes. How do you rebalance without full downtime?',
    keyConcepts: ['consistent', 'hashing', 'virtual', 'nodes', 'dual', 'read', 'cdc', 'shadow', 'migration'],
    goldenRule: 'Use Consistent Hashing or virtual shards mapped to physical nodes to minimize key migration during cluster scaling.'
  }
];

// ── Streak Calculator ──────────────────────────────────────────────
function computeStreaks(historicalLogs: any[], metrics: any[], category: string): { current: number; best: number } {
  const categoryMetricIds = metrics.filter(m => m.category === category && !m.is_kryptonite).map(m => m.id);
  if (categoryMetricIds.length === 0) return { current: 0, best: 0 };

  const activeDates = new Set<string>();
  historicalLogs.forEach(log => {
    if (categoryMetricIds.includes(log.metric_id)) {
      if (log.value_boolean || (log.value_numeric !== null && log.value_numeric > 0)) {
        activeDates.add(log.log_date);
      }
    }
  });

  const sortedDates = Array.from(activeDates).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return { current: 0, best: 0 };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  let currentStreak = 0;
  const startFrom = sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr ? sortedDates[0] : null;
  if (startFrom) {
    let expectedDate = parseISO(startFrom);
    for (const dateStr of sortedDates) {
      const logDate = parseISO(dateStr);
      const diff = differenceInDays(expectedDate, logDate);
      if (diff === 0) { currentStreak++; expectedDate = subDays(expectedDate, 1); }
      else if (diff > 0) break;
    }
  }

  let bestStreak = 0, tempStreak = 1;
  const allSorted = Array.from(activeDates).sort();
  for (let i = 1; i < allSorted.length; i++) {
    if (differenceInDays(parseISO(allSorted[i]), parseISO(allSorted[i - 1])) === 1) tempStreak++;
    else { bestStreak = Math.max(bestStreak, tempStreak); tempStreak = 1; }
  }
  bestStreak = Math.max(bestStreak, tempStreak);
  return { current: currentStreak, best: bestStreak };
}

// ── Relative Effort Calculator ──────────────────────────────────────
function computeRelativeEffort(logs: any[], metrics: any[]): { score: number; label: string; color: string } {
  if (!metrics.length || !logs.length) return { score: 0, label: 'No Data', color: 'text-textMuted' };

  let baseScore = 0;
  let workHours = 0;
  let sleepHours = 8; // default assumption
  let leakPenalty = 0;

  logs.forEach(log => {
    const metric = metrics.find(m => m.id === log.metric_id);
    if (!metric) return;
    const name = metric.name.toLowerCase();

    // Extract constraint values
    if (name.includes('work hours')) { workHours = log.value_numeric || 0; return; }
    if (name.includes('sleep hours')) { sleepHours = log.value_numeric || 8; return; }

    // Kryptonite penalties
    if (metric.is_kryptonite && log.value_boolean) {
      if (name.includes('energy leak') || name.includes('pmo')) leakPenalty += 25;
      else leakPenalty += 10; // "Done Enough" trap
      return;
    }

    // Base action scoring
    if (metric.type === 'boolean' && log.value_boolean) {
      let rpeMultiplier = 1.0;
      if (log.intensity_rpe) {
        rpeMultiplier = log.intensity_rpe / 5.0;
      }

      if (name.includes('hyrox') || name.includes('strength')) baseScore += 10 * rpeMultiplier;
      else if (name.includes('kora') || name.includes('recall')) baseScore += 8 * rpeMultiplier;
      else if (name.includes('prayer') || name.includes('naam') || name.includes('sleep by')) baseScore += 3 * rpeMultiplier;
      else if (name.includes('eat')) baseScore += 3 * rpeMultiplier;
      else baseScore += 5 * rpeMultiplier; // generic boolean habit
    } else if (metric.type === 'numeric' && log.value_numeric > 0) {
      let rpeMultiplier = 1.0;
      if (log.intensity_rpe) {
        // RPE 5 = 1x multiplier, RPE 10 = 2x, RPE 1 = 0.2x
        rpeMultiplier = log.intensity_rpe / 5.0;
      }

      if (name.includes('run')) baseScore += 1.5 * log.value_numeric * rpeMultiplier;
      else if (name.includes('focus')) baseScore += 5 * log.value_numeric * rpeMultiplier;
      else baseScore += 3 * log.value_numeric * rpeMultiplier;
    }
  });

  // Constraint multipliers
  let multiplier = 1.0;
  if (workHours >= 8) multiplier += 0.5;  // Hard workday
  if (workHours >= 10) multiplier += 0.2; // Brutal workday (like yours)
  if (sleepHours > 0 && sleepHours < 6.5) multiplier += 0.3; // Sleep deprived

  const finalScore = Math.max(0, Math.round(baseScore * multiplier - leakPenalty));

  // Classify effort level
  if (finalScore === 0) return { score: 0, label: 'Rest Day', color: 'text-textMuted' };
  if (finalScore < 35) return { score: finalScore, label: 'Low Output', color: 'text-textSecondary' };
  if (finalScore < 70) return { score: finalScore, label: 'Solid Day', color: 'text-success' };
  if (finalScore < 100) return { score: finalScore, label: 'Hard Push', color: 'text-strava' };
  return { score: finalScore, label: 'Overdrive', color: 'text-strava' };
}

// ── Relative Effort Badge ──────────────────────────────────────
function RelativeEffortBadge({ score, label, color }: { score: number; label: string; color: string }) {
  const isHigh = score >= 70;
  return (
    <div className="text-center">
      <div className={`relative w-20 h-20 mx-auto ${isHigh ? 'animate-pulse' : ''}`} style={{ animationDuration: '3s' }}>
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" stroke="#27272A" strokeWidth="5" fill="none" />
          <circle cx="40" cy="40" r="34"
            stroke={score >= 100 ? '#FC4C02' : score >= 70 ? '#FC4C02' : score >= 35 ? '#34D399' : '#3F3F46'}
            strokeWidth="5" fill="none"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - Math.min(score, 120) / 120)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-black tabular-nums ${color}`}>{score}</span>
        </div>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${color}`}>{label}</p>
    </div>
  );
}

// ── Effort & Skill Drilldown Chart (7D / 30D / 1Y + Skill Drilldown Filter) ─────────
function EffortTrendChart({ 
  historicalLogs, 
  metrics,
  historicalBuilds = [],
  historicalChallenges = []
}: { 
  historicalLogs: any[]; 
  metrics: any[];
  historicalBuilds?: any[];
  historicalChallenges?: any[];
}) {
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '1Y'>('7D');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('overall');

  // Compute daily metric value depending on selected filter
  const getMetricScoreForDay = (dateStr: string) => {
    if (selectedMetricId === 'overall') {
      const dayLogs = historicalLogs.filter(l => l.log_date === dateStr);
      return computeRelativeEffort(dayLogs, metrics).score;
    }
    if (selectedMetricId === 'builds') {
      return historicalBuilds.filter(b => b.log_date === dateStr).length;
    }
    if (selectedMetricId === 'challenges') {
      const dayChallenges = historicalChallenges.filter(c => c.log_date === dateStr);
      if (dayChallenges.length === 0) return 0;
      const sum = dayChallenges.reduce((acc, c) => acc + (c.score || 0), 0);
      return Math.round(sum / dayChallenges.length);
    }
    
    // Specific metric from DB
    const mLog = historicalLogs.find(l => l.metric_id === selectedMetricId && l.log_date === dateStr);
    if (!mLog) return 0;
    const metricObj = metrics.find(m => m.id === selectedMetricId);
    if (!metricObj) return 0;

    if (metricObj.type === 'numeric') return mLog.value_numeric || 0;
    if (metricObj.type === 'boolean') return mLog.value_boolean ? 1 : 0;
    return 0;
  };

  const days: { label: string; score: number; isCurrent?: boolean }[] = [];

  if (timeframe === '7D') {
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const score = getMetricScoreForDay(dateStr);
      days.push({ label: format(date, 'EEE')[0], score, isCurrent: i === 0 });
    }
  } else if (timeframe === '30D') {
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const score = getMetricScoreForDay(dateStr);
      const label = i === 0 ? 'Today' : i % 5 === 0 ? format(date, 'd') : '';
      days.push({ label, score, isCurrent: i === 0 });
    }
  } else if (timeframe === '1Y') {
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthPrefix = format(date, 'yyyy-MM');
      
      if (selectedMetricId === 'builds') {
        const count = historicalBuilds.filter(b => b.log_date.startsWith(monthPrefix)).length;
        days.push({ label: format(date, 'MMM'), score: count, isCurrent: i === 0 });
      } else if (selectedMetricId === 'challenges') {
        const monthChallenges = historicalChallenges.filter(c => c.log_date.startsWith(monthPrefix));
        const avg = monthChallenges.length > 0 ? Math.round(monthChallenges.reduce((acc, c) => acc + (c.score || 0), 0) / monthChallenges.length) : 0;
        days.push({ label: format(date, 'MMM'), score: avg, isCurrent: i === 0 });
      } else {
        const monthLogs = historicalLogs.filter(l => l.log_date.startsWith(monthPrefix));
        const uniqueDays = new Set(monthLogs.map(l => l.log_date));
        let monthTotalScore = 0;
        uniqueDays.forEach(dayStr => {
          monthTotalScore += getMetricScoreForDay(dayStr);
        });
        const mObj = metrics.find(m => m.id === selectedMetricId);
        const isSumMetric = mObj && mObj.type === 'numeric';
        const finalMonthScore = isSumMetric ? Math.round(monthTotalScore) : (uniqueDays.size > 0 ? Math.round(monthTotalScore / uniqueDays.size) : 0);
        days.push({ label: format(date, 'MMM'), score: finalMonthScore, isCurrent: i === 0 });
      }
    }
  }

  const maxScore = Math.max(...days.map(d => d.score), selectedMetricId === 'overall' ? 30 : 5);
  const totalSum = days.reduce((sum, d) => sum + d.score, 0);
  const avgScore = Number((totalSum / (days.length || 1)).toFixed(1));

  const activeMetricObj = metrics.find(m => m.id === selectedMetricId);
  const filterUnit = selectedMetricId === 'overall' ? 'PTS' : selectedMetricId === 'builds' ? 'Builds' : selectedMetricId === 'challenges' ? '/10' : activeMetricObj?.type === 'numeric' ? '' : 'Days';

  const chartW = 100;
  const chartH = 80;
  const barAreaTop = 14;
  const barAreaBottom = 16;
  const barAreaH = chartH - barAreaTop - barAreaBottom;
  const count = days.length;
  const barWidth = Math.max(1.8, (chartW * 0.55) / count);
  const gap = (chartW - barWidth * count) / (count + 1);

  const barData = days.map((day, i) => {
    const x = gap + i * (barWidth + gap);
    const centerX = x + barWidth / 2;
    const h = day.score > 0 ? Math.max(3, (day.score / maxScore) * barAreaH) : 1.5;
    const y = barAreaTop + barAreaH - h;
    const color = selectedMetricId === 'overall'
      ? (day.score >= 100 ? '#FC4C02' : day.score >= 70 ? '#FC4C02cc' : day.score >= 35 ? '#34D399aa' : day.score > 0 ? '#3F3F46' : '#27272A')
      : (day.score > 0 ? '#FC4C02' : '#27272A');
    return { ...day, x, centerX, y, h, color };
  });

  const linePoints = barData.map(b => `${b.centerX},${b.y}`).join(' ');
  const baselineY = barAreaTop + barAreaH - (avgScore > 0 ? Math.max(3, (avgScore / maxScore) * barAreaH) : 0);

  return (
    <div className="rounded-2xl bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-strava shrink-0" />
          <select
            value={selectedMetricId}
            onChange={e => setSelectedMetricId(e.target.value)}
            className="bg-surface-elevated border border-border text-xs font-bold text-textPrimary rounded-lg p-1.5 focus:outline-none focus:border-strava cursor-pointer"
          >
            <option value="overall">⚡ Overall Relative Effort</option>
            <option value="builds">🔨 What You Built (Builds)</option>
            <option value="challenges">🎯 System Design AI Loops</option>
            <optgroup label="Engine Metrics">
              {metrics.map(m => (
                <option key={m.id} value={m.id}>
                  {m.category === 'Physical' ? '🏃' : m.category === 'Cognitive' ? '🧠' : '🧘'} {m.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px border-t border-dashed border-warning"></div>
            <span className="text-[9px] font-semibold text-warning tabular-nums">AVG {avgScore} {filterUnit}</span>
          </div>

          <div className="flex bg-surface-elevated p-0.5 rounded-lg border border-border">
            {(['7D', '30D', '1Y'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                  timeframe === tf ? 'bg-strava text-white' : 'text-textMuted hover:text-textPrimary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: '180px' }} preserveAspectRatio="xMidYMid meet">
        {/* Baseline (average) */}
        {avgScore > 0 && (
          <line x1="0" y1={baselineY} x2={chartW} y2={baselineY}
            stroke="#F59E0B" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.6" />
        )}

        {/* Bars */}
        {barData.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={barWidth} height={b.h} rx="0.8" fill={b.color}
              className="transition-all duration-500" />
          </g>
        ))}

        {/* Line graph connecting the tops of the bars */}
        {barData.filter(b => b.score > 0).length >= 2 && (
          <polyline
            points={linePoints}
            fill="none" stroke="#FC4C02" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round"
            opacity="0.8"
          />
        )}

        {/* Dots at data points */}
        {barData.map((b, i) => (
          b.score > 0 && (
            <circle key={`dot-${i}`} cx={b.centerX} cy={b.y} r={timeframe === '30D' ? '0.8' : '1.2'}
              fill={b.isCurrent ? '#FC4C02' : '#fafafa'} stroke="#0a0a0a" strokeWidth="0.3" />
          )
        ))}

        {/* Score labels above bars (only for 7D and 1Y to prevent clutter in 30D) */}
        {timeframe !== '30D' && barData.map((b, i) => (
          b.score > 0 && (
            <text key={`score-${i}`} x={b.centerX} y={b.y - 2.5} textAnchor="middle"
              className="fill-textSecondary" style={{ fontSize: '3.5px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {b.score}
            </text>
          )
        ))}

        {/* Day / Month labels below bars */}
        {barData.map((b, i) => (
          b.label ? (
            <text key={`label-${i}`} x={b.centerX} y={chartH - 3} textAnchor="middle"
              className={b.isCurrent ? 'fill-strava' : 'fill-textMuted'}
              style={{ fontSize: timeframe === '30D' ? '3px' : '3.8px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              {b.label}
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

// ── Streak Card ──────────────────────────────────────────────
function StreakCard({ label, emoji, current, best }: { label: string; emoji: string; current: number; best: number }) {
  const isOnFire = current >= 3;
  return (
    <div className={`rounded-2xl p-3 md:p-4 border transition-all ${isOnFire ? 'border-strava/30 bg-strava/5' : 'border-border bg-surface'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{emoji}</span>
        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-textSecondary truncate">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-1">
        <div>
          <div className="flex items-center gap-1">
            <span className={`text-2xl md:text-3xl font-black tabular-nums ${isOnFire ? 'text-strava' : 'text-textPrimary'}`}>{current}</span>
            <span className="text-[10px] text-textMuted font-bold uppercase">d</span>
            {isOnFire && <Zap className="w-3.5 h-3.5 text-strava" />}
          </div>
          <span className="text-[9px] font-bold uppercase text-textMuted tracking-wider block -mt-1">Streak</span>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Trophy className="w-3 h-3 text-amber-500/80" />
            <span className="text-xs md:text-sm font-bold text-textSecondary tabular-nums">{best}d</span>
          </div>
          <span className="text-[9px] font-bold uppercase text-textMuted tracking-wider block -mt-0.5">Best</span>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card (Strava style) ──────────────────────────────────
function MetricCard({ metric, log, onToggle }: { metric: any; log: any; onToggle: any }) {
  const Icon = iconMap[metric.icon] || Activity;
  const isCompleted = log ? (metric.type === 'boolean' ? log.value_boolean : (log.value_numeric !== null && log.value_numeric > 0)) : false;
  const isKryptonite = metric.is_kryptonite;

  return (
    <div
      onClick={() => onToggle(metric, isCompleted, log)}
      className={`card-hover rounded-2xl p-4 border cursor-pointer flex items-center justify-between gap-4 ${
        isCompleted
          ? isKryptonite
            ? 'bg-danger/10 border-danger/30'
            : 'bg-surface-elevated border-strava/20'
          : 'bg-surface border-border hover:border-border-hover'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isCompleted
            ? isKryptonite ? 'bg-danger/20' : 'bg-strava/15'
            : 'bg-surface-elevated'
        }`}>
          <Icon className={`w-5 h-5 ${
            isCompleted
              ? isKryptonite ? 'text-danger' : 'text-strava'
              : 'text-textSecondary'
          }`} />
        </div>
        <span className={`font-semibold text-sm ${
          isCompleted
            ? isKryptonite ? 'text-danger' : 'text-textPrimary'
            : 'text-textSecondary'
        }`}>{metric.name}</span>
      </div>

      {metric.type === 'boolean' && (
        <div className="flex flex-col items-end">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? isKryptonite
                ? 'bg-danger border-danger'
                : 'bg-strava border-strava'
              : 'border-textMuted'
          }`}>
            {isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
          </div>
          {log && log.intensity_rpe && !isKryptonite && (
            <span className="text-[10px] text-textSecondary font-semibold mt-1">RPE {log.intensity_rpe}</span>
          )}
        </div>
      )}

      {metric.type === 'numeric' && (
        <div className="flex flex-col items-end">
          <div className={`px-3 py-1 rounded-lg ${isCompleted ? 'bg-strava/15' : 'bg-surface-elevated'}`}>
            <span className={`font-black text-lg tabular-nums ${isCompleted ? 'text-strava' : 'text-textMuted'}`}>
              {log && log.value_numeric !== null ? log.value_numeric : '—'}
            </span>
          </div>
          {log && log.intensity_rpe && (
            <span className="text-[10px] text-textSecondary font-semibold mt-1">RPE {log.intensity_rpe}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [historicalBuilds, setHistoricalBuilds] = useState<any[]>([]);
  const [historicalChallenges, setHistoricalChallenges] = useState<any[]>([]);
  const [interstitialLogs, setInterstitialLogs] = useState<any[]>([]);
  const [todayBuild, setTodayBuild] = useState<any>(null);
  const [buildText, setBuildText] = useState('');
  const [buildLink, setBuildLink] = useState('');
  const [showBuildForm, setShowBuildForm] = useState(false);
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // RPE and Input Modal State
  const [activeMetric, setActiveMetric] = useState<any | null>(null);
  const [numericValue, setNumericValue] = useState<string>('');
  const [booleanValue, setBooleanValue] = useState<boolean>(true);
  const [intensityRpe, setIntensityRpe] = useState<number>(5);

  // Skill Challenge Loop State
  const [activeChallenge, setActiveChallenge] = useState<any | null>(null);
  const [challengeResponse, setChallengeResponse] = useState<string>('');
  const [challengeFeedback, setChallengeFeedback] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [todayChallengeLog, setTodayChallengeLog] = useState<any>(null);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isViewingToday = isToday(selectedDate);

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => { const next = addDays(selectedDate, 1); if (!isFuture(next)) setSelectedDate(next); };
  const goToToday = () => setSelectedDate(new Date());

  const fetchData = async () => {
    setDbError(null);
    const { data: metricsData, error: metricsErr } = await supabase.from('metrics').select('*').eq('is_active', true);
    if (metricsErr) setDbError(metricsErr.message);

    const { data: logsData, error: logsErr } = await supabase.from('daily_logs').select('*').eq('log_date', selectedDateStr);
    if (logsErr && !dbError) setDbError(logsErr.message);

    const historyStart = format(subDays(new Date(), 365), 'yyyy-MM-dd');
    const { data: historyData } = await supabase.from('daily_logs').select('*').gte('log_date', historyStart);

    const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
    const { data: intLogsData, error: intErr } = await supabase
      .from('interstitial_logs').select('*')
      .gte('created_at', dayStart.toISOString()).lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true });
    if (intErr && !dbError) setDbError(intErr.message);

    const { data: buildData } = await supabase.from('build_logs').select('*').eq('log_date', selectedDateStr).maybeSingle();

    const { data: challengeData } = await supabase
      .from('skill_challenges')
      .select('*')
      .eq('log_date', selectedDateStr)
      .maybeSingle();

    const { data: allBuilds } = await supabase.from('build_logs').select('*').gte('log_date', historyStart);
    const { data: allChallenges } = await supabase.from('skill_challenges').select('*').gte('log_date', historyStart);

    if (metricsData) setMetrics(metricsData);
    if (logsData) setLogs(logsData);
    if (historyData) setHistoricalLogs(historyData);
    if (allBuilds) setHistoricalBuilds(allBuilds);
    if (allChallenges) setHistoricalChallenges(allChallenges);
    if (intLogsData) setInterstitialLogs(intLogsData);
    setTodayBuild(buildData || null);
    setTodayChallengeLog(challengeData || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const logsSub = supabase.channel('daily_logs_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, fetchData).subscribe();
    const intLogsSub = supabase.channel('interstitial_logs_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'interstitial_logs' }, fetchData).subscribe();
    return () => { supabase.removeChannel(logsSub); supabase.removeChannel(intLogsSub); };
  }, [selectedDateStr]);

  const handleToggle = async (metric: any, _isCompleted: boolean, existingLog: any) => {
    try {
      const name = metric.name.toLowerCase();
      const isRoutineHabit = name.includes('sleep') || name.includes('prayer') || name.includes('naam') || name.includes('eat');

      // Kryptonite leaks OR routine habits toggle instantly on click without RPE modal
      if (metric.is_kryptonite || isRoutineHabit) {
        if (existingLog) await supabase.from('daily_logs').delete().eq('id', existingLog.id);
        else await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: selectedDateStr, value_boolean: true }]);
        await fetchData();
        return;
      }

      // Open Willpower RPE modal for high-friction habits and numeric metrics
      setActiveMetric({ metric, existingLog });
      setIntensityRpe(existingLog && existingLog.intensity_rpe !== null ? existingLog.intensity_rpe : 5);
      
      if (metric.type === 'numeric') {
        setNumericValue(existingLog && existingLog.value_numeric !== null ? existingLog.value_numeric.toString() : '');
      } else {
        setBooleanValue(existingLog ? existingLog.value_boolean : true);
      }
    } catch (err) { console.error("Toggle error:", err); }
  };

  const handleSaveEntry = async () => {
    if (!activeMetric) return;
    const { metric, existingLog } = activeMetric;
    
    try {
      if (metric.type === 'numeric') {
        // Delete log if input is cleared
        if (!numericValue.trim()) {
          if (existingLog) await supabase.from('daily_logs').delete().eq('id', existingLog.id);
          setActiveMetric(null);
          await fetchData();
          return;
        }

        const numVal = parseFloat(numericValue);
        if (isNaN(numVal)) return;

        if (existingLog) {
          await supabase.from('daily_logs')
            .update({ value_numeric: numVal, intensity_rpe: intensityRpe })
            .eq('id', existingLog.id);
        } else {
          await supabase.from('daily_logs')
            .insert([{ 
              metric_id: metric.id, 
              log_date: selectedDateStr, 
              value_numeric: numVal,
              intensity_rpe: intensityRpe
            }]);
        }
      } else {
        // Positive Boolean metric
        if (!booleanValue) {
          // If untoggled in modal, delete entry
          if (existingLog) await supabase.from('daily_logs').delete().eq('id', existingLog.id);
        } else {
          if (existingLog) {
            await supabase.from('daily_logs')
              .update({ value_boolean: true, intensity_rpe: intensityRpe })
              .eq('id', existingLog.id);
          } else {
            await supabase.from('daily_logs')
              .insert([{ 
                metric_id: metric.id, 
                log_date: selectedDateStr, 
                value_boolean: true,
                intensity_rpe: intensityRpe
              }]);
          }
        }
      }
      setActiveMetric(null);
      await fetchData();
    } catch (err) {
      console.error("Save entry error:", err);
    }
  };

  const handleAddInterstitialLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logText.trim()) return;
    // Use selectedDate for the timestamp so historical logs persist correctly
    const logTimestamp = new Date(selectedDate);
    const now = new Date();
    logTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    await supabase.from('interstitial_logs').insert([{ content: logText.trim(), log_type: 'reflection', created_at: logTimestamp.toISOString() }]);
    setLogText('');
    await fetchData();
  };

  const handleSubmitBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildText.trim()) return;
    if (todayBuild) await supabase.from('build_logs').update({ description: buildText.trim(), link: buildLink.trim() || null }).eq('id', todayBuild.id);
    else await supabase.from('build_logs').insert([{ log_date: selectedDateStr, description: buildText.trim(), link: buildLink.trim() || null }]);
    setShowBuildForm(false); setBuildText(''); setBuildLink('');
    await fetchData();
  };

  const handleStartChallenge = (requestedId?: string) => {
    // If an explicit ID is requested (e.g. user clicked "Next Question"), pick that
    if (requestedId) {
      const nextChallenge = SYSTEM_DESIGN_CHALLENGES.find(c => c.id === requestedId) || SYSTEM_DESIGN_CHALLENGES[0];
      setActiveChallenge(nextChallenge);
      setChallengeResponse('');
      setChallengeFeedback(null);
      return;
    }

    // If today already has a saved log and we are just reviewing
    if (todayChallengeLog && todayChallengeLog.challenge_title) {
      const existing = SYSTEM_DESIGN_CHALLENGES.find(c => c.title === todayChallengeLog.challenge_title);
      if (existing) {
        setActiveChallenge(existing);
        setChallengeResponse(todayChallengeLog.user_response);
        setChallengeFeedback(todayChallengeLog.ai_feedback);
        return;
      }
    }

    // Unseen question selection: filter out questions user has already completed in historical challenges
    const answeredTitles = new Set(historicalChallenges.map(c => c.challenge_title));
    const unseen = SYSTEM_DESIGN_CHALLENGES.filter(c => !answeredTitles.has(c.title));

    const pool = unseen.length > 0 ? unseen : SYSTEM_DESIGN_CHALLENGES;
    // Pick a random question from the unseen pool
    const randomChallenge = pool[Math.floor(Math.random() * pool.length)];

    setActiveChallenge(randomChallenge);
    setChallengeResponse('');
    setChallengeFeedback(null);
  };

  const handleNextChallenge = () => {
    const currentIndex = SYSTEM_DESIGN_CHALLENGES.findIndex(c => c.id === activeChallenge?.id);
    const nextIndex = (currentIndex + 1) % SYSTEM_DESIGN_CHALLENGES.length;
    const nextChallenge = SYSTEM_DESIGN_CHALLENGES[nextIndex];
    setActiveChallenge(nextChallenge);
    setChallengeResponse('');
    setChallengeFeedback(null);
  };

  const handleEvaluateChallenge = async () => {
    if (!challengeResponse.trim() || !activeChallenge) return;
    setIsEvaluating(true);

    const userText = challengeResponse.toLowerCase();
    const matched = activeChallenge.keyConcepts.filter((c: string) => userText.includes(c));
    const matchCount = matched.length;

    let score = 5;
    if (matchCount >= 4) score = 9;
    else if (matchCount >= 2) score = 7;
    else if (matchCount >= 1) score = 6;

    const feedback = {
      score,
      strengths: matched.length > 0 ? [`Identified key architectural concepts: ${matched.slice(0, 3).join(', ')}`] : ['Submitted rapid architectural response.'],
      blindSpots: matchCount < 3 ? [`Missed trade-offs regarding ${activeChallenge.keyConcepts.slice(matched.length, matched.length + 2).join(' and ')}.`] : ['Solid coverage of primary edge cases.'],
      goldenRule: activeChallenge.goldenRule
    };

    setChallengeFeedback(feedback);
    setIsEvaluating(false);

    try {
      await supabase.from('skill_challenges').insert([{
        log_date: selectedDateStr,
        skill_name: 'System Design',
        challenge_title: activeChallenge.title,
        challenge_prompt: activeChallenge.prompt,
        user_response: challengeResponse.trim(),
        ai_feedback: feedback,
        score,
        effort_points: score * 3
      }]);
      await fetchData();
    } catch (err) {
      console.error("Save challenge error:", err);
    }
  };

  const hasLeak = logs.some(l => {
    const metric = metrics.find(m => m.id === l.metric_id);
    return metric && metric.is_kryptonite && l.value_boolean;
  });

  const physicalStreak = computeStreaks(historicalLogs, metrics, 'Physical');
  const cognitiveStreak = computeStreaks(historicalLogs, metrics, 'Cognitive');
  const spiritualStreak = computeStreaks(historicalLogs, metrics, 'Spiritual');

  // Calculate daily completion rate
  const totalNonKryptonite = metrics.filter(m => !m.is_kryptonite).length;
  const completedCount = logs.filter(l => {
    const m = metrics.find(mt => mt.id === l.metric_id);
    return m && !m.is_kryptonite && (l.value_boolean || (l.value_numeric > 0));
  }).length;
  const completionPct = totalNonKryptonite > 0 ? Math.round((completedCount / totalNonKryptonite) * 100) : 0;

  // Compute Relative Effort
  const relativeEffort = computeRelativeEffort(logs, metrics);

  return (
    <div className="min-h-screen bg-background text-textPrimary pb-24">
      {/* ── STRAVA-STYLE HEADER ──────────────────────────────── */}
      <div className="bg-gradient-to-b from-strava/15 to-background px-4 pt-6 pb-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          {/* App title + date nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-strava flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black uppercase tracking-tight">Execution Engine</h1>
            </div>
            {!isViewingToday && (
              <button onClick={goToToday} className="text-xs bg-strava/20 text-strava px-3 py-1.5 rounded-full font-bold hover:bg-strava/30 transition-colors">
                Back to Today
              </button>
            )}
          </div>

          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-4 py-3">
            <button onClick={goToPreviousDay} className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-90">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[200px]">
              <p className={`text-sm font-bold ${isViewingToday ? 'text-textPrimary' : 'text-strava'}`}>
                {isViewingToday ? 'Today' : format(selectedDate, 'EEEE')}
              </p>
              <p className="text-xs text-textSecondary">{format(selectedDate, 'MMMM d, yyyy')}</p>
            </div>
            <button
              onClick={goToNextDay}
              disabled={isViewingToday}
              className={`p-2 rounded-full transition-all active:scale-90 ${isViewingToday ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10'}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Daily Stats: Completion + Relative Effort */}
          <div className="flex items-center justify-center gap-8 py-4">
            {/* Completion Ring */}
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" stroke="#27272A" strokeWidth="5" fill="none" />
                  <circle cx="40" cy="40" r="34" stroke="#FC4C02" strokeWidth="5" fill="none"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - completionPct / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black tabular-nums text-strava">{completionPct}%</span>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-textSecondary">{completedCount}/{totalNonKryptonite} Done</p>
            </div>

            {/* Divider */}
            <div className="w-px h-16 bg-border"></div>

            {/* Relative Effort Ring */}
            <RelativeEffortBadge score={relativeEffort.score} label={relativeEffort.label} color={relativeEffort.color} />
          </div>
        </div>
      </div>

      {/* ── PAST DAY INDICATOR ──────────────────────────────── */}
      {!isViewingToday && (
        <div className="mx-4 md:mx-8 mb-4 max-w-3xl lg:mx-auto">
          <div className="p-3 bg-warning/10 border border-warning/20 text-warning rounded-xl flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span className="font-medium">You are editing a past day</span>
          </div>
        </div>
      )}

      {/* ── KRYPTONITE ALERT ──────────────────────────────── */}
      {hasLeak && (
        <div className="mx-4 md:mx-8 mb-4 max-w-3xl lg:mx-auto">
          <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">"You are bleeding out your action-energy. Stop wasting your energy."</p>
          </div>
        </div>
      )}

      {dbError && (
        <div className="mx-4 md:mx-8 mb-4 max-w-3xl lg:mx-auto">
          <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-xl text-xs font-mono">
            DB Error: {dbError}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <div className="px-4 md:px-8 max-w-3xl mx-auto space-y-6">
        {/* Streak Cards */}
        <div className="grid grid-cols-3 gap-3">
          <StreakCard label="Physical" emoji="🏃" current={physicalStreak.current} best={physicalStreak.best} />
          <StreakCard label="Cognitive" emoji="🧠" current={cognitiveStreak.current} best={cognitiveStreak.best} />
          <StreakCard label="Spiritual" emoji="🧘" current={spiritualStreak.current} best={spiritualStreak.best} />
        </div>

        {/* Unified Multi-Timeframe & Skill Drilldown Trend (7D / 30D / 1Y) */}
        <EffortTrendChart 
          historicalLogs={historicalLogs} 
          metrics={metrics}
          historicalBuilds={historicalBuilds}
          historicalChallenges={historicalChallenges}
        />

        {/* Physical Engine */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-strava"></span> Physical Engine
          </h2>
          <div className="space-y-2">
            {metrics.filter(m => m.category === 'Physical').map(m => (
              <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
            ))}
          </div>
        </section>

        {/* Cognitive Engine */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Cognitive Engine
          </h2>
          <div className="space-y-2">
            {metrics.filter(m => m.category === 'Cognitive').map(m => (
              <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
            ))}
          </div>

          {/* Build-First Challenge */}
          <div className={`mt-3 rounded-2xl p-4 border transition-all ${todayBuild ? 'bg-success/5 border-success/20' : 'bg-strava/5 border-strava/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${todayBuild ? 'bg-success/15' : 'bg-strava/15'}`}>
                  <Hammer className={`w-4 h-4 ${todayBuild ? 'text-success' : 'text-strava'}`} />
                </div>
                <span className={`font-bold text-sm ${todayBuild ? 'text-success' : 'text-strava'}`}>
                  {todayBuild ? '✓ Shipped Today' : 'What did you BUILD?'}
                </span>
              </div>
              {!todayBuild && !showBuildForm && (
                <button onClick={() => setShowBuildForm(true)} className="w-8 h-8 rounded-full bg-strava/15 flex items-center justify-center hover:bg-strava/25 transition-colors">
                  <Plus className="w-4 h-4 text-strava" />
                </button>
              )}
            </div>

            {todayBuild && (
              <p className="text-sm text-textSecondary mt-2 pl-11">{todayBuild.description}</p>
            )}

            {!todayBuild && !showBuildForm && (
              <p className="text-xs text-textMuted mt-1 pl-11">Not read. Not watched. Built.</p>
            )}

            {showBuildForm && (
              <form onSubmit={handleSubmitBuild} className="mt-3 space-y-2 pl-11">
                <input type="text" value={buildText} onChange={e => setBuildText(e.target.value)}
                  placeholder="Built a PySpark pipeline for..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-strava transition-colors"
                  autoFocus />
                <input type="text" value={buildLink} onChange={e => setBuildLink(e.target.value)}
                  placeholder="Link (optional)"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-textSecondary focus:outline-none focus:border-border-hover transition-colors" />
                <div className="flex gap-2">
                  <button type="submit" className="bg-strava text-white font-bold px-5 py-2 rounded-xl text-xs hover:bg-strava-dark transition-colors">Ship It</button>
                  <button type="button" onClick={() => setShowBuildForm(false)} className="text-textSecondary text-xs hover:text-textPrimary transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

          {/* ⚡ Instant AI Skill Challenge Loop Card */}
          <div className={`mt-3 rounded-2xl p-4 border transition-all ${todayChallengeLog ? 'bg-blue-950/20 border-blue-500/30' : 'bg-surface border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-textPrimary">Skill Sprint: System Design</span>
                    {todayChallengeLog && <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full">Score: {todayChallengeLog.score}/10</span>}
                  </div>
                  <p className="text-xs text-textSecondary">{todayChallengeLog ? todayChallengeLog.challenge_title : '60-Second Instant AI Architect Challenge'}</p>
                </div>
              </div>
              <button
                onClick={() => handleStartChallenge()}
                className="bg-blue-500/20 text-blue-400 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-blue-500/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                {todayChallengeLog ? 'Review' : 'Start 60s Loop'}
              </button>
            </div>
          </div>
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> Spiritual & Defense
          </h2>
          <div className="space-y-2">
            {metrics.filter(m => m.category === 'Spiritual' || m.category === 'Defense').map(m => (
              <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
            ))}
          </div>
        </section>

        {/* Interstitial Log */}
        <section className="rounded-2xl bg-surface border border-border p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-textSecondary"></span> Action Log
          </h2>
          <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
            {interstitialLogs.map(log => (
              <div key={log.id} className="flex gap-3 items-start">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-strava"></div>
                  <div className="w-px h-full bg-border min-h-[16px]"></div>
                </div>
                <div>
                  <span className="text-[11px] text-textMuted font-medium">{format(new Date(log.created_at), 'HH:mm')}</span>
                  <p className="text-sm text-textSecondary">{log.content}</p>
                </div>
              </div>
            ))}
            {interstitialLogs.length === 0 && (
              <p className="text-sm text-textMuted italic">No actions logged yet. Take action.</p>
            )}
          </div>
          <form onSubmit={handleAddInterstitialLog} className="flex gap-2">
            <input type="text" value={logText} onChange={e => setLogText(e.target.value)}
              placeholder="Log an action..."
              className="flex-1 bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-strava transition-colors" />
            <button type="submit" className="bg-strava text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-strava-dark transition-colors shrink-0">
              Log
            </button>
          </form>
        </section>
      </div>

      {/* ── INSTANT SKILL CHALLENGE LOOP MODAL ───────────────── */}
      {activeChallenge && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="font-black uppercase text-xs text-blue-400 tracking-wider">60-Second Architect Challenge</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNextChallenge}
                  className="text-[10px] bg-surface-elevated text-blue-400 hover:bg-border font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Try a different question"
                >
                  🔄 Next Question
                </button>
                <button 
                  onClick={() => { setActiveChallenge(null); setChallengeFeedback(null); }}
                  className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center hover:bg-border transition-colors"
                >
                  <X className="w-4 h-4 text-textSecondary" />
                </button>
              </div>
            </div>

            <h3 className="text-base font-black text-white mb-2">{activeChallenge.title}</h3>
            
            <div className="p-3 bg-surface-elevated border border-border rounded-xl mb-4">
              <p className="text-xs text-textPrimary leading-relaxed font-mono">{activeChallenge.prompt}</p>
            </div>

            {!challengeFeedback ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block mb-1">Your 3-Bullet Rapid Solution</label>
                  <textarea
                    rows={4}
                    value={challengeResponse}
                    onChange={e => setChallengeResponse(e.target.value)}
                    placeholder="- 1. Redis token bucket with Lua script for atomic ops&#10;- 2. Fallback to local memory on network partition&#10;- 3. NTP sync check to avoid timestamp drift"
                    className="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-blue-400 transition-colors text-white font-mono"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleEvaluateChallenge}
                  disabled={isEvaluating || !challengeResponse.trim()}
                  className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit for Instant AI Review
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Score badge */}
                <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Architect Grade</span>
                  <span className="text-xl font-black text-blue-400 tabular-nums">{challengeFeedback.score} / 10</span>
                </div>

                {/* Strengths */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-success uppercase tracking-wider block">✓ Strengths Identified</span>
                  {challengeFeedback.strengths.map((s: string, idx: number) => (
                    <p key={idx} className="text-xs text-textPrimary font-mono pl-2 border-l-2 border-success/40">{s}</p>
                  ))}
                </div>

                {/* Blind spots */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">⚠ Blind Spots & Edge Cases</span>
                  {challengeFeedback.blindSpots.map((b: string, idx: number) => (
                    <p key={idx} className="text-xs text-textSecondary font-mono pl-2 border-l-2 border-warning/40">{b}</p>
                  ))}
                </div>

                {/* Golden Rule */}
                <div className="p-3 bg-strava/10 border border-strava/30 rounded-xl">
                  <span className="text-[10px] font-bold text-strava uppercase tracking-wider block mb-1">🎯 Principal Golden Rule</span>
                  <p className="text-xs text-white font-mono font-medium">{challengeFeedback.goldenRule}</p>
                </div>

                <button
                  onClick={() => { setActiveChallenge(null); setChallengeFeedback(null); }}
                  className="w-full bg-surface-elevated text-textPrimary font-bold py-3 rounded-xl text-sm hover:bg-border transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Lock In Skill & Close Loop
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeMetric && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black uppercase text-sm text-textPrimary tracking-wider">Log Metric</h3>
              <button 
                onClick={() => setActiveMetric(null)}
                className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center hover:bg-border transition-colors"
              >
                <X className="w-4 h-4 text-textSecondary" />
              </button>
            </div>

            <p className="text-xs text-textSecondary font-bold uppercase tracking-wider mb-2">
              {activeMetric.metric.name}
            </p>

            <div className="space-y-4">
              {/* Conditional Input based on Metric Type */}
              {activeMetric.metric.type === 'numeric' ? (
                <div>
                  <input
                    type="number"
                    step="any"
                    value={numericValue}
                    onChange={e => setNumericValue(e.target.value)}
                    placeholder="Enter numeric value..."
                    className="w-full bg-background border border-border rounded-xl p-3 text-lg font-bold focus:outline-none focus:border-strava transition-colors text-white"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-surface-elevated p-4 rounded-xl border border-border">
                  <span className="text-sm font-semibold text-textPrimary">Mark Completed</span>
                  <input
                    type="checkbox"
                    checked={booleanValue}
                    onChange={e => setBooleanValue(e.target.checked)}
                    className="w-5 h-5 accent-strava cursor-pointer"
                  />
                </div>
              )}

              {/* RPE Slider */}
              <div className="bg-surface-elevated p-4 rounded-xl border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-textSecondary uppercase tracking-wider">Willpower RPE</span>
                  <span className="text-sm font-black text-strava font-mono">RPE {intensityRpe}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={intensityRpe}
                  onChange={e => setIntensityRpe(parseInt(e.target.value))}
                  className="w-full accent-strava cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-bold text-textMuted mt-1 uppercase">
                  <span>Flow (1)</span>
                  <span>Grind (5)</span>
                  <span>War (10)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEntry}
                  className="flex-1 bg-strava text-white font-bold py-3 rounded-xl text-sm hover:bg-strava-dark transition-colors"
                >
                  Save Entry
                </button>
                {activeMetric.existingLog && (
                  <button
                    onClick={async () => {
                      await supabase.from('daily_logs').delete().eq('id', activeMetric.existingLog.id);
                      setActiveMetric(null);
                      await fetchData();
                    }}
                    className="bg-danger/25 text-danger font-bold px-4 py-3 rounded-xl text-sm hover:bg-danger/30 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
