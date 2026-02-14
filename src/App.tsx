import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { Home } from '@/pages/Home';
import { NewPaste } from '@/pages/NewPaste';
import { EditPaste } from '@/pages/EditPaste';
import { ViewPaste } from '@/pages/ViewPaste';

function ThemedToaster() {
  return (
    <Toaster
      position="bottom-center"
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

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="h-screen flex flex-col overflow-hidden">
            <Navbar />
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
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
