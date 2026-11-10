import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreviewAuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/hooks/use-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import Demo from './Demo';
import '@/index.css';

// This entry deliberately does not mount App, AuthProvider or UserDataProvider.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <PreviewAuthProvider>
          <TooltipProvider>
            <RouteErrorBoundary routeName="conhecer-demo"><Demo /></RouteErrorBoundary>
            <Toaster /><Sonner />
          </TooltipProvider>
        </PreviewAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
