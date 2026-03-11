"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import clsx from 'clsx';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { Task, TaskStatus, Priority } from '@/lib/types';
import { Moon, Sun, Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

const statuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'COMPLETED', 'BLOCKED'];

const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En desarrollo',
  IN_REVIEW: 'En revisión',
  TESTING: 'Testing',
  COMPLETED: 'Completado',
  BLOCKED: 'Bloqueado',
};

const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const priorityLabel: Record<Priority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Priority>('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [view, setView] = useState<'KANBAN' | 'LIST' | 'CALENDAR'>('KANBAN');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('priority');
  const [isDark, setIsDark] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [timeTask, setTimeTask] = useState<Task | null>(null);
  const [me, setMe] = useState<{ email: string; role: 'ADMIN' | 'USER' } | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Error ${res.status}`);
      }
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('loadTasks error:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    fetch('/api/auth/me').then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setMe(d.user);
      }
    });
    const saved = localStorage.getItem('taskflow_theme');
    const useDark = saved ? saved === 'dark' : true;
    setIsDark(useDark);
    document.documentElement.classList.toggle('dark', useDark);
    document.body.classList.toggle('dark', useDark);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.body.classList.toggle('dark', next);
    localStorage.setItem('taskflow_theme', next ? 'dark' : 'light');
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const metrics = useMemo(() => {
    const now = new Date();
    return {
      todo: tasks.filter((t) => t.status === 'PENDING').length,
      doing: tasks.filter((t) => ['IN_PROGRESS', 'IN_REVIEW', 'TESTING'].includes(t.status)).length,
      done: tasks.filter((t) => t.status === 'COMPLETED').length,
      overdue: tasks.filter((t) => t.dueDate && isBefore(parseISO(t.dueDate), now) && t.status !== 'COMPLETED').length,
    };
  }, [tasks]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const created = tasks.filter((t) => new Date(t.createdAt) >= weekAgo).length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED' && new Date(t.updatedAt) >= weekAgo).length;
    const completionRate = created ? Math.round((completed / created) * 100) : completed ? 100 : 0;

    return { created, completed, completionRate };
  }, [tasks]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const inSevenDays = new Date();
    inSevenDays.setDate(now.getDate() + 7);
    return tasks
      .filter((t) => t.dueDate && t.status !== 'COMPLETED')
      .filter((t) => {
        const d = parseISO(t.dueDate as string);
        return d >= now && d <= inSevenDays;
      })
      .sort((a, b) => +new Date(a.dueDate as string) - +new Date(b.dueDate as string))
      .slice(0, 5);
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((t) =>
        [t.title, t.description ?? '', t.tags, t.internalNotes ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (statusFilter !== 'ALL') result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'ALL') result = result.filter((t) => t.priority === priorityFilter);
    if (tagFilter) result = result.filter((t) => t.tags.toLowerCase().includes(tagFilter.toLowerCase()));
    if (dueFilter) result = result.filter((t) => (t.dueDate || '').slice(0, 10) === dueFilter);

    result.sort((a, b) => {
      if (sortBy === 'priority') return priorities.indexOf(b.priority) - priorities.indexOf(a.priority);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return +new Date(a.dueDate) - +new Date(b.dueDate);
    });

    return result;
  }, [tasks, query, statusFilter, priorityFilter, tagFilter, dueFilter, sortBy]);

  const byStatus = (status: TaskStatus) => filtered.filter((t) => t.status === status);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar tarea?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
  }

  async function moveTask(id: string, status: TaskStatus) {
    await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadTasks();
  }

  function dropOn(status: TaskStatus) {
    if (dragId) {
      moveTask(dragId, status);
      setDragId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <header className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">TaskFlow</h1>
              <p className="text-sm text-zinc-500">Gestor de tareas profesional para tu trabajo diario</p>
            </div>
            <div className="flex items-center gap-2">
              {me?.role === 'ADMIN' && (
                <Link href="/admin/users" className="btn-secondary">Usuarios</Link>
              )}
              <button onClick={toggleTheme} className="btn-secondary">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button onClick={logout} className="btn-secondary"><LogOut size={16} /> Salir</button>
              <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary"><Plus size={16} /> Nueva tarea</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Metric label="Pendientes" value={metrics.todo} />
            <Metric label="En curso" value={metrics.doing} />
            <Metric label="Completadas" value={metrics.done} />
            <Metric label="Vencidas" value={metrics.overdue} danger />
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="grid md:grid-cols-5 gap-2">
            <label className="input-wrap md:col-span-2"><Search size={16} /><input placeholder="Buscar tarea..." value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TaskStatus)}>
              <option value="ALL">Todos los estados</option>
              {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | Priority)}>
              <option value="ALL">Todas prioridades</option>
              {priorities.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
            </select>
            <input className="input" type="date" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input className="input flex-1 min-w-44" placeholder="Filtrar por etiqueta" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'priority' | 'dueDate')}>
              <option value="priority">Ordenar por prioridad</option>
              <option value="dueDate">Ordenar por fecha límite</option>
            </select>
            <div className="segmented">
              <button className={clsx(view === 'KANBAN' && 'active')} onClick={() => setView('KANBAN')}>Kanban</button>
              <button className={clsx(view === 'LIST' && 'active')} onClick={() => setView('LIST')}>Lista</button>
              <button className={clsx(view === 'CALENDAR' && 'active')} onClick={() => setView('CALENDAR')}>Calendario</button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 mb-3">Productividad (últimos 7 días)</p>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Creadas" value={weeklyStats.created} />
              <Metric label="Completadas" value={weeklyStats.completed} />
              <Metric label="Rendimiento" value={weeklyStats.completionRate} suffix="%" />
            </div>
            <div className="mt-4 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700" style={{ width: `${Math.max(5, weeklyStats.completionRate)}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500 mb-3">Próximas fechas (7 días)</p>
            <div className="space-y-2">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin vencimientos próximos 🎉</p>
              ) : (
                upcomingDeadlines.map((t) => (
                  <div key={t.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-2">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-zinc-500">{format(parseISO(t.dueDate as string), 'dd/MM/yyyy')}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {loading ? <p>Cargando tareas...</p> : view === 'KANBAN' ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {statuses.map((status) => (
              <div key={status} className="kanban-col" onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(status)}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="kanban-title">{statusLabels[status]}</h3>
                  <span className="kanban-count">{byStatus(status).length}</span>
                </div>
                <div className="space-y-3 min-h-24">
                  {byStatus(status).map((task) => (
                    <TaskCard key={task.id} task={task} onEdit={() => { setEditing(task); setShowForm(true); }} onDelete={() => handleDelete(task.id)} onLogTime={() => setTimeTask(task)} onDragStart={() => setDragId(task.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : view === 'LIST' ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {filtered.map((task) => <TaskRow key={task.id} task={task} onEdit={() => { setEditing(task); setShowForm(true); }} onDelete={() => handleDelete(task.id)} onLogTime={() => setTimeTask(task)} onMove={moveTask} />)}
          </div>
        ) : (
          <MonthlyCalendar
            tasks={filtered}
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth((m) => addMonths(m, -1))}
            onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
            onToday={() => setCalendarMonth(new Date())}
          />
        )}
      </div>

      {showForm && (
        <TaskFormModal
          task={editing}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await loadTasks();
          }}
        />
      )}

      {timeTask && (
        <TimeEntryModal
          task={timeTask}
          onClose={() => setTimeTask(null)}
          onSaved={async () => {
            setTimeTask(null);
            await loadTasks();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, danger = false, suffix = '' }: { label: string; value: number; danger?: boolean; suffix?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/80 dark:bg-zinc-950/60">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={clsx('text-2xl font-bold', danger && 'text-red-500')}>{value}{suffix}</p>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onLogTime, onDragStart }: { task: Task; onEdit: () => void; onDelete: () => void; onLogTime: () => void; onDragStart: () => void }) {
  const overdue = task.dueDate && isBefore(parseISO(task.dueDate), new Date()) && task.status !== 'COMPLETED';
  return (
    <div id={task.id} draggable onDragStart={onDragStart} className={clsx('task-card cursor-grab active:cursor-grabbing', overdue && 'ring-1 ring-red-400')}>
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-semibold leading-tight tracking-tight">{task.title}</h4>
        <span className={clsx('badge', `p-${task.priority.toLowerCase()}`)}>{priorityLabel[task.priority]}</span>
      </div>
      {task.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">{task.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">{task.tags.split(',').filter(Boolean).map((t) => <span key={t} className="tag">#{t.trim()}</span>)}</div>
      <div className="mt-3 text-xs text-zinc-500 space-y-1">
        {typeof task.estimatedMinutes === 'number' && <p>⏱ {task.estimatedMinutes} min</p>}
        {task.dueDate && <p className={clsx(overdue && 'text-red-500 font-semibold')}>Límite: {format(parseISO(task.dueDate), 'dd/MM/yyyy')} {isToday(parseISO(task.dueDate)) && '· hoy'}</p>}
      </div>
      <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 flex gap-2">
        <button className="btn-secondary" onClick={onLogTime}>⏱</button>
        <button className="btn-secondary" onClick={onEdit}><Pencil size={14} /></button>
        <button className="btn-secondary text-red-500" onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function TaskRow({ task, onEdit, onDelete, onLogTime, onMove }: { task: Task; onEdit: () => void; onDelete: () => void; onLogTime: () => void; onMove: (id: string, s: TaskStatus) => void }) {
  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 grid md:grid-cols-6 gap-2 items-center">
      <div className="md:col-span-2"><p className="font-medium">{task.title}</p><p className="text-xs text-zinc-500">{typeof task.estimatedMinutes === 'number' ? `⏱ ${task.estimatedMinutes} min` : 'Sin tiempo estimado'}</p></div>
      <div><span className={clsx('badge', `p-${task.priority.toLowerCase()}`)}>{priorityLabel[task.priority]}</span></div>
      <div className="text-sm">{task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yyyy') : '-'}</div>
      <div>
        <select className="input" value={task.status} onChange={(e) => onMove(task.id, e.target.value as TaskStatus)}>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end"><button className="btn-secondary" onClick={onLogTime}>⏱</button><button className="btn-secondary" onClick={onEdit}><Pencil size={14} /></button><button className="btn-secondary text-red-500" onClick={onDelete}><Trash2 size={14} /></button></div>
    </div>
  );
}

function MonthlyCalendar({
  tasks,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  tasks: Task[];
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const today = new Date();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = days.map((day) => {
    const items = tasks.filter((t) => t.dueDate && format(parseISO(t.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
    return { day, items };
  });

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Calendario mensual · {format(month, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={onPrevMonth}><ChevronLeft size={16} /></button>
          <button className="btn-secondary" onClick={onToday}>Hoy</button>
          <button className="btn-secondary" onClick={onNextMonth}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-zinc-500 mb-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {tasksByDay.map(({ day, items }) => (
          <div key={day.toISOString()} className={clsx('min-h-28 rounded-xl border p-2', isSameMonth(day, today) ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-100 dark:border-zinc-900 opacity-60')}>
            <p className={clsx('text-xs mb-1', isToday(day) && 'font-bold text-indigo-500')}>{format(day, 'd')}</p>
            <div className="space-y-1">
              {items.slice(0, 3).map((t) => (
                <div key={t.id} className={clsx('text-[11px] px-1.5 py-1 rounded-lg truncate', t.status === 'PENDING' && 'bg-zinc-100 text-zinc-700', t.status === 'IN_PROGRESS' && 'bg-zinc-100 text-zinc-700', t.status === 'IN_REVIEW' && 'bg-zinc-100 text-zinc-700', t.status === 'TESTING' && 'bg-zinc-100 text-zinc-700', t.status === 'COMPLETED' && 'bg-zinc-100 text-zinc-700', t.status === 'BLOCKED' && 'bg-zinc-100 text-zinc-700')}>
                  {t.title}
                </div>
              ))}
              {items.length > 3 && <div className="text-[11px] text-zinc-500">+{items.length - 3} más</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeEntryModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('0.5');
  const [note, setNote] = useState('');

  const totalLogged = (task.timeEntries || []).reduce((acc, t) => acc + (t.minutes || 0), 0);
  const totalHours = (totalLogged / 60).toFixed(2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        date,
        minutes: Math.max(1, Math.round(Number(hours) * 60)),
        note,
      }),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 p-4 grid place-items-center z-50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onMouseDown={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-xl font-semibold">Registrar tiempo · {task.title}</h3>
        <p className="text-sm text-zinc-500">Tiempo acumulado: {totalHours} h</p>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <input className="input" type="number" min={0.1} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} required />
        </div>
        <textarea className="input min-h-20" placeholder="Nota opcional" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="max-h-40 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 p-2 text-xs">
          {(task.timeEntries || []).slice(0, 20).map((t) => (
            <div key={t.id} className="py-1 border-b border-zinc-100 dark:border-zinc-800">
              {t.date.slice(0,10)} · {(t.minutes / 60).toFixed(2)} h {t.note ? `· ${t.note}` : ''}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Guardar tiempo</button></div>
      </form>
    </div>
  );
}

function TaskFormModal({ task, onClose, onSaved }: { task: Task | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'MEDIUM',
    dueDate: task?.dueDate?.slice(0, 10) || '',
    status: task?.status || 'PENDING',
    tags: task?.tags || '',
    internalNotes: task?.internalNotes || '',
    estimatedMinutes: task?.estimatedMinutes?.toString() || '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = task ? 'PATCH' : 'POST';
    const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 p-4 grid place-items-center z-50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onMouseDown={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-xl font-semibold">{task ? 'Editar tarea' : 'Nueva tarea'}</h3>
        <input required className="input" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input min-h-20" placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid md:grid-cols-3 gap-2">
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{priorities.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}</select>
          <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>{statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
        </div>
        <input className="input" type="number" min={0} placeholder="Tiempo estimado tarea (min)" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} />
        <input className="input" placeholder="Etiquetas separadas por coma" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />

        <textarea className="input min-h-20" placeholder="Notas internas" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Guardar</button></div>
      </form>
    </div>
  );
}
