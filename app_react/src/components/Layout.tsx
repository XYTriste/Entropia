import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--page-bg)] transition-colors duration-300">
      <Header />
      <main className="flex-1 relative">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
