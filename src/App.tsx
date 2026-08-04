import { useState, useEffect } from 'react';
import { Check, Flame, ShieldAlert, Dumbbell, BrainCircuit, Moon, FileText, Activity, Loader2, Footprints, Apple, TrendingDown, Hammer, Zap, Trophy, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { supabase } from './supabaseClient';
import { format, subDays, addDays, eachDayOfInterval, differenceInDays, parseISO, isToday, isFuture } from 'date-fns';
import * as ActivityCalendarModule from 'react-activity-calendar';
const ActivityCalendar = (ActivityCalendarModule as any).default || (ActivityCalendarModule as any).ActivityCalendar || ActivityCalendarModule;

// Map database icon strings to Lucide components
const iconMap: Record<string, any> = {
  Activity, Dumbbell, BrainCircuit, FileText, Moon, Flame, ShieldAlert, Footprints, Apple, TrendingDown, Hammer
};

// ── Streak Calculator ──────────────────────────────────────────────────
function computeStreaks(
  historicalLogs: any[],
  metrics: any[],
  category: string
): { current: number; best: number } {
  const categoryMetricIds = metrics
    .filter(m => m.category === category && !m.is_kryptonite)
    .map(m => m.id);

  if (categoryMetricIds.length === 0) return { current: 0, best: 0 };

  // Get unique dates where at least one metric in this category was logged
  const activeDates = new Set<string>();
  historicalLogs.forEach(log => {
    if (categoryMetricIds.includes(log.metric_id)) {
      if (log.value_boolean || (log.value_numeric !== null && log.value_numeric > 0)) {
        activeDates.add(log.log_date);
      }
    }
  });

  // Sort dates descending
  const sortedDates = Array.from(activeDates).sort((a, b) => b.localeCompare(a));
  if (sortedDates.length === 0) return { current: 0, best: 0 };

  // Calculate current streak (counting back from today)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  let currentStreak = 0;
  // Check if today or yesterday has a log (to allow logging later in the day)
  const startFrom = sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr ? sortedDates[0] : null;
  
  if (startFrom) {
    let expectedDate = parseISO(startFrom);
    for (const dateStr of sortedDates) {
      const logDate = parseISO(dateStr);
      const diff = differenceInDays(expectedDate, logDate);
      if (diff === 0) {
        currentStreak++;
        expectedDate = subDays(expectedDate, 1);
      } else if (diff > 0) {
        break; // streak broken
      }
    }
  }

  // Calculate best streak ever
  let bestStreak = 0;
  let tempStreak = 1;
  const allSorted = Array.from(activeDates).sort(); // ascending
  for (let i = 1; i < allSorted.length; i++) {
    const diff = differenceInDays(parseISO(allSorted[i]), parseISO(allSorted[i - 1]));
    if (diff === 1) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  return { current: currentStreak, best: bestStreak };
}

// ── Streak Badge Component ──────────────────────────────────────────────
function StreakBadge({ label, current, best }: { label: string; current: number; best: number }) {
  const isOnFire = current >= 3;
  return (
    <div className={`p-3 rounded-lg border transition-all ${isOnFire ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 bg-surface/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        {isOnFire && <Zap className="w-3 h-3 text-amber-400" />}
        <span className="text-[10px] font-bold uppercase tracking-widest text-textSecondary">{label}</span>
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-2xl font-black font-mono ${isOnFire ? 'text-amber-400' : 'text-white'}`}>{current}</span>
        <div className="flex items-center gap-1 mb-1">
          <Trophy className="w-3 h-3 text-textSecondary" />
          <span className="text-xs text-textSecondary font-mono">{best}</span>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card Component ──────────────────────────────────────────────
function MetricCard({ metric, log, onToggle }: { metric: any, log: any, onToggle: any }) {
  const Icon = iconMap[metric.icon] || Activity;
  const isCompleted = log ? (metric.type === 'boolean' ? log.value_boolean : (log.value_numeric !== null && log.value_numeric > 0)) : false;
  const isKryptonite = metric.is_kryptonite;
  
  const bgClass = isCompleted 
    ? (isKryptonite ? 'bg-primary/20 border-primary' : 'bg-surface border-white/20')
    : 'bg-surface/50 border-white/5 hover:border-white/20';
    
  const textClass = isCompleted
    ? (isKryptonite ? 'text-primary' : 'text-white')
    : 'text-textSecondary';

  return (
    <div 
      onClick={() => onToggle(metric, isCompleted, log)}
      className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${bgClass}`}
    >
      <div className="flex items-center gap-4">
        <Icon className={`w-6 h-6 ${textClass}`} />
        <span className={`font-semibold ${textClass}`}>{metric.name}</span>
      </div>
      {metric.type === 'boolean' && (
        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isCompleted ? (isKryptonite ? 'bg-primary border-primary' : 'bg-white border-white text-black') : 'border-white/20'}`}>
          {isCompleted && <Check className="w-4 h-4" />}
        </div>
      )}
      {metric.type === 'numeric' && (
        <span className={`font-mono text-xl ${textClass}`}>
          {log && log.value_numeric !== null ? log.value_numeric : '-'}
        </span>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
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
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    if (!isFuture(next)) setSelectedDate(next);
  };
  const goToToday = () => setSelectedDate(new Date());

  const fetchData = async () => {
    setDbError(null);
    
    const { data: metricsData, error: metricsErr } = await supabase.from('metrics').select('*').eq('is_active', true);
    if (metricsErr) setDbError(metricsErr.message);
    
    const { data: logsData, error: logsErr } = await supabase.from('daily_logs').select('*').eq('log_date', selectedDateStr);
    if (logsErr && !dbError) setDbError(logsErr.message);

    // Fetch last 180 days for heatmap + streak computation
    const historyStart = format(subDays(new Date(), 180), 'yyyy-MM-dd');
    const { data: historyData } = await supabase
      .from('daily_logs')
      .select('*')
      .gte('log_date', historyStart);
    
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    const { data: intLogsData, error: intErr } = await supabase
      .from('interstitial_logs')
      .select('*')
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true });
    if (intErr && !dbError) setDbError(intErr.message);

    // Fetch today's build log
    const { data: buildData } = await supabase
      .from('build_logs')
      .select('*')
      .eq('log_date', selectedDateStr)
      .maybeSingle();
      
    if (metricsData) setMetrics(metricsData);
    if (logsData) setLogs(logsData);
    if (historyData) setHistoricalLogs(historyData);
    if (intLogsData) setInterstitialLogs(intLogsData);
    setTodayBuild(buildData || null);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    const logsSub = supabase.channel('daily_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, fetchData)
      .subscribe();
      
    const intLogsSub = supabase.channel('interstitial_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interstitial_logs' }, fetchData)
      .subscribe();
      
    return () => {
      supabase.removeChannel(logsSub);
      supabase.removeChannel(intLogsSub);
    };
  }, [selectedDateStr]);

  const handleToggle = async (metric: any, _isCompleted: boolean, existingLog: any) => {
    try {
      if (metric.type === 'numeric') {
        const val = prompt(`Enter value for ${metric.name}:`);
        if (val === null) return;
        const numVal = parseFloat(val);
        if (isNaN(numVal)) return;
        
        if (existingLog) {
          await supabase.from('daily_logs').update({ value_numeric: numVal }).eq('id', existingLog.id);
        } else {
          await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: selectedDateStr, value_numeric: numVal }]);
        }
      } else {
        if (existingLog) {
          await supabase.from('daily_logs').delete().eq('id', existingLog.id);
        } else {
          await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: selectedDateStr, value_boolean: true }]);
        }
      }
      await fetchData();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleAddInterstitialLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logText.trim()) return;
    await supabase.from('interstitial_logs').insert([{ content: logText.trim(), log_type: 'reflection' }]);
    setLogText('');
    await fetchData();
  };

  const handleSubmitBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildText.trim()) return;
    
    if (todayBuild) {
      await supabase.from('build_logs').update({ description: buildText.trim(), link: buildLink.trim() || null }).eq('id', todayBuild.id);
    } else {
      await supabase.from('build_logs').insert([{ log_date: selectedDateStr, description: buildText.trim(), link: buildLink.trim() || null }]);
    }
    setShowBuildForm(false);
    setBuildText('');
    setBuildLink('');
    await fetchData();
  };

  // Process historical data for heatmap
  const getHeatmapData = () => {
    if (!metrics.length) return [];
    
    const end = new Date();
    const start = subDays(end, 90);
    const days = eachDayOfInterval({ start, end });
    
    const activityMap: Record<string, number> = {};
    days.forEach(d => {
      activityMap[format(d, 'yyyy-MM-dd')] = 0;
    });

    historicalLogs.forEach(log => {
      const metric = metrics.find(m => m.id === log.metric_id);
      if (!metric) return;
      
      const dateStr = log.log_date;
      if (activityMap[dateStr] === undefined) return;

      if (metric.type === 'boolean') {
        if (metric.is_kryptonite && log.value_boolean) {
          activityMap[dateStr] -= 2;
        } else if (!metric.is_kryptonite && log.value_boolean) {
          activityMap[dateStr] += 1;
        }
      } else if (metric.type === 'numeric' && log.value_numeric > 0) {
        activityMap[dateStr] += 1;
      }
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
    return <div className="min-h-screen bg-background text-white flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  const hasLeak = logs.some(l => {
    const metric = metrics.find(m => m.id === l.metric_id);
    return metric && metric.is_kryptonite && l.value_boolean;
  });

  const heatmapData = getHeatmapData();

  // Compute streaks per engine
  const physicalStreak = computeStreaks(historicalLogs, metrics, 'Physical');
  const cognitiveStreak = computeStreaks(historicalLogs, metrics, 'Cognitive');
  const spiritualStreak = computeStreaks(historicalLogs, metrics, 'Spiritual');

  return (
    <div className="min-h-screen bg-background text-textPrimary p-4 md:p-8 font-sans pb-24 selection:bg-primary selection:text-white">
      {dbError && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm font-mono">
          Database Error: {dbError}. Did you run the SQL schema script in Supabase?
        </div>
      )}

      {hasLeak && (
        <div className="mb-8 p-4 bg-primary/20 border border-primary text-primary font-bold uppercase tracking-wider rounded flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          "You are bleeding out your action-energy before you even start the day. Stop wasting your energy."
        </div>
      )}

      {/* ── PAST DAY INDICATOR ────────────────────────────────── */}
      {!isViewingToday && (
        <div className="mb-4 p-3 bg-amber-950/30 border border-amber-500/30 text-amber-400 rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">Viewing Past Day</span>
          </div>
          <button onClick={goToToday} className="text-xs bg-amber-500/20 px-3 py-1 rounded font-bold uppercase hover:bg-amber-500/30 transition-colors">
            Back to Today
          </button>
        </div>
      )}

      <header className="mb-8 border-b border-white/10 pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">The Execution Engine</h1>
            {/* ── DATE NAVIGATOR ────────────────────────────────── */}
            <div className="flex items-center gap-3 mt-3">
              <button onClick={goToPreviousDay} className="p-1.5 rounded border border-white/10 hover:border-white/30 hover:bg-surface transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className={`font-mono text-sm ${isViewingToday ? 'text-textSecondary' : 'text-amber-400'}`}>
                {format(selectedDate, 'EEEE, MMMM do, yyyy')}
              </p>
              <button 
                onClick={goToNextDay} 
                disabled={isViewingToday}
                className={`p-1.5 rounded border transition-all ${isViewingToday ? 'border-white/5 text-white/20 cursor-not-allowed' : 'border-white/10 hover:border-white/30 hover:bg-surface'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {!isViewingToday && (
                <button onClick={goToToday} className="text-[10px] bg-white/10 text-white px-2 py-1 rounded font-bold uppercase hover:bg-white/20 transition-colors">
                  Today
                </button>
              )}
            </div>
          </div>
          
          {heatmapData.length > 0 && (
            <div className="bg-surface/50 p-4 rounded-lg border border-white/5">
               <h2 className="text-[10px] font-bold uppercase tracking-widest text-textSecondary mb-2">90-Day Momentum</h2>
               <ActivityCalendar 
                  data={heatmapData} 
                  theme={{
                    light: ['#171717', '#450a0a', '#7f1d1d', '#b91c1c', '#ef4444'],
                    dark: ['#171717', '#450a0a', '#7f1d1d', '#b91c1c', '#ef4444'],
                  }}
                  colorScheme="dark"
                  labels={{ legend: { less: 'Weak', more: 'Strong' } }}
                  hideTotalCount
                  hideMonthLabels
               />
            </div>
          )}
        </div>

        {/* ── STREAK ENGINE ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StreakBadge label="Physical" current={physicalStreak.current} best={physicalStreak.best} />
          <StreakBadge label="Cognitive" current={cognitiveStreak.current} best={cognitiveStreak.best} />
          <StreakBadge label="Spiritual" current={spiritualStreak.current} best={spiritualStreak.best} />
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-12 max-w-6xl">
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Physical Engine</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Physical').map(m => (
                <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Cognitive Engine</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Cognitive').map(m => (
                <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
              ))}
            </div>

            {/* ── BUILD-FIRST CHALLENGE ────────────────────────────── */}
            <div className={`mt-4 p-4 border rounded-lg transition-all ${todayBuild ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Hammer className={`w-5 h-5 ${todayBuild ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className={`font-bold text-sm uppercase tracking-wider ${todayBuild ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {todayBuild ? 'Shipped Today' : 'What Did You BUILD Today?'}
                  </span>
                </div>
                {!todayBuild && !showBuildForm && (
                  <button onClick={() => setShowBuildForm(true)} className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded font-bold uppercase hover:bg-amber-500/30 transition-colors">
                    Log Build
                  </button>
                )}
              </div>

              {todayBuild && (
                <div className="mt-2">
                  <p className="text-sm text-white font-mono">{todayBuild.description}</p>
                  {todayBuild.link && (
                    <a href={todayBuild.link} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 underline mt-1 inline-block">
                      View →
                    </a>
                  )}
                </div>
              )}

              {!todayBuild && !showBuildForm && (
                <p className="text-xs text-amber-400/60 italic mt-1">
                  Not read. Not watched. Not planned. What did you BUILD?
                </p>
              )}

              {showBuildForm && (
                <form onSubmit={handleSubmitBuild} className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={buildText}
                    onChange={e => setBuildText(e.target.value)}
                    placeholder="Built a PySpark pipeline for..."
                    className="w-full bg-background border border-white/20 rounded p-2 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={buildLink}
                    onChange={e => setBuildLink(e.target.value)}
                    placeholder="Link (optional): GitHub commit, screenshot..."
                    className="w-full bg-background border border-white/10 rounded p-2 text-xs focus:outline-none focus:border-white/30 transition-colors text-textSecondary"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-amber-500 text-black font-bold px-4 py-1.5 rounded uppercase text-xs hover:bg-amber-400 transition-colors">Ship It</button>
                    <button type="button" onClick={() => setShowBuildForm(false)} className="text-textSecondary text-xs hover:text-white transition-colors">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Spiritual & Defense</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Spiritual' || m.category === 'Defense').map(m => (
                <MetricCard key={m.id} metric={m} log={logs.find(l => l.metric_id === m.id)} onToggle={handleToggle} />
              ))}
            </div>
          </section>

          <section className="mt-4 p-6 bg-surface border border-white/10 rounded-lg flex flex-col h-[400px]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Interstitial Log</h2>
            <div className="space-y-4 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {interstitialLogs.map(log => (
                <div key={log.id} className="text-sm font-mono break-words">
                  <span className="text-textSecondary mr-2">{format(new Date(log.created_at), 'HH:mm')}</span> 
                  - {log.content}
                </div>
              ))}
              {interstitialLogs.length === 0 && (
                <div className="text-textSecondary text-sm italic mt-4">No logs yet today. Take action.</div>
              )}
            </div>
            <form onSubmit={handleAddInterstitialLog} className="flex gap-2 shrink-0">
              <input 
                type="text" 
                value={logText}
                onChange={e => setLogText(e.target.value)}
                placeholder="Log an action (no feelings)..."
                className="flex-1 bg-background border border-white/20 rounded p-3 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <button type="submit" className="bg-white text-black font-bold px-6 py-2 rounded uppercase text-sm hover:bg-white/90 shrink-0">Log</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
