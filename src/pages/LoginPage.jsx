import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
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
      errors.usernameOrEmail = 'Please enter your email or username';
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
    const destination = location.state?.from?.pathname || '/';
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-[400px]">
        {/* Modern Clean Login Card */}
        <div className="bg-card border border-border shadow-xs rounded-2xl p-7 sm:p-8">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-xs flex items-center justify-center mb-3">
              <Icon name="brush" size={22} className="text-primary-foreground" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Aesthetic Interiors OMS</span>
            </div>

            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Welcome Back
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Sign in to manage projects, field sites, and team workflows.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <Alert type="danger" className="mb-4 text-xs">
              {errorMessage}
            </Alert>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email / Username Input */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Email or Username <span className="text-destructive">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-muted-foreground pointer-events-none flex items-center">
                  <Icon name="user" size={16} />
                </div>
                <input
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
                  placeholder="Enter email or username"
                  disabled={loading}
                  className={`w-full bg-background border rounded-xl text-sm text-foreground placeholder:text-muted-foreground transition-colors
                    h-10 pl-10 pr-3.5
                    ${
                      validationErrors.usernameOrEmail
                        ? 'border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive'
                        : 'border-border focus:border-ring focus:ring-2 focus:ring-ring/20'
                    }
                    focus:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed`}
                />
              </div>
              {validationErrors.usernameOrEmail && (
                <p className="text-[11px] text-destructive font-medium mt-1">
                  {validationErrors.usernameOrEmail}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-muted-foreground pointer-events-none flex items-center">
                  <Icon name="lock" size={16} />
                </div>
                <input
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
                  placeholder="Enter password"
                  disabled={loading}
                  className={`w-full bg-background border rounded-xl text-sm text-foreground placeholder:text-muted-foreground transition-colors
                    h-10 pl-10 pr-10
                    ${
                      validationErrors.password
                        ? 'border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive'
                        : 'border-border focus:border-ring focus:ring-2 focus:ring-ring/20'
                    }
                    focus:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg focus:outline-none cursor-pointer"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={15} />
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[11px] text-destructive font-medium mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="w-3.5 h-3.5 rounded text-primary border-input focus:ring-ring focus:ring-offset-0 transition-colors cursor-pointer"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            {/* Solid Sign-In Button (No Gradient) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm shadow-2xs active:scale-[0.99] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <Icon name="arrow-right" size={15} />
                </>
              )}
            </button>
          </form>

          {/* Security & Access Assurance */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Icon name="shield" size={13} className="text-emerald-600" />
            <span>256-bit encrypted • Role-based access control</span>
          </div>
        </div>

        {/* Minimal Decent Copyright */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} Aesthetic Interiors Studio. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
