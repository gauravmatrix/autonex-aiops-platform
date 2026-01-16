import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Activity, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Metrics = () => {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [metricsData, setMetricsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedService) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedService]);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/metrics/services`);
      const servicesList = response.data.services || [];
      setServices(servicesList);
      if (servicesList.length > 0) {
        setSelectedService(servicesList[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching services:', error);
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    if (!selectedService) return;
    try {
      const response = await axios.get(`${API}/metrics/timeseries?service=${selectedService}&hours=1`);
      const metrics = response.data.metrics || [];
      
      // Format data for charts
      const formatted = metrics.map(m => ({
        timestamp: new Date(m.timestamp).toLocaleTimeString(),
        cpu: m.cpu,
        memory: m.memory,
        latency: m.latency,
        error_rate: m.error_rate,
        requests_per_sec: m.requests_per_sec,
      })).slice(-50);
      
      setMetricsData(formatted);
    } catch (error) {
      console.error('Error fetching metrics:', error);
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
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="metrics-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">System Metrics</h1>
        <p className="text-base text-muted-foreground mt-2">
          Real-time time-series monitoring
        </p>
      </motion.div>

      {/* Service Selector */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Select Service
        </h2>
        <div className="flex flex-wrap gap-3">
          {services.map((service) => (
            <button
              key={service}
              onClick={() => setSelectedService(service)}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-300 ${
                selectedService === service
                  ? 'bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
              data-testid={`btn-service-${service}`}
            >
              {service}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {metricsData.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <ChartCard
            title="CPU & Memory Usage (%)"
            data={metricsData}
            lines={[
              { dataKey: 'cpu', stroke: '#3B82F6', name: 'CPU' },
              { dataKey: 'memory', stroke: '#8B5CF6', name: 'Memory' },
            ]}
          />
          <ChartCard
            title="Latency (ms)"
            data={metricsData}
            lines={[
              { dataKey: 'latency', stroke: '#10B981', name: 'Latency' },
            ]}
          />
          <ChartCard
            title="Error Rate (%) & Requests/sec"
            data={metricsData}
            lines={[
              { dataKey: 'error_rate', stroke: '#EF4444', name: 'Error Rate' },
              { dataKey: 'requests_per_sec', stroke: '#F59E0B', name: 'Requests/sec' },
            ]}
          />
        </div>
      )}
    </div>
  );
};

const ChartCard = ({ title, data, lines }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card rounded-xl p-6"
  >
    <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="timestamp"
          stroke="rgba(255,255,255,0.5)"
          style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.5)"
          style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(10, 10, 11, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontFamily: 'JetBrains Mono',
          }}
        />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.stroke}
            strokeWidth={2}
            dot={false}
            name={line.name}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </motion.div>
);

export default Metrics;
