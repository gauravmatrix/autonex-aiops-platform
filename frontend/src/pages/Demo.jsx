import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Zap, Play, StopCircle, AlertTriangle, CheckCircle, Activity, Brain } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Demo = () => {
  const [demoStatus, setDemoStatus] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    fetchDemoStatus();
    fetchServices();
    const interval = setInterval(() => {
      fetchDemoStatus();
      fetchLiveData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchDemoStatus = async () => {
    try {
      const response = await axios.get(`${API}/demo/status`);
      setDemoStatus(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching demo status:', error);
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/metrics/services`);
      setServices(response.data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchLiveData = async () => {
    try {
      const [metricsRes, anomaliesRes, incidentsRes] = await Promise.all([
        axios.get(`${API}/metrics/latest`),
        axios.get(`${API}/anomalies?hours=1&limit=10`),
        axios.get(`${API}/incidents?status=open&limit=5`),
      ]);
      setMetrics(metricsRes.data.metrics || []);
      setAnomalies(anomaliesRes.data.anomalies || []);
      setIncidents(incidentsRes.data.incidents || []);
    } catch (error) {
      console.error('Error fetching live data:', error);
    }
  };

  const injectFailure = async (service) => {
    try {
      await axios.post(`${API}/demo/inject-failure?service=${service}`);
      toast.success(`Failure injected into ${service}`);
      await fetchDemoStatus();
    } catch (error) {
      console.error('Error injecting failure:', error);
      toast.error('Failed to inject failure');
    }
  };

  const clearFailure = async () => {
    try {
      await axios.post(`${API}/demo/clear-failure`);
      toast.success('Failure mode cleared');
      await fetchDemoStatus();
    } catch (error) {
      console.error('Error clearing failure:', error);
      toast.error('Failed to clear failure');
    }
  };

  const runFullDemo = async () => {
    toast.info('Starting full demo sequence...');
    
    // Step 1: Inject failure
    const targetService = services[0];
    await injectFailure(targetService);
    
    // Step 2: Wait for anomaly detection
    toast.info('Waiting for anomaly detection...', { duration: 3000 });
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 3: Run anomaly detection
    try {
      await axios.post(`${API}/anomalies/detect`);
      toast.success('Anomalies detected');
    } catch (error) {
      console.error('Error in anomaly detection:', error);
    }
    
    // Step 4: Create incident
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const anomaliesRes = await axios.get(`${API}/anomalies?hours=1&limit=5`);
      const recentAnomalies = anomaliesRes.data.anomalies || [];
      
      if (recentAnomalies.length > 0) {
        const incidentRes = await axios.post(`${API}/incidents`, {
          title: `Performance Degradation in ${targetService}`,
          severity: 'critical',
          service: targetService,
          anomaly_ids: recentAnomalies.map(a => a.id),
        });
        
        const incidentId = incidentRes.data.id;
        
        // Step 5: Run AI analysis
        toast.info('Running AI analysis...', { duration: 3000 });
        await axios.post(`${API}/ai/analyze?incident_id=${incidentId}`);
        await axios.post(`${API}/ai/recommend?incident_id=${incidentId}`);
        
        toast.success('Demo completed! Check Incidents page for AI analysis.');
      }
    } catch (error) {
      console.error('Error in demo sequence:', error);
      toast.error('Demo sequence encountered an error');
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
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="demo-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Demo Mode</h1>
        <p className="text-base text-muted-foreground mt-2">
          Inject failures and observe AI-powered detection and analysis
        </p>
      </motion.div>

      {/* Demo Status */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-card rounded-xl p-6 border-2 ${
          demoStatus?.failure_mode
            ? 'border-red-500/50 bg-red-500/10'
            : 'border-green-500/50 bg-green-500/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {demoStatus?.failure_mode ? (
              <AlertTriangle className="w-8 h-8 text-red-400" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-400" />
            )}
            <div>
              <h2 className="text-2xl font-bold">
                {demoStatus?.failure_mode ? 'Failure Mode Active' : 'Normal Operation'}
              </h2>
              {demoStatus?.affected_service && (
                <p className="text-muted-foreground mt-1">
                  Affected Service: <span className="font-mono">{demoStatus.affected_service}</span>
                </p>
              )}
            </div>
          </div>
          {demoStatus?.failure_mode && (
            <button
              onClick={clearFailure}
              className="px-6 py-3 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all font-medium"
              data-testid="btn-clear-failure"
            >
              <StopCircle className="w-4 h-4 inline mr-2" />
              Clear Failure
            </button>
          )}
        </div>
      </motion.div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inject Failures */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Inject Failure</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a service to simulate a failure scenario
          </p>
          <div className="space-y-3">
            {services.map((service) => (
              <button
                key={service}
                onClick={() => injectFailure(service)}
                disabled={demoStatus?.failure_mode}
                className="w-full px-6 py-3 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`btn-inject-${service}`}
              >
                <Zap className="w-4 h-4 inline mr-2" />
                Inject Failure: {service}
              </button>
            ))}
          </div>
        </div>

        {/* Full Demo */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Full Demo Sequence</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Run complete demo: failure injection → anomaly detection → AI analysis → recommendations
          </p>
          <button
            onClick={runFullDemo}
            disabled={demoStatus?.failure_mode}
            className="w-full px-6 py-3 rounded-md bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 font-medium disabled:opacity-50"
            data-testid="btn-run-full-demo"
          >
            <Play className="w-4 h-4 inline mr-2" />
            Run Full Demo
          </button>
          
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Demo Steps
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</div>
                <span>Inject failure into service</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</div>
                <span>ML detects anomalies</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</div>
                <span>Create incident</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">4</div>
                <span>AI analyzes root cause</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">5</div>
                <span>Generate recommendations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Metrics */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Live Metrics</h3>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            {metrics.slice(0, 3).map((metric, index) => (
              <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs font-mono text-muted-foreground mb-1">{metric.service}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span>CPU: {metric.cpu?.toFixed(1)}%</span>
                  <span>Mem: {metric.memory?.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Recent Anomalies</h3>
          <div className="space-y-2">
            {anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No anomalies detected</p>
            ) : (
              anomalies.slice(0, 3).map((anomaly, index) => (
                <div key={index} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs font-mono">{anomaly.service}</p>
                  <p className="text-xs text-muted-foreground">{anomaly.metric_type}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open Incidents */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Open Incidents</h3>
          <div className="space-y-2">
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No open incidents</p>
            ) : (
              incidents.slice(0, 3).map((incident, index) => (
                <div key={index} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs font-mono">{incident.service}</p>
                  <p className="text-xs text-muted-foreground">{incident.title}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
