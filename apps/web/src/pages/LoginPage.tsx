import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '@quarrel/shared';
import { useAuthStore } from '../stores/authStore';

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
    <div className="flex h-full items-center justify-center bg-[#313338]">
      <form onSubmit={handleSubmit} noValidate className="w-[480px] rounded-md bg-[#2b2d31] p-8">
        <h1 className="mb-2 text-center text-2xl font-semibold text-white">Welcome back!</h1>
        <p className="mb-5 text-center text-[#949ba4]">We're so excited to see you again!</p>

        {error && <div className="mb-4 rounded bg-[#f23f43]/10 p-3 text-sm text-[#f23f43]">{error}</div>}

        <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 block w-full rounded bg-[#1e1f22] border border-[#3f4147] p-2.5 text-base font-normal text-[#dbdee1] outline-none focus:border-[#5865f2] normal-case"
            required
          />
        </label>

        <label className="mb-5 block text-xs font-bold uppercase text-[#b5bac1]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 block w-full rounded bg-[#1e1f22] border border-[#3f4147] p-2.5 text-base font-normal text-[#dbdee1] outline-none focus:border-[#5865f2] normal-case"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <p className="mt-3 text-sm text-[#949ba4]">
          Need an account?{' '}
          <Link to="/register" className="text-[#00a8fc] hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
