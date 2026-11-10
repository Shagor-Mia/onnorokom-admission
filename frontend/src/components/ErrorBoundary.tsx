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
        <div className="page py-space-xl">
          <div className="flex flex-col gap-space-sm rounded-xl border border-error/40 bg-error-container p-space-lg text-on-error-container" role="alert">
            <p className="text-headline-sm">পেজ দেখাতে সমস্যা হয়েছে</p>
            <p>পেজটি রিফ্রেশ করুন। আপনার আবেদনের তথ্য সার্ভারে সংরক্ষিত আছে।</p>
            <button type="button" className="btn-primary w-fit" onClick={() => window.location.reload()}>
              রিফ্রেশ করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
