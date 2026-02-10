import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@quarrel/shared';
import { useAuthStore } from '../stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = registerSchema.safeParse({ username, email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/channels/@me');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-[#313338]">
      <form onSubmit={handleSubmit} noValidate className="w-[480px] rounded-md bg-[#2b2d31] p-8">
        <h1 className="mb-5 text-center text-2xl font-semibold text-white">Create an account</h1>

        {error && <div className="mb-4 rounded bg-[#f23f43]/10 p-3 text-sm text-[#f23f43]">{error}</div>}

        <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
          Email
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-auto rounded border-[#3f4147] bg-[#1e1f22] p-2.5 text-base font-normal text-[#dbdee1] shadow-none normal-case focus-visible:border-[#5865f2] focus-visible:ring-0"
            required
          />
        </label>

        <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
          Display Name
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 h-auto rounded border-[#3f4147] bg-[#1e1f22] p-2.5 text-base font-normal text-[#dbdee1] shadow-none normal-case focus-visible:border-[#5865f2] focus-visible:ring-0"
            required
          />
        </label>

        <label className="mb-5 block text-xs font-bold uppercase text-[#b5bac1]">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-auto rounded border-[#3f4147] bg-[#1e1f22] p-2.5 text-base font-normal text-[#dbdee1] shadow-none normal-case focus-visible:border-[#5865f2] focus-visible:ring-0"
            required
          />
        </label>

        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#5865f2] p-2.5 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Continue'}
        </Button>

        <p className="mt-3 text-sm text-[#949ba4]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00a8fc] hover:underline">
            Log In
          </Link>
        </p>
      </form>
    </div>
  );
}
