import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { OfflineProvider, useOffline } from '@/lib/offlineContext';
import { Navbar } from '@/components/Navbar';
import { Home } from '@/pages/Home';
import { NewPaste } from '@/pages/NewPaste';
import { EditPaste } from '@/pages/EditPaste';
import { ViewPaste } from '@/pages/ViewPaste';
import { WifiOff } from 'lucide-react';

function ThemedToaster() {
  return (
    <Toaster
      position="bottom-center"
      duration={2000}
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
        classNames: {
          success: 'toast-success',
          error: 'toast-error',
        },
      }}
    />
  );
}

function OfflineBanner() {
  const { isOffline, isStaleData } = useOffline();

  if (!isOffline && !isStaleData) return null;

  return (
    <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium border-b border-border/60"
      style={{
        background: 'hsl(var(--muted))',
        color: 'hsl(var(--muted-foreground))',
      }}
    >
      <WifiOff size={14} />
      <span>
        {isOffline
          ? "You're offline — viewing cached content. Some actions are unavailable."
          : "Showing cached content while refreshing…"}
      </span>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <OfflineProvider>
          <AuthProvider>
            <div className="h-screen flex flex-col overflow-hidden">
              <Navbar />
              <OfflineBanner />
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/new" element={<NewPaste />} />
                  <Route path="/paste/:slug" element={<ViewPaste />} />
                  <Route path="/edit/:slug" element={<EditPaste />} />
                </Routes>
              </main>
            </div>
            <ThemedToaster />
          </AuthProvider>
        </OfflineProvider>
      </ThemeProvider>
    </BrowserRouter >
  );
}

export default App;
