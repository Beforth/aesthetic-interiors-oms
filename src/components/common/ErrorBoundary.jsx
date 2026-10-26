import React from 'react';
import Button from '../ui/Button';
import { AlertCircleIcon } from '../ui/icons';

/**
 * BefUI ErrorBoundary component conforming strictly to design.md tokens.
 * Catches unhandled render errors, preventing blank white screens.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[360px] flex items-center justify-center p-6 w-full animate-in fade-in duration-150">
          <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
              <AlertCircleIcon className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Unable to display this view
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                An unexpected render error occurred while rendering this section.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 text-[11px] font-mono bg-muted p-2 rounded-lg text-muted-foreground border border-border/80 text-left truncate">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  this.handleReset();
                  window.location.href = '/dashboard';
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
