import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Trophy, MessageCircle, Newspaper, Shield, LogOut, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoAsset from '@/assets/pes2090-logo.jpg.asset.json';
import bannerAsset from '@/assets/sidebar-banner.jpg.asset.json';

const navItems = [
  { path: '/', label: 'الرئيسية', icon: Home },
  { path: '/tournament', label: 'البطولة', icon: Trophy },
  { path: '/chat', label: 'الدردشة', icon: MessageCircle },
  { path: '/news', label: 'الأخبار', icon: Newspaper },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const { team, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <header className="glass-card-strong border-b border-border/30 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="PES 2090"
              className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(0,255,102,0.5)]"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-cairo transition-all ${
                    active
                      ? 'bg-primary/20 text-primary neon-glow-green'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-cairo transition-all ${
                  location.pathname === '/admin'
                    ? 'bg-accent/20 text-accent neon-glow-gold'
                    : 'text-accent/70 hover:text-accent hover:bg-accent/10'
                }`}
              >
                <Shield className="w-4 h-4" />
                الإدارة
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-cairo hidden sm:inline">
              {team?.coach_name}
            </span>
            <Button size="icon" variant="ghost" onClick={logout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-border/30"
            >
              <div className="p-4 space-y-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-cairo ${
                        active ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg font-cairo text-accent"
                  >
                    <Shield className="w-5 h-5" />
                    الإدارة
                  </Link>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Sidebar Banner */}
        <div className="mb-6 rounded-xl overflow-hidden border border-primary/30 neon-glow-green relative">
          <img src={bannerAsset.url} alt="PES 2090 Banner" className="w-full h-auto object-cover" />
        </div>

        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;
