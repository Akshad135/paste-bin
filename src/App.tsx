import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { Home } from '@/pages/Home';
import { NewPaste } from '@/pages/NewPaste';
import { EditPaste } from '@/pages/EditPaste';
import { ViewPaste } from '@/pages/ViewPaste';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/new" element={<NewPaste />} />
                <Route path="/paste/:slug" element={<ViewPaste />} />
                <Route path="/edit/:slug" element={<EditPaste />} />
              </Routes>
            </main>
          </div>
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
