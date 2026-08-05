import { useState, useEffect } from 'react';
import { Check, Flame, ShieldAlert, Dumbbell, BrainCircuit, Moon, FileText, Activity, Loader2, Footprints, TrendingDown, Hammer, Zap, Trophy, ChevronLeft, ChevronRight, CalendarDays, Plus, X, Gauge } from 'lucide-react';
import { supabase } from './supabaseClient';
import { format, subDays, addDays, eachDayOfInterval, differenceInDays, parseISO, isToday, isFuture } from 'date-fns';
import * as ActivityCalendarModule from 'react-activity-calendar';
const ActivityCalendar = (ActivityCalendarModule as any).default || (ActivityCalendarModule as any).ActivityCalendar || ActivityCalendarModule;

const iconMap: Record<string, any> = {
  Activity, Dumbbell, BrainCircuit, FileText, Moon, Flame, ShieldAlert, Footprints, TrendingDown, Hammer
};

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
      if (name.includes('hyrox') || name.includes('strength')) baseScore += 10;
      else if (name.includes('kora') || name.includes('recall')) baseScore += 8;
      else if (name.includes('prayer') || name.includes('naam') || name.includes('sleep by')) baseScore += 3;
      else if (name.includes('eat')) baseScore += 3;
      else baseScore += 5; // generic boolean habit
    } else if (metric.type === 'numeric' && log.value_numeric > 0) {
      if (name.includes('run')) baseScore += 1.5 * log.value_numeric;
      else if (name.includes('focus')) baseScore += 5 * log.value_numeric;
      else baseScore += 3 * log.value_numeric;
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

// ── Weekly Effort Chart (bars + line graph + baseline) ─────────
function WeeklyEffortChart({ historicalLogs, metrics }: { historicalLogs: any[]; metrics: any[] }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = historicalLogs.filter(l => l.log_date === dateStr);
    const { score } = computeRelativeEffort(dayLogs, metrics);
    days.push({ label: format(date, 'EEE')[0], score, dateStr, isToday: i === 0 });
  }

  const maxScore = Math.max(...days.map(d => d.score), 30); // minimum ceiling of 30 for visual scaling
  const avgScore = Math.round(days.reduce((sum, d) => sum + d.score, 0) / days.length);

  // SVG dimensions
  const chartW = 100; // percentage-based viewBox
  const chartH = 80;
  const barAreaTop = 14; // leave room for score labels
  const barAreaBottom = 16; // leave room for day labels
  const barAreaH = chartH - barAreaTop - barAreaBottom;
  const barWidth = 8;
  const gap = (chartW - barWidth * 7) / 8; // even spacing

  // Compute bar positions & heights
  const barData = days.map((day, i) => {
    const x = gap + i * (barWidth + gap);
    const centerX = x + barWidth / 2;
    const h = day.score > 0 ? Math.max(3, (day.score / maxScore) * barAreaH) : 1.5;
    const y = barAreaTop + barAreaH - h;
    const color = day.score >= 100 ? '#FC4C02' : day.score >= 70 ? '#FC4C02cc' : day.score >= 35 ? '#34D399aa' : day.score > 0 ? '#3F3F46' : '#27272A';
    return { ...day, x, centerX, y, h, color };
  });

  // Line graph points
  const linePoints = barData.map(b => `${b.centerX},${b.y}`).join(' ');

  // Baseline Y position
  const baselineY = barAreaTop + barAreaH - (avgScore > 0 ? Math.max(3, (avgScore / maxScore) * barAreaH) : 0);

  return (
    <div className="rounded-2xl bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-strava" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">7-Day Effort Trend</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-px border-t border-dashed border-warning"></div>
          <span className="text-[9px] font-semibold text-warning tabular-nums">AVG {avgScore}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-28" preserveAspectRatio="none">
        {/* Baseline (average) */}
        {avgScore > 0 && (
          <line x1="0" y1={baselineY} x2={chartW} y2={baselineY}
            stroke="#F59E0B" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.6" />
        )}

        {/* Bars */}
        {barData.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={barWidth} height={b.h} rx="1.2" fill={b.color}
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

        {/* Dots at each data point */}
        {barData.map((b, i) => (
          b.score > 0 && (
            <circle key={`dot-${i}`} cx={b.centerX} cy={b.y} r="1.2"
              fill={b.isToday ? '#FC4C02' : '#fafafa'} stroke="#0a0a0a" strokeWidth="0.4" />
          )
        ))}

        {/* Score labels above bars */}
        {barData.map((b, i) => (
          b.score > 0 && (
            <text key={`score-${i}`} x={b.centerX} y={b.y - 2.5} textAnchor="middle"
              className="fill-textSecondary" style={{ fontSize: '3.5px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {b.score}
            </text>
          )
        ))}

        {/* Day labels below bars */}
        {barData.map((b, i) => (
          <text key={`label-${i}`} x={b.centerX} y={chartH - 3} textAnchor="middle"
            className={b.isToday ? 'fill-strava' : 'fill-textMuted'}
            style={{ fontSize: '3.8px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            {b.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Streak Card ──────────────────────────────────────────────
function StreakCard({ label, emoji, current, best }: { label: string; emoji: string; current: number; best: number }) {
  const isOnFire = current >= 3;
  return (
    <div className={`rounded-2xl p-4 border transition-all ${isOnFire ? 'border-strava/30 bg-strava/5' : 'border-border bg-surface'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-1">
          <span className={`text-3xl font-black tabular-nums ${isOnFire ? 'text-strava' : 'text-textPrimary'}`}>{current}</span>
          {isOnFire && <Zap className="w-4 h-4 text-strava mb-1.5" />}
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-3 h-3 text-textMuted" />
          <span className="text-xs font-semibold text-textMuted tabular-nums">{best}</span>
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
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          isCompleted
            ? isKryptonite
              ? 'bg-danger border-danger'
              : 'bg-strava border-strava'
            : 'border-textMuted'
        }`}>
          {isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </div>
      )}

      {metric.type === 'numeric' && (
        <div className={`px-3 py-1 rounded-lg ${isCompleted ? 'bg-strava/15' : 'bg-surface-elevated'}`}>
          <span className={`font-black text-lg tabular-nums ${isCompleted ? 'text-strava' : 'text-textMuted'}`}>
            {log && log.value_numeric !== null ? log.value_numeric : '—'}
          </span>
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
  const [interstitialLogs, setInterstitialLogs] = useState<any[]>([]);
  const [todayBuild, setTodayBuild] = useState<any>(null);
  const [buildText, setBuildText] = useState('');
  const [buildLink, setBuildLink] = useState('');
  const [showBuildForm, setShowBuildForm] = useState(false);
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

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

    const historyStart = format(subDays(new Date(), 180), 'yyyy-MM-dd');
    const { data: historyData } = await supabase.from('daily_logs').select('*').gte('log_date', historyStart);

    const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate); dayEnd.setHours(23, 59, 59, 999);
    const { data: intLogsData, error: intErr } = await supabase
      .from('interstitial_logs').select('*')
      .gte('created_at', dayStart.toISOString()).lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true });
    if (intErr && !dbError) setDbError(intErr.message);

    const { data: buildData } = await supabase.from('build_logs').select('*').eq('log_date', selectedDateStr).maybeSingle();

    if (metricsData) setMetrics(metricsData);
    if (logsData) setLogs(logsData);
    if (historyData) setHistoricalLogs(historyData);
    if (intLogsData) setInterstitialLogs(intLogsData);
    setTodayBuild(buildData || null);
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
      if (metric.type === 'numeric') {
        const val = prompt(`Enter value for ${metric.name}:`);
        if (val === null) return;
        const numVal = parseFloat(val);
        if (isNaN(numVal)) return;
        if (existingLog) await supabase.from('daily_logs').update({ value_numeric: numVal }).eq('id', existingLog.id);
        else await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: selectedDateStr, value_numeric: numVal }]);
      } else {
        if (existingLog) await supabase.from('daily_logs').delete().eq('id', existingLog.id);
        else await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: selectedDateStr, value_boolean: true }]);
      }
      await fetchData();
    } catch (err) { console.error("Toggle error:", err); }
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

  const getHeatmapData = () => {
    if (!metrics.length) return [];
    const end = new Date();
    const start = subDays(end, 90);
    const days = eachDayOfInterval({ start, end });
    const activityMap: Record<string, number> = {};
    days.forEach(d => { activityMap[format(d, 'yyyy-MM-dd')] = 0; });
    historicalLogs.forEach(log => {
      const metric = metrics.find(m => m.id === log.metric_id);
      if (!metric) return;
      const dateStr = log.log_date;
      if (activityMap[dateStr] === undefined) return;
      if (metric.type === 'boolean') {
        if (metric.is_kryptonite && log.value_boolean) activityMap[dateStr] -= 2;
        else if (!metric.is_kryptonite && log.value_boolean) activityMap[dateStr] += 1;
      } else if (metric.type === 'numeric' && log.value_numeric > 0) activityMap[dateStr] += 1;
    });
    return Object.entries(activityMap).map(([date, score]) => {
      let level = 0;
      if (score > 0 && score <= 2) level = 1;
      else if (score > 2 && score <= 4) level = 2;
      else if (score > 4 && score <= 6) level = 3;
      else if (score > 6) level = 4;
      return { date, count: Math.max(0, score), level };
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-strava" />
      </div>
    );
  }

  const hasLeak = logs.some(l => {
    const metric = metrics.find(m => m.id === l.metric_id);
    return metric && metric.is_kryptonite && l.value_boolean;
  });

  const heatmapData = getHeatmapData();
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

        {/* 7-Day Effort Trend */}
        <WeeklyEffortChart historicalLogs={historicalLogs} metrics={metrics} />

        {/* 90-Day Heatmap */}
        {heatmapData.length > 0 && (
          <div className="rounded-2xl bg-surface border border-border p-4 overflow-x-auto">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary mb-3">90-Day Momentum</h2>
            <ActivityCalendar
              data={heatmapData}
              theme={{
                light: ['#1c1c1e', '#4a1c08', '#7c2d12', '#c2410c', '#FC4C02'],
                dark: ['#1c1c1e', '#4a1c08', '#7c2d12', '#c2410c', '#FC4C02'],
              }}
              colorScheme="dark"
              labels={{ legend: { less: 'Rest', more: 'Active' } }}
              hideTotalCount
              hideMonthLabels
            />
          </div>
        )}

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

        {/* Spiritual & Defense */}
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
    </div>
  );
}
