import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Anomalies = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnomalies = async () => {
    try {
      const response = await axios.get(`${API}/anomalies?hours=24&limit=50`);
      setAnomalies(response.data.anomalies || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      setLoading(false);
    }
  };

  const runDetection = async () => {
    setDetecting(true);
    try {
      await axios.post(`${API}/anomalies/detect`);
      await fetchAnomalies();
    } catch (error) {
      console.error('Error running detection:', error);
    }
    setDetecting(false);
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
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="anomalies-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Anomaly Detection</h1>
          <p className="text-base text-muted-foreground mt-2">
            AI-powered anomaly detection using Isolation Forest
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="px-6 py-3 rounded-md bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 font-medium disabled:opacity-50"
          data-testid="btn-run-detection"
        >
          {detecting ? 'Detecting...' : 'Run Detection'}
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Detected"
          value={anomalies.length}
          color="text-yellow-400"
        />
        <StatCard
          label="Critical"
          value={anomalies.filter(a => a.severity === 'critical').length}
          color="text-red-400"
        />
        <StatCard
          label="High"
          value={anomalies.filter(a => a.severity === 'high').length}
          color="text-orange-400"
        />
      </div>

      {/* Anomalies List */}
      <div className="glass-card rounded-xl p-6" data-testid="anomalies-list">
        <h2 className="text-2xl font-bold tracking-tight mb-6">Detected Anomalies (24h)</h2>
        
        {anomalies.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No anomalies detected in the last 24 hours</p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anomaly, index) => (
              <AnomalyCard key={index} anomaly={anomaly} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass-card rounded-xl p-6"
  >
    <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
    <p className={`text-4xl font-black ${color}`}>{value}</p>
  </motion.div>
);

const AnomalyCard = ({ anomaly }) => {
  const severityColors = {
    critical: 'border-red-500/50 bg-red-500/10',
    high: 'border-orange-500/50 bg-orange-500/10',
    medium: 'border-yellow-500/50 bg-yellow-500/10',
  };

  const severityBadgeColors = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      className={`p-4 rounded-lg border ${severityColors[anomaly.severity] || 'border-white/10'} backdrop-blur-sm transition-all`}
      data-testid={`anomaly-${anomaly.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold">{anomaly.service}</h3>
            <p className="text-sm text-muted-foreground">{anomaly.description}</p>
          </div>
        </div>
        <span className={`text-xs font-mono px-2 py-1 rounded ${severityBadgeColors[anomaly.severity]}`}>
          {anomaly.severity}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <div>
          <p className="text-xs text-muted-foreground font-mono">Metric</p>
          <p className="text-sm font-mono font-semibold">{anomaly.metric_type}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">Confidence</p>
          <p className="text-sm font-mono font-semibold">{(anomaly.confidence * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">Value</p>
          <p className="text-sm font-mono font-semibold">{anomaly.value?.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">Baseline</p>
          <p className="text-sm font-mono font-semibold">{anomaly.baseline?.toFixed(2)}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default Anomalies;
