import { useAppStore } from '../store/appStore.js';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toaster() {
  const { toasts, removeToast } = useAppStore();
  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-success-500" />,
    error: <XCircle className="w-5 h-5 text-danger-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning-500" />,
    info: <Info className="w-5 h-5 text-accent-500" />,
  };
  const borderMap = {
    success: 'border-l-4 border-success-500',
    error: 'border-l-4 border-danger-500',
    warning: 'border-l-4 border-warning-500',
    info: 'border-l-4 border-accent-500',
  };
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`animate-fadeInUp pointer-events-auto bg-white rounded-lg shadow-cardHover p-3 flex items-start gap-3 ${borderMap[t.type]}`}>
          <div className="pt-0.5 shrink-0">{iconMap[t.type]}</div>
          <div className="flex-1 text-sm text-primary-800">{t.message}</div>
          <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
