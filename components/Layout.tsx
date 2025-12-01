
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { AISettingsModal } from './AISettingsModal';
import { DatabaseSettingsModal } from './DatabaseSettingsModal';
import { useTranslation } from '../services/i18n';

interface LayoutProps {
  session: any;
}

export const Layout: React.FC<LayoutProps> = ({ session }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDbSettingsOpen, setIsDbSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { name: t('nav_dashboard'), path: '/', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    )},
    { name: t('nav_new_robot'), path: '/generator', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
    )},
    { name: t('nav_wiki'), path: '/wiki', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    )},
  ];

  return (
    <div className="flex h-screen bg-dark-bg text-gray-100 overflow-hidden font-sans">
      <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <DatabaseSettingsModal isOpen={isDbSettingsOpen} onClose={() => setIsDbSettingsOpen(false)} />
      
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
          fixed md:relative z-30 w-64 h-full bg-dark-surface border-r border-dark-border flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-blue-500 bg-clip-text text-transparent">
                QuantForge AI
            </h1>
            <p className="text-xs text-gray-500 mt-1">MQL5 Generator v1.0</p>
          </div>
          {/* Close button for mobile */}
          <button onClick={closeMobileMenu} className="md:hidden text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={closeMobileMenu}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' 
                    : 'text-gray-400 hover:bg-dark-border hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-dark-border space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</h3>
            <button
                onClick={() => {
                    setIsSettingsOpen(true);
                    closeMobileMenu();
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-gray-400 hover:bg-dark-border hover:text-white"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-medium text-sm">{t('nav_ai_settings')}</span>
            </button>

            <button
                onClick={() => {
                    setIsDbSettingsOpen(true);
                    closeMobileMenu();
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-gray-400 hover:bg-dark-border hover:text-white"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                <span className="font-medium text-sm">{t('nav_db_settings')}</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold">
              {session?.user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/50 border border-transparent rounded-lg transition-all"
          >
            {t('nav_sign_out')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="md:hidden flex items-center justify-between p-4 bg-dark-surface border-b border-dark-border">
          <span className="font-bold text-brand-400">QuantForge</span>
          <div className="flex gap-2">
             <button onClick={() => setIsSettingsOpen(true)} className="text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>
             <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-300">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
