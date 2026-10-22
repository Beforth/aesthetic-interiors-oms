import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
import Checkbox from '../components/ui/Checkbox';
import { validateEmail } from '../utils/validators';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // If already authenticated, redirect appropriately
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Load remembered username/email if saved previously
  useEffect(() => {
    const saved = authService.getRememberedEmail();
    if (saved) {
      setUsernameOrEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const validate = () => {
    const errors = {};
    const identifier = usernameOrEmail.trim();
    if (!identifier) {
      errors.usernameOrEmail = 'Please enter your email, username, or role';
    } else if (identifier.includes('@')) {
      const emailErr = validateEmail(identifier);
      if (emailErr) {
        errors.usernameOrEmail = emailErr;
      }
    }
    if (!password) {
      errors.password = 'Please enter your password';
    } else if (password.length < 3) {
      errors.password = 'Password must be at least 3 characters';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginSuccess = (user) => {
    toast.success(`Welcome back, ${user.name}`);
    const destination =
      location.state?.from?.pathname ||
      '/';
    navigate(destination, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const user = await login(usernameOrEmail, password, rememberMe);
      handleLoginSuccess(user);
    } catch (err) {
      setErrorMessage(
        err.message || 'Authentication failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-brand-canvas">
      {/* Left Column: Luxury Architectural Showcase (Visible on Large Screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-espresso text-surface p-12 xl:p-16 flex-col justify-between overflow-hidden">
        

        {/* Ambient Warm Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-clay/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-500/30 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-brand-200 shadow-lg">
            <Icon name="brush" size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-wider uppercase text-white font-serif">
              Aesthetic Interiors
            </span>
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-200/80 font-medium">
              Operations & Client Portal
            </div>
          </div>
        </div>

        {/* Center Content: Statement & Pillars */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-brand-200 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            <span>High-End Fit-Out Governance</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4 font-serif">
            Precision Craftsmanship Meets Seamless Site Operations.
          </h2>

          <p className="text-sm xl:text-base text-white/80 leading-relaxed mb-8 font-light">
            An integrated management ecosystem linking design studio visions, artisan site execution, and real-time client milestone oversight.
          </p>

          {/* Three Operational Pillars */}
          <div className="space-y-3.5">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-brand-400/20 text-brand-200 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="projects" size={17} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Full-Lifecycle Project Tracking</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Monitor 16 critical fit-out phases with milestones, trade checklists, and snag inspections.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-brand-400/20 text-brand-200 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="attendance" size={17} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Field Trade & Artisan Oversight</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Daily muster rolls, supervisor sign-offs, and agency coordination on active project sites.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-brand-400/20 text-brand-200 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="shield" size={17} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Dedicated Client Transparency</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Real-time photo logs, milestone approvals, and secure payment schedule management.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/60 border-t border-white/10 pt-6">
          <span>&copy; {new Date().getFullYear()} Aesthetic Interiors Studio</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Operational Portal Active</span>
          </span>
        </div>
      </div>

      {/* Right Column: Modern Aesthetic Sign-In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-surface shadow-md mb-3 ring-4 ring-brand-100">
              <Icon name="brush" size={26} className="text-surface" />
            </div>
            <h1 className="text-2xl font-extrabold text-text-main tracking-tight font-serif">
              Aesthetic Interiors
            </h1>
            <p className="text-xs uppercase tracking-widest text-text-muted mt-0.5 font-semibold">
              Operations Management System
            </p>
          </div>

          {/* Form Card Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                Operations Portal Access
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
              Sign In
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1.5 leading-relaxed">
              Enter your registered work credentials to access projects, sites, and operational reports.
            </p>
          </div>

          {/* Supported Roles Indicator */}
          <div className="mb-6 p-3.5 rounded-xl bg-brand-50/80 border border-brand-200/70">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon name="shield" size={13} className="text-brand-600" />
                <span>Log in by Email, Username, or Role</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Admin / Owner', key: 'admin' },
                { label: 'Manager', key: 'manager' },
                { label: 'Supervisor', key: 'supervisor' },
                { label: 'Site Worker', key: 'worker' },
                { label: 'Client', key: 'client' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => {
                    setUsernameOrEmail(item.key);
                    if (validationErrors.usernameOrEmail) {
                      setValidationErrors((prev) => ({ ...prev, usernameOrEmail: '' }));
                    }
                  }}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-all cursor-pointer ${
                    usernameOrEmail.toLowerCase() === item.key
                      ? 'bg-brand-600 text-surface border-brand-600 shadow-xs'
                      : 'bg-surface text-brand-800 border-brand-200 hover:border-brand-500 hover:bg-brand-100/50'
                  }`}
                  data-tooltip={`Use role "${item.key}" as username`}
                  aria-label={`Use role ${item.key}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <Alert type="danger" className="mb-5 animate-in fade-in duration-200">
              {errorMessage}
            </Alert>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <Input
                label="Email, Username, or Role"
                type="text"
                required
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => {
                  setUsernameOrEmail(e.target.value);
                  if (validationErrors.usernameOrEmail) {
                    setValidationErrors((prev) => ({ ...prev, usernameOrEmail: '' }));
                  }
                }}
                placeholder="e.g. admin, manager, supervisor, worker, client, or your email"
                leadingIcon="user"
                error={validationErrors.usernameOrEmail}
                disabled={loading}
              />
            </div>

            <div>
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  placeholder="Enter your account password"
                  leadingIcon="shield"
                  error={validationErrors.password}
                  disabled={loading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-8 text-text-muted hover:text-text-main transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Checkbox
                label="Remember username on this browser"
                checked={rememberMe}
                onChange={setRememberMe}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              disabled={loading}
              className="mt-2 shadow-md hover:shadow-lg transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                <span>Sign In to Portal</span>
                <Icon name="arrow-right" size={16} />
              </span>
            </Button>
          </form>

          {/* Security & Access Info */}
          <div className="mt-8 pt-6 border-t border-border/70 text-center">
            <div className="inline-flex items-center justify-center gap-2 text-xs text-text-muted">
              <Icon name="shield" size={14} className="text-brand-600" />
              <span>Protected by role-based access control & token verification</span>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Need account provisioning or password assistance? Please contact your system administrator or project manager.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
