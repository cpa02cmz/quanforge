import { useState, memo, useMemo, useCallback, Suspense } from 'react';
import { useLocation, Link, Outlet } from 'react-router-dom';
import { UserSession } from '../types';

interface LayoutProps {
  session: UserSession | null;
}

const Layout = memo<LayoutProps>(({ session }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = useMemo(() => [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Generator', href: '/generator', icon: '🤖' },
    { name: 'Wiki', href: '/wiki', icon: '📚' },
  ], []);

  const isActiveRoute = useCallback((href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Header */}
      <header className="bg-dark-surface border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link to="/" className="ml-4 md:ml-0 flex items-center">
                <span className="text-xl font-bold text-brand-400">QuantForge AI</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {session && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {session.user.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-300 hidden sm:block">
                    {session.user.email}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'block' : 'hidden'}
          md:block w-64 bg-dark-surface border-r border-gray-700 min-h-screen
        `}>
          <nav className="mt-5 px-2 space-y-1">
            {navigation.map((item) => {
              const active = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${active
                      ? 'bg-brand-900 text-brand-300 border-r-2 border-brand-500'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
});

Layout.displayName = 'Layout';

Layout.displayName = 'Layout';

export { Layout };
export default Layout;