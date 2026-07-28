'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

type TabPanelErrorBoundaryProps = {
  tabLabel?: string;
  children: ReactNode;
};

type TabPanelErrorBoundaryState = {
  error: Error | null;
};

export class TabPanelErrorBoundary extends Component<TabPanelErrorBoundaryProps, TabPanelErrorBoundaryState> {
  state: TabPanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): TabPanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TabPanelErrorBoundary]', this.props.tabLabel, error, info);
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const chunk = isChunkLoadError(this.state.error);

    return (
      <div className="mc-panel p-6 text-center space-y-4">
        <p className="font-minecraft text-white">
          {this.props.tabLabel ? `No se cargó: ${this.props.tabLabel}` : 'Esta pestaña no cargó'}
        </p>
        <p className="text-sm text-gray-400">
          {chunk
            ? 'Actualización del panel o caché antigua. Recarga la página o pulsa reintentar.'
            : this.state.error.message || 'Error inesperado al abrir la pestaña.'}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button type="button" className="mc-btn mc-btn-emerald px-4 py-2" onClick={this.handleRetry}>
            Reintentar pestaña
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-lapis px-4 py-2"
            onClick={() => window.location.reload()}
          >
            Recargar panel
          </button>
        </div>
      </div>
    );
  }
}
