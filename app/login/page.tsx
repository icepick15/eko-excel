'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';


const DEMO_ACCOUNTS = [
  { phone: '08012345678', name: 'Mrs. Adaeze Okonkwo', role: 'Teacher' },
  { phone: '08034567890', name: 'Mr. Emmanuel Chukwu', role: 'Head Teacher' },
  { phone: '08045678901', name: 'Dr. Fatima Sule', role: 'District Officer' },
  { phone: '08056789012', name: 'Hon. Gbenga Adewale', role: 'Ministry Official' },
  { phone: '08067890123', name: 'Abiodun Fashola', role: 'Student (SS1)' },
  { phone: '08089012345', name: 'Mr. Taiwo Fashola', role: 'Parent' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === Role.TEACHER) router.replace('/dashboard');
      else if (user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) router.replace('/school');
      else if (user.role === Role.DISTRICT) router.replace('/district');
      else if (user.role === Role.MINISTRY) router.replace('/ministry');
      else if (user.role === Role.STUDENT) router.replace('/student');
      else if (user.role === Role.PARENT) router.replace('/parent');
    }
  }, [user, isLoading, router]);

  function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone.match(/^0[7-9][0-1]\d{8}$/)) {
      setError('Enter a valid Nigerian phone number (e.g. 08012345678)');
      return;
    }
    setStep('otp');
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    // OTP is simulated — any 4-digit code works
    if (otp.length < 4) {
      setError('Enter the 4-digit OTP sent to your phone');
      setLoading(false);
      return;
    }
    const result = login(phone);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Login failed');
      return;
    }
  }

  function fillDemo(demoPhone: string) {
    setPhone(demoPhone);
    setOtp('1234');
    setStep('otp');
    setError('');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--lagos-blue)' }}>
      {/* Government header */}
      <div style={{ background: 'var(--lagos-green)' }} className="py-2 text-center text-white text-xs font-medium tracking-widest">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;·&nbsp; LAGOS STATE GOVERNMENT
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden shadow-xl"
            style={{ border: '4px solid var(--lagos-gold)' }}
          >
            <Image src="/logo.png" alt="Lagos State Government" width={80} height={80} className="w-full h-full object-cover" priority />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Eko Excel</h1>
          <p style={{ color: '#A8C4F0' }} className="text-sm mt-1">
            Student Excellence Platform
          </p>
          <p style={{ color: '#A8C4F0', fontSize: '0.7rem' }} className="mt-0.5 italic">
            &ldquo;Justice and Progress&rdquo;
          </p>
        </div>

        {/* Login card */}
        <div className="w-full max-w-sm">
          <div className="card shadow-2xl">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--lagos-blue)' }}>
              {step === 'phone' ? 'Sign In with Phone' : 'Verify OTP'}
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {step === 'phone'
                ? 'Enter your registered phone number'
                : `OTP sent to ${phone} (demo: use any 4 digits)`}
            </p>

            {step === 'phone' ? (
              <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--lagos-blue)' }}>
                    Phone Number
                  </label>
                  <input
                    className="input"
                    type="tel"
                    placeholder="08012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={11}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-primary w-full">
                  Request OTP →
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--lagos-blue)' }}>
                    One-Time Password
                  </label>
                  <input
                    className="input text-center text-xl tracking-widest"
                    type="text"
                    placeholder="• • • •"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-success w-full" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Login →'}
                </button>
                <button
                  type="button"
                  className="text-sm text-center"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setStep('phone')}
                >
                  ← Change number
                </button>
              </form>
            )}
          </div>

          {/* Demo accounts */}
          <div className="mt-5">
            <p className="text-center text-xs mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
              DEMO ACCOUNTS — Click to auto-fill
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.phone}
                  onClick={() => fillDemo(acc.phone)}
                  className="text-left p-3 rounded-lg text-xs transition-colors"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <div className="font-semibold">{acc.role}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem' }}>{acc.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>{acc.phone}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
        © 2026 Lagos State Ministry of Education &nbsp;·&nbsp; Eko Excel v1.0 &nbsp;·&nbsp; All data stored locally
      </div>
    </div>
  );
}
