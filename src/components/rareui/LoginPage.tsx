import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { OtpInput, OtpStatus } from './OtpInput';
import { ThemeMorphButton } from '../ThemeMorphButton';

export interface LoginPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: (nextTheme: 'light' | 'dark') => void;
  onSuccess: (userEmail: string) => void;
  onBackToLab?: () => void;
}

type AuthStep = 'login' | '2fa' | 'success';

export function LoginPage({
  theme,
  onToggleTheme,
  onSuccess,
  onBackToLab
}: LoginPageProps) {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('researcher@temporal.lab');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);

  // Step 1: Submit Login -> Advance to Step 2 (2FA)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Advance to 2FA step (sequential flow, no tabs)
      setStep('2fa');
      setOtpCode('');
      setOtpStatus('idle');
    }, 450);
  };

  // Step 2: OTP verification completion
  const handleOtpComplete = (code: string) => {
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Demo validation: 000000 triggers error shake demo
      if (code === '000000') {
        setOtpStatus('error');
        setErrorMsg('Invalid verification token. Try demo code 849201.');
        setTimeout(() => setOtpStatus('idle'), 1500);
      } else {
        setOtpStatus('success');
        setAuthenticatedUser(email);
        setStep('success');
        setTimeout(() => {
          onSuccess(email);
        }, 850);
      }
    }, 550);
  };

  const handleOAuthClick = (provider: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const ssoEmail = `${provider.toLowerCase()}-researcher@temporal.lab`;
      setEmail(ssoEmail);
      // Advance to 2FA for secondary security
      setStep('2fa');
      setOtpCode('');
      setOtpStatus('idle');
    }, 400);
  };

  return (
    <div className="rare-login-page">
      {/* Top Bar with Temporal Logo and Theme Morph Button */}
      <header className="rare-login-topbar">
        <div className="rare-login-brand">
          <img
            src="/TemporalLogo.svg"
            alt="Temporal"
            className="temporal-logo"
            style={{ height: 26, width: 'auto', display: 'block' }}
          />
        </div>

        <div className="rare-topbar-actions">
          <ThemeMorphButton theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Main Centered Flow - Not on a boxed card */}
      <main className="rare-login-center">
        <div className="rare-login-card">
          <AnimatePresence mode="wait">
            {step === 'success' ? (
              /* Success splash */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                className="rare-success-view"
              >
                <div className="rare-success-icon-wrap">
                  <CheckCircle2 size={42} className="rare-success-icon" />
                </div>
                <h3>Welcome back</h3>
                <p className="mono">{authenticatedUser}</p>
                <div className="rare-entering-lab">
                  <LoaderCircle size={15} className="spin" />
                  <span>Entering Temporal Research Lab…</span>
                </div>
              </motion.div>
            ) : step === '2fa' ? (
              /* Step 2: 2FA Verification */
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="rare-step-container"
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setErrorMsg(null);
                  }}
                  className="rare-step-back-btn"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Login</span>
                </button>

                <div className="rare-card-header">
                  <h2>Two-Factor Authentication</h2>
                  <p className="rare-2fa-subtitle">
                    Enter the 6-digit code sent to <b className="mono">{email}</b>
                  </p>
                </div>

                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rare-error-banner"
                    role="alert"
                  >
                    <span>{errorMsg}</span>
                  </motion.div>
                )}

                <div className="rare-otp-view">
                  <div className="rare-otp-input-wrap">
                    <OtpInput
                      length={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      onComplete={handleOtpComplete}
                      status={otpStatus}
                      disabled={isLoading}
                      size="md"
                      autoFocus
                    />
                  </div>

                  <div className="rare-otp-hint-box">
                    <Sparkles size={13} />
                    <span>Demo code: <b>849201</b> or paste any 6 digits</span>
                  </div>

                  <div className="rare-otp-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpCode('849201');
                        handleOtpComplete('849201');
                      }}
                      disabled={isLoading}
                      className="rare-quick-fill-btn"
                    >
                      Auto-fill demo code (849201)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('New verification token dispatched.');
                      }}
                      className="rare-resend-btn"
                    >
                      Resend code
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Step 1: Login to your Account */
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="rare-step-container"
              >
                <div className="rare-card-header">
                  <h2>Login to your Account</h2>
                </div>

                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rare-error-banner"
                    role="alert"
                  >
                    <span>{errorMsg}</span>
                  </motion.div>
                )}

                <form onSubmit={handleLoginSubmit} className="rare-form-stack">
                  <div className="rare-field-group">
                    <label htmlFor="rare-email">Email</label>
                    <div className="rare-input-container">
                      <span className="rare-input-leading-icon">
                        <Mail size={15} />
                      </span>
                      <input
                        id="rare-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="researcher@temporal.lab"
                        required
                        autoComplete="username"
                        className="rare-text-input with-icon"
                      />
                    </div>
                  </div>

                  <div className="rare-field-group">
                    <div className="rare-label-row">
                      <label htmlFor="rare-password">Password</label>
                      <a
                        href="#forgot"
                        onClick={e => {
                          e.preventDefault();
                          setErrorMsg('Password reset instructions sent to your email.');
                        }}
                        className="rare-text-link"
                      >
                        Forgot?
                      </a>
                    </div>
                    {/* Rare UI Password Input with dynamic 4-step strength meter */}
                    <PasswordInput
                      id="rare-password"
                      value={password}
                      onChange={setPassword}
                      placeholder="••••••••••••"
                      strength={true}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="rare-checkbox-row">
                    <label className="rare-checkbox-label">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rare-native-checkbox"
                      />
                      <span>Remember credentials for 30 days</span>
                    </label>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="rare-submit-btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircle size={16} className="spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Social Sign-in Divider */}
                <div className="rare-divider">
                  <span>or continue with</span>
                </div>

                {/* Social Providers */}
                <div className="rare-social-grid">
                  <motion.button
                    type="button"
                    onClick={() => handleOAuthClick('GitHub')}
                    disabled={isLoading}
                    className="rare-social-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <span>GitHub SSO</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => handleOAuthClick('Google')}
                    disabled={isLoading}
                    className="rare-social-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google Workspace</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security footnote */}
          <div className="rare-card-footer">
            <ShieldCheck size={13} className="rare-shield-icon" />
            <span>Temporal Lab Auth · Zero-knowledge encryption</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
