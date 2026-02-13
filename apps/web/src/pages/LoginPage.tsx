import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '@quarrel/shared';
import { useAuthStore } from '../stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/channels/@me');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-bg-primary px-4">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-[480px] rounded-md bg-bg-secondary p-6 md:p-8">
        <h1 className="mb-2 text-center text-2xl font-semibold text-white">Welcome back!</h1>
        <p className="mb-5 text-center text-text-muted">We're so excited to see you again!</p>

        {error && <div className="mb-4 rounded bg-red/10 p-3 text-sm text-red">{error}</div>}

        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Email
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-auto rounded border-bg-modifier-hover bg-bg-tertiary p-2.5 text-base font-normal text-text-normal shadow-none normal-case focus-visible:border-brand focus-visible:ring-0"
            required
          />
        </label>

        <label className="mb-5 block text-xs font-bold uppercase text-text-label">
          Password
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-auto rounded border-bg-modifier-hover bg-bg-tertiary p-2.5 text-base font-normal text-text-normal shadow-none normal-case focus-visible:border-brand focus-visible:ring-0"
            required
          />
        </label>

        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand p-2.5 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </Button>

        <p className="mt-3 text-sm text-text-muted">
          Need an account?{' '}
          <Link to="/register" className="text-text-link hover:underline">
            Register
          </Link>
        </p>
      </form>

      <p className="absolute bottom-4 text-center text-xs text-text-muted max-w-md px-4">
        Quarrel is an independent, open-source project and is not affiliated with or endorsed by Discord Inc.{' '}
        <a
          href="https://github.com/jlgrimes/quarrel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-link hover:underline"
        >
          View source on GitHub
        </a>
      </p>
    </div>
  );
}
