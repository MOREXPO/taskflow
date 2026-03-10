"use client";

import { useEffect, useState } from 'react';

type User = { id: string; email: string; role: 'ADMIN' | 'USER'; createdAt: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');

  async function load() {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (res.ok) {
      setEmail('');
      setPassword('');
      setRole('USER');
      await load();
    } else {
      alert('No se pudo crear usuario');
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar usuario?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  async function toggleRole(u: User) {
    const nextRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) await load();
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">Panel Admin · Usuarios</h1>

        <form onSubmit={createUser} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 grid md:grid-cols-4 gap-2">
          <input className="input" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button className="btn-primary">Crear usuario</button>
        </form>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{u.email}</p>
                <p className="text-xs text-zinc-500">{u.role}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => toggleRole(u)}>Cambiar rol</button>
                <button className="btn-secondary text-red-500" onClick={() => remove(u.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
