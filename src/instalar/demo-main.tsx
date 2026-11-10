import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreviewAuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/hooks/use-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import DemoDaLanding from '@/pages/organizar/DemoDaLanding';
import '@/index.css';

// Standalone iframe: no App, real AuthProvider, UserDataProvider or marketing boot.
// DemoDaLanding owns the 16 module previews and the existing landing:* protocol.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const insideParent = (() => {
  try { return window.parent !== window && window.parent.location.origin === window.location.origin; }
  catch { return false; }
})();

if (!insideParent) {
  // The shared component's standalone fallback belongs to /organizar. Keep this
  // entry in its own funnel without changing the published purchase journey.
  window.location.replace('/instalar');
} else {
  createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider persist={false}>
          <PreviewAuthProvider>
            <TooltipProvider>
              <RouteErrorBoundary routeName="instalar-demo"><DemoDaLanding /></RouteErrorBoundary>
              <Toaster /><Sonner />
            </TooltipProvider>
          </PreviewAuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}
