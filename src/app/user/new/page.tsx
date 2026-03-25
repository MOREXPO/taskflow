'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UserNewPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'No se pudo crear usuario');
        return;
      }
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Crear usuario</h1>
        <p className="text-zinc-400 text-sm">Alta rápida para Personal Planner</p>
        <input className="input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creando...' : 'Crear usuario'}</button>
      </form>
    </div>
  );
}
