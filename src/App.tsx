import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { NewPaste } from '@/pages/NewPaste';
import { ViewPaste } from '@/pages/ViewPaste';

function App() {
  return (
    <BrowserRouter>
      <HeroUIProvider>
        <ToastProvider placement="bottom-right" />
        <AuthProvider>
          <div className="dark min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="pb-12">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/new" element={<NewPaste />} />
                <Route path="/paste/:slug" element={<ViewPaste />} />
              </Routes>
            </main>
            {/* Footer */}
            <footer className="border-t border-white/5 py-6 text-center text-sm text-default-400">
              <p>
                paste<span className="gradient-text font-semibold">bin</span> — private-first code sharing
              </p>
            </footer>
          </div>
        </AuthProvider>
      </HeroUIProvider>
    </BrowserRouter>
  );
}

export default App;
