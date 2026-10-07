import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '../../utils/format';

/* ------------------------------- Card ------------------------------- */
export const Card = ({ children, className, ...rest }) => (
  <section className={cn('card', className)} {...rest}>
    {children}
  </section>
);

export const CardHeader = ({ title, subtitle, action, icon: Icon, className }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4', className)}>
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon size={18} />
        </span>
      ) : null}
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
    </div>
    {action}
  </div>
);

/* ------------------------------ Buttons ------------------------------ */
export const Button = ({ children, variant = 'primary', size, loading, className, icon: Icon, ...rest }) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
    whatsapp: 'btn-whatsapp',
  };
  return (
    <button className={cn(variants[variant], size === 'sm' && 'btn-sm', className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
};

/* ------------------------------- Badge ------------------------------- */
export const Badge = ({ children, className, tone = 'neutral', dot }) => {
  const tones = {
    neutral: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-amber-700',
    danger: 'bg-danger-50 text-danger-700',
    info: 'bg-sky-50 text-sky-700',
    whatsapp: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={cn('badge', tones[tone] || tones.neutral, className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
};

/* ---------------------------- Stat card ---------------------------- */
export const StatCard = ({ label, value, hint, icon: Icon, tone = 'brand', trend, className }) => {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-amber-600',
    danger: 'bg-danger-50 text-danger-600',
    info: 'bg-sky-50 text-sky-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className={cn('card card-pad animate-fade-up', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-ink-900 sm:text-[1.75rem]">{value}</p>
          {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', tones[tone] || tones.brand)}>
            <Icon size={20} />
          </span>
        ) : null}
      </div>
      {trend ? <div className="mt-3">{trend}</div> : null}
    </div>
  );
};

/* ------------------------------ Progress ------------------------------ */
export const ProgressBar = ({ value = 0, className, tone, showLabel = false, height = 'h-2' }) => {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const color =
    tone ||
    (safe >= 85 ? 'bg-emerald-500' : safe >= 75 ? 'bg-green-500' : safe >= 60 ? 'bg-amber-500' : safe >= 40 ? 'bg-orange-500' : 'bg-red-500');
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-full overflow-hidden rounded-full bg-ink-100', height)}>
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${safe}%` }} />
      </div>
      {showLabel ? <span className="w-12 shrink-0 text-right text-xs font-semibold text-ink-600">{safe.toFixed(1)}%</span> : null}
    </div>
  );
};

/* ------------------------------- Modal ------------------------------- */
export const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm sm:p-8">
      <div className={cn('my-auto w-full animate-fade-up rounded-2xl bg-white shadow-pop', sizes[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
};

/* ------------------------------ Inputs ------------------------------ */
export const Field = ({ label, error, help, children, className }) => (
  <div className={className}>
    {label ? <label className="label">{label}</label> : null}
    {children}
    {error ? <p className="mt-1 text-xs font-medium text-danger-600">{error}</p> : help ? <p className="help">{help}</p> : null}
  </div>
);

export const Input = ({ label, error, help, className, ...rest }) => (
  <Field label={label} error={error} help={help} className={className}>
    <input className={cn('input', error && 'border-danger-400 focus:ring-danger-100')} {...rest} />
  </Field>
);

export const Textarea = ({ label, error, help, className, ...rest }) => (
  <Field label={label} error={error} help={help} className={className}>
    <textarea className={cn('input min-h-[100px] resize-y', error && 'border-danger-400')} {...rest} />
  </Field>
);

export const Select = ({ label, error, help, className, options = [], placeholder, children, ...rest }) => (
  <Field label={label} error={error} help={help} className={className}>
    <select className={cn('input appearance-none pr-9', error && 'border-danger-400')} {...rest}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
      {children}
    </select>
  </Field>
);

export const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-start gap-3">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition', checked ? 'bg-brand-600' : 'bg-ink-300')}
    >
      <span className={cn('block h-5 w-5 rounded-full bg-white shadow transition', checked && 'translate-x-5')} />
    </button>
    <span>
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
    </span>
  </label>
);

/* ------------------------------ Feedback ------------------------------ */
export const Spinner = ({ label = 'Loading…', className }) => (
  <div className={cn('flex items-center justify-center gap-3 py-12 text-ink-500', className)}>
    <Loader2 className="animate-spin" size={20} />
    <span className="text-sm">{label}</span>
  </div>
);

export const PageLoader = () => (
  <div className="space-y-4 p-1">
    <div className="skeleton h-24 w-full" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="skeleton h-28 w-full" />
      ))}
    </div>
    <div className="skeleton h-72 w-full" />
  </div>
);

export const EmptyState = ({ icon: Icon = Info, title, message, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
      <Icon size={24} />
    </span>
    <div>
      <p className="font-semibold text-ink-800">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-sm text-ink-500">{message}</p> : null}
    </div>
    {action}
  </div>
);

export const Alert = ({ tone = 'info', title, children, onClose, className }) => {
  const tones = {
    info: { wrap: 'bg-sky-50 text-sky-800 border-sky-100', Icon: Info },
    success: { wrap: 'bg-success-50 text-success-700 border-success-100', Icon: CheckCircle2 },
    warning: { wrap: 'bg-warning-50 text-amber-800 border-warning-100', Icon: AlertCircle },
    danger: { wrap: 'bg-danger-50 text-danger-700 border-danger-100', Icon: XCircle },
  };
  const { wrap, Icon } = tones[tone] || tones.info;
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', wrap, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {onClose ? (
        <button onClick={onClose} className="rounded p-1 transition hover:bg-black/5">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
};

/* ------------------------------- Toasts ------------------------------- */
let toastListener = () => {};
export const toast = (message, type = 'success') => toastListener({ message, type, id: Date.now() + Math.random() });

export const ToastHost = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    toastListener = (item) => {
      setItems((current) => [...current, item]);
      setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), 4200);
    };
    return () => {
      toastListener = () => {};
    };
  }, []);

  const tones = {
    success: 'border-success-100 bg-white text-success-700',
    error: 'border-danger-100 bg-white text-danger-700',
    info: 'border-sky-100 bg-white text-sky-700',
    warning: 'border-warning-100 bg-white text-amber-700',
  };
  const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertCircle };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
      {items.map((item) => {
        const Icon = icons[item.type] || Info;
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-pop',
              tones[item.type] || tones.info
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-ink-700">{item.message}</span>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------- Tabs -------------------------------- */
export const Tabs = ({ tabs, active, onChange, className }) => (
  <div className={cn('flex flex-wrap gap-1 rounded-xl bg-ink-100/70 p-1', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
          active === tab.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-600 hover:text-ink-900'
        )}
      >
        {tab.icon ? <tab.icon size={15} /> : null}
        {tab.label}
        {tab.count !== undefined ? (
          <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{tab.count}</span>
        ) : null}
      </button>
    ))}
  </div>
);

/* ------------------------- Avatar / user chip ------------------------- */
export const Avatar = ({ name = '', src, size = 40, className, tone }) => (
  <span
    className={cn(
      'grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white',
      !tone && 'gradient-brand',
      tone,
      className
    )}
    style={{ width: size, height: size, fontSize: size * 0.38 }}
  >
    {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
  </span>
);

export const SectionTitle = ({ title, subtitle, action, className }) => (
  <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
    <div>
      <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);
