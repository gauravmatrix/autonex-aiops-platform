import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  Server,
  Cpu,
  Database
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentMetrics, setRecentMetrics] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, metricsRes] = await Promise.all([
        axios.get(`${API}/stats/dashboard`),
        axios.get(`${API}/metrics/latest`)
      ]);
      setStats(statsRes.data);
      setRecentMetrics(metricsRes.data.metrics || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Activity className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="dashboard">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          System Overview
        </h1>
        <p className="text-base text-muted-foreground">
          Real-time monitoring powered by AI anomaly detection
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          icon={Zap}
          label="Active Incidents"
          value={stats?.active_incidents || 0}
          trend="critical"
          testId="stat-active-incidents"
        />
        <StatCard
          icon={AlertTriangle}
          label="Anomalies (24h)"
          value={stats?.recent_anomalies || 0}
          trend="warning"
          testId="stat-anomalies"
        />
        <StatCard
          icon={Clock}
          label="Pending Actions"
          value={stats?.pending_actions || 0}
          trend="info"
          testId="stat-pending-actions"
        />
        <StatCard
          icon={CheckCircle}
          label="Total Incidents"
          value={stats?.total_incidents || 0}
          trend="success"
          testId="stat-total-incidents"
        />
      </div>

      {/* Service Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Service Health Cards */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Service Health</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Live
              </span>
            </div>
          </div>
          
          <div className="space-y-4" data-testid="service-health-list">
            {stats?.service_health?.map((service, index) => (
              <ServiceHealthCard key={index} service={service} />
            ))}
          </div>
        </div>

        {/* AI Status Card */}
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-4">AI Engine</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="font-medium">Anomaly Detector</span>
                </div>
                <span className="text-xs font-mono px-2 py-1 rounded bg-green-500/20 text-green-400">
                  {stats?.anomaly_detector_status || 'Active'}
                </span>
              </div>
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-accent" />
                  <span className="font-medium">Root Cause Analysis</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Powered by GPT-4o for natural language explanations
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <a href="/demo" className="block">
                <button
                  className="w-full px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 font-medium"
                  data-testid="btn-demo-mode"
                >
                  Launch Demo Mode
                </button>
              </a>
              <a href="/anomalies" className="block">
                <button className="w-full px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-all duration-300 font-medium">
                  View Anomalies
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Metrics Chart */}
      {recentMetrics.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-bold tracking-tight mb-6">System Metrics Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentMetrics.slice(0, 2).map((service, index) => (
              <div key={index}>
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
                  {service.service}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <MetricBadge label="CPU" value={`${service.cpu?.toFixed(1)}%`} />
                  <MetricBadge label="Memory" value={`${service.memory?.toFixed(1)}%`} />
                  <MetricBadge label="Latency" value={`${service.latency?.toFixed(0)}ms`} />
                  <MetricBadge label="Errors" value={`${service.error_rate?.toFixed(1)}%`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, trend, testId }) => {
  const trendColors = {
    critical: 'text-red-400 border-red-500/20 bg-red-500/10',
    warning: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
    info: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    success: 'text-green-400 border-green-500/20 bg-green-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`glass-card rounded-xl p-6 ${trendColors[trend]}`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight mb-1">{value}</p>
        <p className="text-xs font-mono uppercase tracking-wider opacity-80">{label}</p>
      </div>
    </motion.div>
  );
};

const ServiceHealthCard = ({ service }) => {
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };

  const statusIcons = {
    healthy: CheckCircle,
    warning: AlertTriangle,
    critical: Zap,
  };

  const Icon = statusIcons[service.status] || Server;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      data-testid={`service-${service.service}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-medium">{service.service}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${statusColors[service.status]}`} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-mono">CPU</p>
          <p className="text-sm font-mono">{service.cpu?.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">MEM</p>
          <p className="text-sm font-mono">{service.memory?.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">LAT</p>
          <p className="text-sm font-mono">{service.latency?.toFixed(0)}ms</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">ERR</p>
          <p className="text-sm font-mono">{service.error_rate?.toFixed(1)}%</p>
        </div>
      </div>
    </motion.div>
  );
};

const MetricBadge = ({ label, value }) => (
  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
    <p className="text-xs text-muted-foreground font-mono mb-1">{label}</p>
    <p className="text-lg font-mono font-semibold">{value}</p>
  </div>
);

export default Dashboard;
