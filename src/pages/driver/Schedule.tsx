import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAppStore, useToast } from '../../store/appStore.js';
import { formatDateTime, shiftLabel, shiftColor } from '../../lib/format.js';
import type { Schedule } from '../../../shared/types.js';
import { Calendar, ChevronLeft, ChevronRight, Clock, Sun, Moon, Sunrise, UserCheck } from 'lucide-react';

const DAYS_CN = ['日', '一', '二', '三', '四', '五', '六'];

export default function SchedulePage() {
  const setLoading = useAppStore((s) => s.setLoading);
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const load = async () => {
    try {
      setLoading(true);
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const r = await api.schedules.list({ month: monthStr });
      setSchedules(r as unknown as Schedule[]);
    } catch (e) { toast.error((e as { message?: string }).message || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); } };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); } };

  const getScheduleForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter((s) => s.scheduleDate === dateStr);
  };

  const shiftIcon = (type: string) => {
    switch (type) {
      case 'morning': return <Sunrise className="w-3 h-3" />;
      case 'afternoon': return <Sun className="w-3 h-3" />;
      case 'night': return <Moon className="w-3 h-3" />;
      case 'full': return <Clock className="w-3 h-3" />;
      default: return <UserCheck className="w-3 h-3" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-primary-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" /> 排班日历
          </h3>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="btn-ghost !p-1.5"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-lg font-bold text-primary-900 min-w-[120px] text-center">{year}年{month}月</span>
            <button onClick={nextMonth} className="btn-ghost !p-1.5"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAYS_CN.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">周{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} className="h-20 rounded-lg bg-slate-50/50" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const daySchedules = getScheduleForDay(day);
            const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
            return (
              <div key={day} className={`h-20 rounded-lg border p-1.5 transition-all ${isToday ? 'border-accent-400 bg-accent-50/30' : 'border-slate-100 hover:border-primary-200'}`}>
                <div className={`text-xs font-bold mb-1 ${isToday ? 'text-accent-600' : 'text-primary-800'}`}>{day}</div>
                <div className="space-y-0.5">
                  {daySchedules.map((s) => (
                    <div key={s.id} className={`text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5 truncate ${shiftColor[s.shiftType]}`}>
                      {shiftIcon(s.shiftType)} {shiftLabel[s.shiftType]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-primary-800 mb-3">排班图例</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(shiftLabel).map(([key, label]) => (
            <div key={key} className={`tag-pill ${shiftColor[key as keyof typeof shiftColor]}`}>{label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
