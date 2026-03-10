"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) return setError('Contraseña incorrecta');
    router.push('/');
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h1 className="text-2xl font-semibold">TaskFlow</h1>
        <p className="text-zinc-400 text-sm">Acceso privado</p>
        <input type="email" required className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required className="input" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
