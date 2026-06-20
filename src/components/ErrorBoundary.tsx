import { Component, ReactNode } from "react";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import "./ErrorBoundary.css";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI - if not provided, uses the default error screen */
  fallback?: (error: Error, errorInfo: string, reset: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log the error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || errorInfo.stack || null,
    });
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo || "", this.reset);
      }

      // Default error screen
      return <ErrorScreen error={this.state.error} errorInfo={this.state.errorInfo} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

interface ErrorScreenProps {
  error: Error;
  errorInfo: string | null;
  onReset: () => void;
}

function ErrorScreen({ error, errorInfo, onReset }: ErrorScreenProps) {
  const errorMessage = error.message || "An unexpected error occurred";
  const isReferenceError = error.name === "ReferenceError";
  const isTypeError = error.name === "TypeError";

  return (
    <div className="errorScreen">
      <div className="errorContainer">
        <div className="errorIcon">
          <Icon name="alert-triangle" size={48} />
        </div>
        
        <h1 className="errorTitle">
          {isReferenceError ? "Something went wrong" : 
           isTypeError ? "Type Error" : 
           "Unexpected Error"}
        </h1>
        
        <p className="errorMessage">{errorMessage}</p>

        {errorInfo && (
          <details className="errorDetails">
            <summary>Technical details</summary>
            <pre className="errorStack">{errorInfo}</pre>
          </details>
        )}

        <div className="errorActions">
          <Button variant="primary" icon="refresh" onClick={onReset}>
            Try again
          </Button>
          <Button variant="ghost" icon="home" onClick={() => window.location.href = "/"}>
            Go to dashboard
          </Button>
        </div>

        <p className="errorHint">
          If this problem persists, please report it on GitHub or Discord.
        </p>
      </div>
    </div>
  );
}