import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Menu,
  X,
  Zap
} from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Anomalies', path: '/anomalies', icon: AlertTriangle },
    { name: 'Incidents', path: '/incidents', icon: Zap },
    { name: 'Metrics', path: '/metrics', icon: BarChart3 },
    { name: 'Demo Mode', path: '/demo', icon: Brain },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        className="glass-card border-r border-white/10 flex flex-col relative z-10"
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h1 className="text-xl font-black tracking-tight">AUTONEX</h1>
                <p className="text-xs text-muted-foreground font-mono">AIOps Platform</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                      : 'hover:bg-white/5 text-foreground/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && (
                    <span className="font-medium">{item.name}</span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-white/10 hover:bg-white/5 transition-colors"
          data-testid="sidebar-toggle"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Hero Glow */}
        <div
          className="fixed top-0 left-0 w-full h-96 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)'
          }}
        />
        
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
