import { Component, ReactNode } from 'react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('Route render error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white">
          <Navbar />
          <div className="pt-24 max-w-4xl mx-auto px-4 py-20 text-center">
            <p className="text-stone-700 font-semibold">Something went wrong while loading this page.</p>
            <p className="text-stone-400 text-sm mt-2">Please go back and try again.</p>
          </div>
          <Footer />
        </div>
      );
    }

    return this.props.children;
  }
}
