import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';
import { ROLES, ROLE_LABELS } from '../config/roles';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
import Checkbox from '../components/ui/Checkbox';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginAsUser, isAuthenticated, availableUsers } = useAuth();
  const toast = useToast();

  const [usernameOrEmail, setUsernameOrEmail] = useState('admin@aesthetic.demo');
  const [password, setPassword] = useState('Demo@123');
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
    if (!usernameOrEmail.trim()) {
      errors.usernameOrEmail = 'Please enter your username or email';
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
    const destination = location.state?.from?.pathname || (user.role === ROLES.CLIENT ? '/projects' : '/dashboard');
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

  const handleQuickLogin = (user) => {
    try {
      const loggedUser = loginAsUser(user);
      handleLoginSuccess(loggedUser);
    } catch (err) {
      setErrorMessage(err.message || 'Quick login failed.');
    }
  };

  // Group representative demo profiles across the 5 roles
  const demoRoleKeys = [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.WORKER, ROLES.CLIENT];
  const demoProfiles = demoRoleKeys
    .map((roleKey) => (availableUsers || []).find((u) => u.role === roleKey && u.status === 'active'))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Brand Monogram & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-600 text-surface shadow-md mb-3 ring-4 ring-brand-100">
            <Icon name="brush" size={26} className="text-surface" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            Aesthetic Interiors
          </h1>
          <p className="text-xs uppercase tracking-widest text-text-muted mt-1 font-semibold">
            Operations Management System
          </p>
        </div>

        {/* Main Login Card */}
        <Card className="shadow-lg border-border/80 p-6 sm:p-8 rounded-xl bg-surface backdrop-blur-sm mb-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Operations Portal
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-main tracking-tight">
              Sign In
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Enter credentials below or choose a 1-click demo profile to explore the system. Demo password: <code className="font-mono text-brand-700 font-bold">Demo@123</code>
            </p>
          </div>

          {errorMessage && (
            <Alert type="danger" className="mb-5 animate-in fade-in duration-200">
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Input
                label="Email or Username"
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
                placeholder="e.g. admin@aesthetic.demo"
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
                  placeholder="Enter password (Demo@123)"
                  leadingIcon="shield"
                  error={validationErrors.password}
                  disabled={loading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  data-tooltip={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-8 text-text-muted hover:text-text-main transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 pb-1">
              <Checkbox
                label="Remember my username on this device"
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
              className="mt-3 shadow"
            >
              Sign In to Portal
            </Button>
          </form>
        </Card>

        {/* 1-Click Demo Profiles for all 5 Roles */}
        {demoProfiles.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon name="sparkles" size={14} className="text-brand-500" />
                <span>1-Click Demo Profiles</span>
              </span>
              <span className="text-[11px] font-normal text-text-muted">Password: Demo@123</span>
            </div>

            <div className="space-y-2">
              {demoProfiles.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickLogin(user)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors text-left select-none group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-text-main leading-tight group-hover:text-brand-700">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-text-muted truncate">
                      {user.title || user.notes} • {user.email}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-700 uppercase">
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    <Icon name="arrow-right" size={14} className="text-brand-400 group-hover:text-brand-600 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audit Notice */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
            <Icon name="shield" size={13} className="text-brand-600" />
            <span>Secure Operations Portal. Standard token authentication active.</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-4 text-xs text-text-muted">
          &copy; {new Date().getFullYear()} Aesthetic Interiors OSM. All rights reserved.
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
