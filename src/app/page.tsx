"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import clsx from 'clsx';
import { addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { Task, TaskStatus, Priority } from '@/lib/types';
import { Moon, Sun, Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

const statuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DOCUMENTING', 'COMPLETED', 'BLOCKED'];

const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En desarrollo',
  IN_REVIEW: 'En revisión',
  TESTING: 'Testing',
  DOCUMENTING: 'Documentando',
  COMPLETED: 'Completado',
  BLOCKED: 'Bloqueado',
};

const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const ARCHIVE_MARKER = '__ARCHIVED__';

function getArchiveDate(task: Task): Date {
  const notes = task.internalNotes || '';
  const line = notes.split('\n').find((l) => l.startsWith(`${ARCHIVE_MARKER}:`));
  if (line) {
    const raw = line.slice(`${ARCHIVE_MARKER}:`.length).trim();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const auto = new Date(new Date(task.updatedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  return auto;
}

function hasManualArchive(task: Task) {
  return (task.internalNotes || '').includes(`${ARCHIVE_MARKER}:`);
}

function ymd(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

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
  const [view, setView] = useState<'KANBAN' | 'LIST' | 'CALENDAR' | 'HISTORY'>('KANBAN');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyCreatedDate, setHistoryCreatedDate] = useState('');
  const [historyArchivedDate, setHistoryArchivedDate] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('priority');
  const [isDark, setIsDark] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [timeTask, setTimeTask] = useState<Task | null>(null);
  const [me, setMe] = useState<{ email: string; role: 'ADMIN' | 'USER' } | null>(null);
  const [personalMode, setPersonalMode] = useState(false);
  const [personalTab, setPersonalTab] = useState<'TASKS' | 'ITINERARIES'>('TASKS');
  const [itineraries, setItineraries] = useState<Array<{ id: string; title: string; from: string; to: string; notes: string; items: string[]; destinations: Array<{ id: string; name: string; from: string; to: string }>; dayActivities: Record<string, string[]> }>>([]);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [itTitle, setItTitle] = useState('');
  const [itFrom, setItFrom] = useState('');
  const [itTo, setItTo] = useState('');
  const [itNotes, setItNotes] = useState('');
  const [itItems, setItItems] = useState('');
  const [destName, setDestName] = useState('');
  const [destFrom, setDestFrom] = useState('');
  const [destTo, setDestTo] = useState('');
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState('');
  const [dayActivityInput, setDayActivityInput] = useState('');

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

    if (typeof window !== 'undefined') {
      const isPersonal = window.location.hostname === 'personal.iamoex.com';
      setPersonalMode(isPersonal);
      if (isPersonal) {
        try {
          const raw = localStorage.getItem('personal_itineraries');
          const parsed = raw ? JSON.parse(raw) : [];
          const normalized = Array.isArray(parsed)
            ? parsed.map((it: any) => ({
                ...it,
                destinations: Array.isArray(it.destinations) ? it.destinations : [],
                dayActivities: it.dayActivities && typeof it.dayActivities === 'object' ? it.dayActivities : {},
              }))
            : [];
          setItineraries(normalized);
        } catch {
          setItineraries([]);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!personalMode) return;
    localStorage.setItem('personal_itineraries', JSON.stringify(itineraries));
  }, [personalMode, itineraries]);

  useEffect(() => {
    if (personalMode) document.title = 'Personal Planner';
  }, [personalMode]);

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
      doing: tasks.filter((t) => ['IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DOCUMENTING'].includes(t.status)).length,
      done: tasks.filter((t) => t.status === 'COMPLETED').length,
      blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
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

  const historicalCompleted = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => {
      if (t.status !== 'COMPLETED') return false;
      if (hasManualArchive(t)) return true;
      return getArchiveDate(t).getTime() <= now;
    });
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const archivedIds = new Set(historicalCompleted.map((t) => t.id));
    return filtered.filter((t) => !archivedIds.has(t.id));
  }, [filtered, historicalCompleted]);

  const filteredHistorical = useMemo(() => {
    let result = [...historicalCompleted];
    if (historyQuery) {
      const q = historyQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (historyCreatedDate) {
      result = result.filter((t) => ymd(new Date(t.createdAt)) === historyCreatedDate);
    }
    if (historyArchivedDate) {
      result = result.filter((t) => ymd(getArchiveDate(t)) === historyArchivedDate);
    }
    result.sort((a, b) => +getArchiveDate(b) - +getArchiveDate(a));
    return result;
  }, [historicalCompleted, historyQuery, historyCreatedDate, historyArchivedDate]);

  const selectedItinerary = useMemo(
    () => itineraries.find((i) => i.id === selectedItineraryId) || null,
    [itineraries, selectedItineraryId]
  );

  const personalSections = useMemo(() => {
    const now = new Date();
    const todayYmd = format(now, 'yyyy-MM-dd');
    const active = visibleTasks.filter((t) => t.status !== 'COMPLETED');

    const today = active.filter((t) => (t.dueDate || '').slice(0, 10) === todayYmd);
    const upcoming = active
      .filter((t) => t.dueDate && (t.dueDate || '').slice(0, 10) > todayYmd)
      .sort((a, b) => +new Date(a.dueDate as string) - +new Date(b.dueDate as string));
    const noDate = active.filter((t) => !t.dueDate);
    const recentDone = visibleTasks
      .filter((t) => t.status === 'COMPLETED')
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

    return { today, upcoming, noDate, recentDone };
  }, [visibleTasks]);

  const byStatus = (status: TaskStatus) => visibleTasks.filter((t) => t.status === status);

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

  async function archiveTask(task: Task) {
    if (task.status !== 'COMPLETED') return;
    const notes = task.internalNotes || '';
    if (hasManualArchive(task)) return;
    const nextNotes = [notes.trim(), `${ARCHIVE_MARKER}:${new Date().toISOString()}`].filter(Boolean).join('\n');
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        tags: task.tags,
        requester: task.requester,
        internalNotes: nextNotes,
      }),
    });
    await loadTasks();
  }

  async function recoverTask(task: Task) {
    const notes = (task.internalNotes || '')
      .split('\n')
      .filter((l) => !l.startsWith(ARCHIVE_MARKER))
      .join('\n')
      .trim();
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        status: 'IN_PROGRESS',
        tags: task.tags,
        requester: task.requester,
        internalNotes: notes || null,
      }),
    });
    await loadTasks();
  }

  function dropOn(status: TaskStatus) {
    if (dragId) {
      moveTask(dragId, status);
      setDragId(null);
    }
  }

  async function deleteTimeEntry(id: string) {
    if (!confirm('¿Borrar registro de horas?')) return;
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    await loadTasks();
  }

  function createItinerary(e: React.FormEvent) {
    e.preventDefault();
    if (!itTitle.trim()) return;
    const itinerary = {
      id: crypto.randomUUID(),
      title: itTitle.trim(),
      from: itFrom,
      to: itTo,
      notes: itNotes.trim(),
      items: itItems.split('\n').map((x) => x.trim()).filter(Boolean),
      destinations: [],
      dayActivities: {},
    };
    setItineraries((prev) => [itinerary, ...prev]);
    setItTitle('');
    setItFrom('');
    setItTo('');
    setItNotes('');
    setItItems('');
  }

  function deleteItinerary(id: string) {
    if (!confirm('¿Eliminar itinerario?')) return;
    setItineraries((prev) => prev.filter((i) => i.id !== id));
  }

  function addDestination(itineraryId: string) {
    if (!destName.trim() || !destFrom || !destTo) return;

    setItineraries((prev) =>
      prev.map((it) =>
        it.id === itineraryId
          ? {
              ...it,
              destinations: [
                ...it.destinations,
                { id: crypto.randomUUID(), name: destName.trim(), from: destFrom, to: destTo },
              ],
            }
          : it
      )
    );

    setDestName('');
    setDestFrom('');
    setDestTo('');
  }

  function openDayPlanner(day: string) {
    setDayModalDate(day);
    setDayActivityInput('');
    setDayModalOpen(true);
  }

  function addDayActivity(itineraryId: string, day: string, activity: string) {
    const value = activity.trim();
    if (!value) return;
    setItineraries((prev) =>
      prev.map((it) => {
        if (it.id !== itineraryId) return it;
        const current = it.dayActivities?.[day] || [];
        return {
          ...it,
          dayActivities: {
            ...(it.dayActivities || {}),
            [day]: [...current, value],
          },
        };
      })
    );
  }

  function removeDayActivity(itineraryId: string, day: string, idx: number) {
    setItineraries((prev) =>
      prev.map((it) => {
        if (it.id !== itineraryId) return it;
        const current = [...(it.dayActivities?.[day] || [])];
        current.splice(idx, 1);
        return {
          ...it,
          dayActivities: {
            ...(it.dayActivities || {}),
            [day]: current,
          },
        };
      })
    );
  }

  function moveDayActivity(itineraryId: string, day: string, idx: number, direction: 'up' | 'down') {
    setItineraries((prev) =>
      prev.map((it) => {
        if (it.id !== itineraryId) return it;
        const arr = [...(it.dayActivities?.[day] || [])];
        const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= arr.length) return it;
        const tmp = arr[idx];
        arr[idx] = arr[nextIdx];
        arr[nextIdx] = tmp;
        return {
          ...it,
          dayActivities: {
            ...(it.dayActivities || {}),
            [day]: arr,
          },
        };
      })
    );
  }

  if (personalMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-black text-white">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
          <header className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold">Personal Planner</h1>
                <p className="text-sm text-slate-300">Rutinas, recordatorios y tareas del día a día</p>
              </div>
              <div className="flex items-center gap-2">
                {me?.role === 'ADMIN' && (
                  <Link href="/admin/users" className="btn-secondary">Usuarios</Link>
                )}
                <button onClick={toggleTheme} className="btn-secondary">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
                <button onClick={logout} className="btn-secondary"><LogOut size={16} /> Salir</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {personalTab === 'TASKS' ? (
                <>
                  <Metric label="Hoy" value={personalSections.today.length} />
                  <Metric label="Próximas" value={personalSections.upcoming.length} />
                  <Metric label="Sin fecha" value={personalSections.noDate.length} />
                  <Metric label="Completadas" value={personalSections.recentDone.length} />
                </>
              ) : (
                <>
                  <Metric label="Itinerarios" value={itineraries.length} />
                  <Metric label="Destinos" value={itineraries.reduce((n, it) => n + (it.destinations?.length || 0), 0)} />
                  <Metric label="Actividades" value={itineraries.reduce((n, it) => n + Object.values(it.dayActivities || {}).reduce((a, arr) => a + arr.length, 0), 0)} />
                  <Metric label="Viaje activo" value={selectedItinerary ? 1 : 0} />
                </>
              )}
            </div>
          </header>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <label className="input-wrap"><Search size={16} /><input placeholder="Buscar por título o contenido..." value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </section>

          <div className="segmented w-fit">
            <button className={clsx(personalTab === 'TASKS' && 'active')} onClick={() => setPersonalTab('TASKS')}>Tareas</button>
            <button className={clsx(personalTab === 'ITINERARIES' && 'active')} onClick={() => setPersonalTab('ITINERARIES')}>Itinerarios</button>
          </div>

          {personalTab === 'TASKS' ? (
            <>
              <PersonalSection title="Hoy" tasks={personalSections.today} onEdit={(t) => { setEditing(t); setShowForm(true); }} onDelete={handleDelete} onComplete={(id) => moveTask(id, 'COMPLETED')} />
              <PersonalSection title="Recordatorios próximos" tasks={personalSections.upcoming} onEdit={(t) => { setEditing(t); setShowForm(true); }} onDelete={handleDelete} onComplete={(id) => moveTask(id, 'COMPLETED')} />
              <PersonalSection title="Pendientes sin fecha" tasks={personalSections.noDate} onEdit={(t) => { setEditing(t); setShowForm(true); }} onDelete={handleDelete} onComplete={(id) => moveTask(id, 'COMPLETED')} />
              <PersonalSection title="Completadas recientes" tasks={personalSections.recentDone} onEdit={(t) => { setEditing(t); setShowForm(true); }} onDelete={handleDelete} onComplete={(id) => moveTask(id, 'COMPLETED')} />

              {historicalCompleted.length > 0 && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                  <h3 className="font-semibold">Histórico</h3>
                  <div className="grid md:grid-cols-3 gap-2">
                    <input className="input" placeholder="Buscar por título..." value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
                    <input className="input" type="date" value={historyCreatedDate} onChange={(e) => setHistoryCreatedDate(e.target.value)} />
                    <input className="input" type="date" value={historyArchivedDate} onChange={(e) => setHistoryArchivedDate(e.target.value)} />
                  </div>
                  <div className="space-y-2 max-h-[24rem] overflow-auto">
                    {filteredHistorical.map((t) => (
                      <div key={t.id} className="rounded-xl border border-slate-800 p-3 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-slate-400">Creada: {format(new Date(t.createdAt), 'dd/MM/yyyy')}</p>
                          <p className="text-xs text-slate-400">Paso a histórico: {format(getArchiveDate(t), 'dd/MM/yyyy')}</p>
                        </div>
                        <button className="btn-secondary" onClick={() => recoverTask(t)}>Recuperar</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <h3 className="font-semibold">Nuevo viaje</h3>
                <form onSubmit={createItinerary} className="grid md:grid-cols-2 gap-2">
                  <input className="input" placeholder="Título del viaje" value={itTitle} onChange={(e) => setItTitle(e.target.value)} required />
                  <input className="input" placeholder="Descripción" value={itNotes} onChange={(e) => setItNotes(e.target.value)} />
                  <input className="input" type="date" value={itFrom} onChange={(e) => setItFrom(e.target.value)} />
                  <input className="input" type="date" value={itTo} onChange={(e) => setItTo(e.target.value)} />
                  <textarea className="input md:col-span-2 min-h-24" placeholder="Plan diario (una línea por punto: vuelos, hotel, visitas, reuniones...)" value={itItems} onChange={(e) => setItItems(e.target.value)} />
                  <button className="btn-primary md:col-span-2">Guardar itinerario</button>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <h3 className="font-semibold">Itinerarios guardados</h3>
                {itineraries.length === 0 ? (
                  <p className="text-sm text-slate-400">No hay itinerarios todavía.</p>
                ) : !selectedItinerary ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {itineraries.map((it) => (
                      <button key={it.id} className="text-left rounded-xl border border-slate-800 p-3 hover:border-cyan-500/50 transition" onClick={() => setSelectedItineraryId(it.id)}>
                        <p className="font-medium">{it.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{it.from || '-'} → {it.to || '-'}</p>
                        <p className="text-xs text-slate-500 mt-1">{it.destinations.length} destinos</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <button className="btn-secondary" onClick={() => setSelectedItineraryId(null)}>← Volver a itinerarios</button>
                      <button className="btn-secondary text-red-400" onClick={() => { deleteItinerary(selectedItinerary.id); setSelectedItineraryId(null); }}>Eliminar</button>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-3 space-y-2">
                      <p className="font-medium">{selectedItinerary.title}</p>
                      <p className="text-xs text-slate-400">{selectedItinerary.from || '-'} → {selectedItinerary.to || '-'}</p>
                      {selectedItinerary.notes && <p className="text-sm text-slate-300">{selectedItinerary.notes}</p>}

                      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
                        <p className="text-sm font-medium">Añadir destino</p>
                        <div className="grid md:grid-cols-3 gap-2">
                          <input className="input" placeholder="Destino" value={destName} onChange={(e) => setDestName(e.target.value)} />
                          <input className="input" type="date" value={destFrom} onChange={(e) => setDestFrom(e.target.value)} />
                          <input className="input" type="date" value={destTo} onChange={(e) => setDestTo(e.target.value)} />
                        </div>
                        <button className="btn-secondary" onClick={() => addDestination(selectedItinerary.id)}>Guardar destino</button>
                      </div>

                      {selectedItinerary.destinations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Destinos</p>
                          <div className="space-y-1">
                            {selectedItinerary.destinations.map((d) => (
                              <p key={d.id} className="text-sm text-slate-200">• {d.name} — {d.from} → {d.to}</p>
                            ))}
                          </div>
                          <ItineraryCalendar
                            from={selectedItinerary.from}
                            to={selectedItinerary.to}
                            destinations={selectedItinerary.destinations}
                            dayActivities={selectedItinerary.dayActivities || {}}
                            onDayClick={(day) => openDayPlanner(day)}
                          />
                        </div>
                      )}

                      {selectedItinerary.items.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-slate-200 space-y-1">
                          {selectedItinerary.items.map((line, idx) => <li key={idx}>{line}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {dayModalOpen && selectedItinerary && (
          <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setDayModalOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Actividades · {dayModalDate}</h3>
                <button className="btn-secondary" onClick={() => setDayModalOpen(false)}>Cerrar</button>
              </div>

              <div className="flex gap-2">
                <input className="input" placeholder="Nueva actividad" value={dayActivityInput} onChange={(e) => setDayActivityInput(e.target.value)} />
                <button
                  className="btn-primary"
                  onClick={() => {
                    addDayActivity(selectedItinerary.id, dayModalDate, dayActivityInput);
                    setDayActivityInput('');
                  }}
                >
                  Añadir
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto">
                {(selectedItinerary.dayActivities?.[dayModalDate] || []).length === 0 ? (
                  <p className="text-sm text-slate-400">Sin actividades para este día.</p>
                ) : (
                  (selectedItinerary.dayActivities?.[dayModalDate] || []).map((a, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-700 p-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-slate-100">{idx + 1}. {a}</p>
                      <div className="flex gap-1">
                        <button className="btn-secondary" onClick={() => moveDayActivity(selectedItinerary.id, dayModalDate, idx, 'up')}>↑</button>
                        <button className="btn-secondary" onClick={() => moveDayActivity(selectedItinerary.id, dayModalDate, idx, 'down')}>↓</button>
                        <button className="btn-secondary text-red-400" onClick={() => removeDayActivity(selectedItinerary.id, dayModalDate, idx)}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <TaskFormModal
            personalMode
            task={editing}
            onClose={() => setShowForm(false)}
            onSaved={async () => {
              setShowForm(false);
              setEditing(null);
              await loadTasks();
            }}
          />
        )}


      </div>
    );
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

            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Metric label="Pendientes" value={metrics.todo} />
            <Metric label="En curso" value={metrics.doing} />
            <Metric label="Bloqueadas" value={metrics.blocked} />
            <Metric label="Completadas" value={metrics.done} />
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
              <button className={clsx(view === 'HISTORY' && 'active')} onClick={() => setView('HISTORY')}>Histórico</button>
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
                    <TaskCard key={task.id} task={task} onEdit={() => { setEditing(task); setShowForm(true); }} onDelete={() => handleDelete(task.id)} onLogTime={() => setTimeTask(task)} onDragStart={() => setDragId(task.id)} onArchive={() => archiveTask(task)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : view === 'LIST' ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {visibleTasks.map((task) => <TaskRow key={task.id} task={task} onEdit={() => { setEditing(task); setShowForm(true); }} onDelete={() => handleDelete(task.id)} onLogTime={() => setTimeTask(task)} onMove={moveTask} onArchive={() => archiveTask(task)} />)}
          </div>
        ) : view === 'CALENDAR' ? (
          <MonthlyCalendar
            tasks={visibleTasks}
            month={calendarMonth}
            mode={calendarMode}
            onModeChange={setCalendarMode}
            onPrevMonth={() => setCalendarMonth((m) => (calendarMode === 'MONTH' ? addMonths(m, -1) : addWeeks(m, -1)))}
            onNextMonth={() => setCalendarMonth((m) => (calendarMode === 'MONTH' ? addMonths(m, 1) : addWeeks(m, 1)))}
            onToday={() => setCalendarMonth(new Date())}
            onDeleteTimeEntry={deleteTimeEntry}
          />
        ) : (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Histórico de tareas completadas (+7 días)</h3>
              <span className="text-xs text-zinc-500">{filteredHistorical.length} tareas</span>
            </div>

            <div className="grid md:grid-cols-3 gap-2">
              <input className="input" placeholder="Buscar por título..." value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
              <input className="input" type="date" title="Filtrar por fecha de creación" value={historyCreatedDate} onChange={(e) => setHistoryCreatedDate(e.target.value)} />
              <input className="input" type="date" title="Filtrar por fecha de paso a histórico" value={historyArchivedDate} onChange={(e) => setHistoryArchivedDate(e.target.value)} />
            </div>

            <div className="space-y-2 max-h-[28rem] overflow-auto pr-1">
              {filteredHistorical.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin tareas en histórico para ese filtro.</p>
              ) : (
                filteredHistorical.map((t) => (
                  <div key={t.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-zinc-500">Creada: {format(new Date(t.createdAt), 'dd/MM/yyyy')}</p>
                      <p className="text-xs text-zinc-500">Paso a histórico: {format(getArchiveDate(t), 'dd/MM/yyyy')}</p>
                    </div>
                    <button className="btn-secondary" onClick={() => recoverTask(t)}>Recuperar</button>
                  </div>
                ))
              )}
            </div>
          </section>
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

function ItineraryCalendar({
  from,
  to,
  destinations,
  dayActivities,
  onDayClick,
}: {
  from: string;
  to: string;
  destinations: Array<{ id: string; name: string; from: string; to: string }>;
  dayActivities: Record<string, string[]>;
  onDayClick: (day: string) => void;
}) {
  const base = from ? parseISO(from) : new Date();
  const end = to ? parseISO(to) : endOfMonth(base);
  const start = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  const finish = endOfWeek(endOfMonth(end), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: finish });

  function labelsFor(day: Date) {
    const y = format(day, 'yyyy-MM-dd');
    return destinations.filter((d) => d.from <= y && y <= d.to).map((d) => d.name);
  }

  return (
    <div className="rounded-xl border border-slate-800 p-2">
      <p className="text-xs text-slate-400 mb-2">Calendario visual</p>
      <div className="grid grid-cols-7 gap-1 text-[11px]">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} className="text-center text-slate-500">{d}</div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, base);
          const labels = labelsFor(day);
          const dayKey = format(day, 'yyyy-MM-dd');
          const acts = dayActivities?.[dayKey] || [];
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onDayClick(dayKey)}
              className={clsx('rounded px-1 py-1 min-h-16 border text-left', inMonth ? 'border-slate-800 hover:border-cyan-600/60' : 'border-slate-900 opacity-40')}
            >
              <p className="text-[10px]">{format(day, 'd')}</p>
              {labels.slice(0, 2).map((lbl, idx) => (
                <p key={idx} className="text-[9px] text-cyan-300 truncate">{lbl}</p>
              ))}
              {labels.length > 2 && <p className="text-[9px] text-slate-400">+{labels.length - 2} destinos</p>}
              {acts.slice(0, 2).map((a, idx) => (
                <p key={idx} className="text-[9px] text-emerald-300 truncate">• {a}</p>
              ))}
              {acts.length > 2 && <p className="text-[9px] text-slate-400">+{acts.length - 2} actividades</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PersonalSection({
  title,
  tasks,
  onEdit,
  onDelete,
  onComplete,
}: {
  title: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-slate-400">{tasks.length} tareas</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">Sin tareas en este apartado.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{task.title}</p>
                {task.dueDate && <p className="text-xs text-slate-400">Recordatorio: {format(parseISO(task.dueDate), 'dd/MM/yyyy')}</p>}
                {task.status === 'COMPLETED' && <p className="text-xs text-emerald-300">Completada: {format(new Date(task.updatedAt), 'dd/MM/yyyy')}</p>}
              </div>
              <div className="flex gap-2">
                {task.status !== 'COMPLETED' && <button className="btn-secondary" onClick={() => onComplete(task.id)}>Completar</button>}
                <button className="btn-secondary" onClick={() => onEdit(task)}><Pencil size={14} /></button>
                <button className="btn-secondary text-red-500" onClick={() => onDelete(task.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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

function TaskCard({ task, onEdit, onDelete, onLogTime, onDragStart, onArchive }: { task: Task; onEdit: () => void; onDelete: () => void; onLogTime: () => void; onDragStart: () => void; onArchive: () => void }) {
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
        {task.dueDate && <p className={clsx(overdue && 'text-red-500 font-semibold')}>Límite: {format(parseISO(task.dueDate), 'dd/MM/yyyy')} {isToday(parseISO(task.dueDate)) && '· hoy'}</p>}
      </div>
      <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 flex gap-2 flex-wrap">
        <button className="btn-secondary" onClick={onLogTime}>⏱</button>
        {task.status === 'COMPLETED' && !hasManualArchive(task) && (
          <button className="btn-secondary" onClick={onArchive}>Archivar</button>
        )}
        <button className="btn-secondary" onClick={onEdit}><Pencil size={14} /></button>
        <button className="btn-secondary text-red-500" onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function TaskRow({ task, onEdit, onDelete, onLogTime, onMove, onArchive }: { task: Task; onEdit: () => void; onDelete: () => void; onLogTime: () => void; onMove: (id: string, s: TaskStatus) => void; onArchive: () => void }) {
  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 grid md:grid-cols-6 gap-2 items-center">
      <div className="md:col-span-2"><p className="font-medium">{task.title}</p></div>
      <div><span className={clsx('badge', `p-${task.priority.toLowerCase()}`)}>{priorityLabel[task.priority]}</span></div>
      <div className="text-sm">{task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yyyy') : '-'}</div>
      <div>
        <select className="input" value={task.status} onChange={(e) => onMove(task.id, e.target.value as TaskStatus)}>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end flex-wrap"><button className="btn-secondary" onClick={onLogTime}>⏱</button>{task.status === 'COMPLETED' && !hasManualArchive(task) && (<button className="btn-secondary" onClick={onArchive}>Archivar</button>)}<button className="btn-secondary" onClick={onEdit}><Pencil size={14} /></button><button className="btn-secondary text-red-500" onClick={onDelete}><Trash2 size={14} /></button></div>
    </div>
  );
}

function MonthlyCalendar({
  tasks,
  month,
  mode,
  onModeChange,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDeleteTimeEntry,
}: {
  tasks: Task[];
  month: Date;
  mode: 'MONTH' | 'WEEK';
  onModeChange: (m: 'MONTH' | 'WEEK') => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDeleteTimeEntry: (id: string) => void;
}) {
  const today = new Date();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekStart = startOfWeek(month, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(month, { weekStartsOn: 1 });
  const gridStart = mode === 'MONTH' ? startOfWeek(monthStart, { weekStartsOn: 1 }) : weekStart;
  const gridEnd = mode === 'MONTH' ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : weekEnd;
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = days.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const items = tasks.filter((t) => t.dueDate && format(parseISO(t.dueDate), 'yyyy-MM-dd') === key);
    const entries = tasks.flatMap((t) =>
      (t.timeEntries || [])
        .filter((e) => e.date.slice(0, 10) === key)
        .map((e) => ({ ...e, taskTitle: t.title }))
    );
    const totalHours = entries.reduce((acc, e) => acc + e.minutes, 0) / 60;
    return { day, items, entries, totalHours };
  });

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">
          {mode === 'MONTH' ? `Calendario mensual · ${format(month, 'MMMM yyyy')}` : `Calendario semanal · ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`}
        </h3>
        <div className="flex items-center gap-2">
          <div className="segmented">
            <button className={clsx(mode === 'MONTH' && 'active')} onClick={() => onModeChange('MONTH')}>Mes</button>
            <button className={clsx(mode === 'WEEK' && 'active')} onClick={() => onModeChange('WEEK')}>Semana</button>
          </div>
          <button className="btn-secondary" onClick={onPrevMonth}><ChevronLeft size={16} /></button>
          <button className="btn-secondary" onClick={onToday}>Hoy</button>
          <button className="btn-secondary" onClick={onNextMonth}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-zinc-500 mb-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {tasksByDay.map(({ day, items, entries, totalHours }) => (
          <div key={day.toISOString()} className={clsx('min-h-36 rounded-xl border p-2', mode === 'WEEK' || isSameMonth(day, month) ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-100 dark:border-zinc-900 opacity-60')}>
            <p className={clsx('text-xs mb-1', isToday(day) && 'font-bold text-indigo-500')}>{format(day, 'd')}</p>
            {totalHours > 0 && <p className="text-[11px] text-indigo-600 mb-1">⏱ {totalHours.toFixed(2)} h</p>}
            <div className="space-y-1">
              {items.slice(0, 2).map((t) => (
                <div
                  key={t.id}
                  title={t.title}
                  className={clsx('text-[11px] px-1.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 w-full text-left whitespace-normal break-words leading-tight')}
                >
                  {t.title}
                </div>
              ))}
              {entries.slice(0, 2).map((e) => (
                <div key={e.id} className="text-[11px] px-1.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-between gap-1">
                  <span className="truncate">{e.taskTitle} · {(e.minutes / 60).toFixed(1)}h</span>
                  <button className="text-red-500" onClick={() => onDeleteTimeEntry(e.id)}>x</button>
                </div>
              ))}
              {(items.length > 2 || entries.length > 2) && <div className="text-[11px] text-zinc-500">+más</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeEntryModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [hours, setHours] = useState('0.5');
  const [note, setNote] = useState('');

  const totalLogged = (task.timeEntries || []).reduce((acc, t) => acc + (t.minutes || 0), 0);
  const totalHours = (totalLogged / 60).toFixed(2);

  function getDatesInRange(start: string, end: string) {
    const out: string[] = [];
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (e < s) return out;
    const cur = new Date(s);
    while (cur <= e) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = Math.max(1, Math.round(Number(hours) * 60));
    const dates = mode === 'SINGLE' ? [date] : getDatesInRange(startDate, endDate);

    if (!dates.length) {
      alert('Rango de fechas no válido');
      return;
    }

    await Promise.all(
      dates.map((d) =>
        fetch('/api/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            date: d,
            minutes,
            note,
          }),
        })
      )
    );

    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 p-4 grid place-items-center z-50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onMouseDown={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
        <h3 className="text-xl font-semibold">Registrar tiempo · {task.title}</h3>
        <p className="text-sm text-zinc-500">Tiempo acumulado: {totalHours} h</p>

        <div className="flex gap-2">
          <button type="button" className={clsx('btn-secondary', mode === 'SINGLE' && 'ring-2 ring-indigo-400')} onClick={() => setMode('SINGLE')}>Día</button>
          <button type="button" className={clsx('btn-secondary', mode === 'RANGE' && 'ring-2 ring-indigo-400')} onClick={() => setMode('RANGE')}>Rango</button>
        </div>

        {mode === 'SINGLE' ? (
          <div className="grid md:grid-cols-3 gap-2">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <input className="input" type="number" min={0.1} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} required />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-2">
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            <input className="input" type="number" min={0.1} step={0.1} value={hours} onChange={(e) => setHours(e.target.value)} required />
          </div>
        )}
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

function TaskFormModal({ personalMode = false, task, onClose, onSaved }: { personalMode?: boolean; task: Task | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'MEDIUM',
    dueDate: task?.dueDate?.slice(0, 10) || '',
    status: task?.status || 'PENDING',
    tags: task?.tags || '',
    internalNotes: task?.internalNotes || '',
  });

  function normalizePersonalDate(raw: string) {
    const t = raw.trim();
    if (!t) return '';
    const m = t.match(/^(\d{1,2})[\s/\-.](\d{1,2})[\s/\-.](\d{4})$/);
    if (!m) return t;
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = task ? 'PATCH' : 'POST';
    const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        dueDate: personalMode ? normalizePersonalDate(form.dueDate) : form.dueDate,
        priority: personalMode ? 'MEDIUM' : form.priority,
        status: personalMode ? (task?.status ?? 'PENDING') : form.status,
        tags: personalMode ? [] : form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        internalNotes: personalMode ? '' : form.internalNotes,
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
        {personalMode ? (
          <div className="grid md:grid-cols-1 gap-2">
            <input className="input" placeholder="DD MM AAAA" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-2">
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{priorities.map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}</select>
              <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>{statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
            </div>
            <input className="input" placeholder="Etiquetas separadas por coma" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <textarea className="input min-h-20" placeholder="Notas internas" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
          </>
        )}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary">Guardar</button></div>
      </form>
    </div>
  );
}
