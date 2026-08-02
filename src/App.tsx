import { useState, useEffect } from 'react';
import { Check, Flame, ShieldAlert, Dumbbell, BrainCircuit, Moon, FileText, Activity, Loader2, Footprints, Apple, TrendingDown } from 'lucide-react';
import { supabase } from './supabaseClient';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import * as ActivityCalendarModule from 'react-activity-calendar';
const ActivityCalendar = (ActivityCalendarModule as any).default || (ActivityCalendarModule as any).ActivityCalendar || ActivityCalendarModule;

// Map database icon strings to Lucide components
const iconMap: Record<string, any> = {
  Activity, Dumbbell, BrainCircuit, FileText, Moon, Flame, ShieldAlert, Footprints, Apple, TrendingDown
};

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

export default function App() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [interstitialLogs, setInterstitialLogs] = useState<any[]>([]);
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = async () => {
    setDbError(null);
    
    // Fetch metrics
    const { data: metricsData, error: metricsErr } = await supabase.from('metrics').select('*').eq('is_active', true);
    if (metricsErr) setDbError(metricsErr.message);
    
    // Fetch today's logs
    const { data: logsData, error: logsErr } = await supabase.from('daily_logs').select('*').eq('log_date', today);
    if (logsErr && !dbError) setDbError(logsErr.message);

    // Fetch last 90 days for heatmap
    const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    const { data: historyData } = await supabase
      .from('daily_logs')
      .select('*')
      .gte('log_date', ninetyDaysAgo);
    
    // Fetch today's interstitial logs
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: intLogsData, error: intErr } = await supabase
      .from('interstitial_logs')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: true });
    if (intErr && !dbError) setDbError(intErr.message);
      
    if (metricsData) setMetrics(metricsData);
    if (logsData) setLogs(logsData);
    if (historyData) setHistoricalLogs(historyData);
    if (intLogsData) setInterstitialLogs(intLogsData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscriptions
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
  }, []);

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
          await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: today, value_numeric: numVal }]);
        }
      } else {
        // Boolean toggle
        if (existingLog) {
          await supabase.from('daily_logs').delete().eq('id', existingLog.id);
        } else {
          await supabase.from('daily_logs').insert([{ metric_id: metric.id, log_date: today, value_boolean: true }]);
        }
      }
      // Force UI to update immediately
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
  };

  // Process historical data for heatmap
  const getHeatmapData = () => {
    if (!metrics.length || !historicalLogs.length) return [];
    
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
      if (activityMap[dateStr] === undefined) return; // outside 90 days range

      if (metric.type === 'boolean') {
        if (metric.is_kryptonite && log.value_boolean) {
          activityMap[dateStr] -= 2; // Penalize leaks
        } else if (!metric.is_kryptonite && log.value_boolean) {
          activityMap[dateStr] += 1;
        }
      } else if (metric.type === 'numeric' && log.value_numeric > 0) {
        activityMap[dateStr] += 1;
      }
    });

    // Map to React Activity Calendar format
    return Object.entries(activityMap).map(([date, score]) => {
      let level = 0;
      if (score > 0 && score <= 2) level = 1;
      else if (score > 2 && score <= 4) level = 2;
      else if (score > 4 && score <= 6) level = 3;
      else if (score > 6) level = 4;
      
      return {
        date,
        count: Math.max(0, score),
        level
      };
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

      <header className="mb-12 border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">The Execution Engine</h1>
          <p className="text-textSecondary font-mono mt-2">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
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
                labels={{
                  legend: {
                    less: 'Weak',
                    more: 'Strong'
                  }
                }}
                hideTotalCount
                hideMonthLabels
             />
          </div>
        )}
      </header>

      <div className="grid lg:grid-cols-2 gap-12 max-w-6xl">
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Physical Engine</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Physical').map(m => (
                <MetricCard 
                  key={m.id} 
                  metric={m} 
                  log={logs.find(l => l.metric_id === m.id)} 
                  onToggle={handleToggle} 
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Cognitive Engine</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Cognitive').map(m => (
                <MetricCard 
                  key={m.id} 
                  metric={m} 
                  log={logs.find(l => l.metric_id === m.id)} 
                  onToggle={handleToggle} 
                />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4">Spiritual & Defense</h2>
            <div className="space-y-3">
              {metrics.filter(m => m.category === 'Spiritual' || m.category === 'Defense').map(m => (
                <MetricCard 
                  key={m.id} 
                  metric={m} 
                  log={logs.find(l => l.metric_id === m.id)} 
                  onToggle={handleToggle} 
                />
              ))}
            </div>
          </section>

          <section className="mt-12 p-6 bg-surface border border-white/10 rounded-lg flex flex-col h-[400px]">
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
