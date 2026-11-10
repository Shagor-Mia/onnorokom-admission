import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a rendering bug shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="container main">
          <div className="alert alert--error" role="alert">
            <p className="alert__title">পেজ দেখাতে সমস্যা হয়েছে</p>
            <p>পেজটি রিফ্রেশ করুন। আপনার আবেদনের তথ্য সার্ভারে সংরক্ষিত আছে।</p>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              রিফ্রেশ করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
