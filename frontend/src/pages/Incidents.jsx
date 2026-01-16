import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Zap, Activity, Brain, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Incidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [actions, setActions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await axios.get(`${API}/incidents?limit=50`);
      setIncidents(response.data.incidents || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      setLoading(false);
    }
  };

  const fetchActions = async (incidentId) => {
    try {
      const response = await axios.get(`${API}/actions?incident_id=${incidentId}`);
      setActions(response.data.actions || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    }
  };

  const analyzeIncident = async (incidentId) => {
    setAnalyzing(true);
    try {
      await axios.post(`${API}/ai/analyze?incident_id=${incidentId}`);
      await axios.post(`${API}/ai/recommend?incident_id=${incidentId}`);
      await fetchIncidents();
      await fetchActions(incidentId);
      toast.success('AI analysis completed');
    } catch (error) {
      console.error('Error analyzing incident:', error);
      toast.error('Analysis failed');
    }
    setAnalyzing(false);
  };

  const approveAction = async (actionId) => {
    try {
      await axios.post(`${API}/actions/${actionId}/approve`, {
        approved_by: 'Admin User'
      });
      await fetchActions(selectedIncident.id);
      toast.success('Action approved and executed');
    } catch (error) {
      console.error('Error approving action:', error);
      toast.error('Approval failed');
    }
  };

  const rejectAction = async (actionId) => {
    try {
      await axios.post(`${API}/actions/${actionId}/reject`);
      await fetchActions(selectedIncident.id);
      toast.success('Action rejected');
    } catch (error) {
      console.error('Error rejecting action:', error);
      toast.error('Rejection failed');
    }
  };

  const selectIncident = (incident) => {
    setSelectedIncident(incident);
    fetchActions(incident.id);
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
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="incidents-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">Incidents</h1>
        <p className="text-base text-muted-foreground mt-2">
          AI-powered root cause analysis and recommendations
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents List */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-bold tracking-tight mb-6">All Incidents</h2>
          
          {incidents.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No incidents found</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="incidents-list">
              {incidents.map((incident, index) => (
                <IncidentCard
                  key={index}
                  incident={incident}
                  isSelected={selectedIncident?.id === incident.id}
                  onClick={() => selectIncident(incident)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Incident Details */}
        <div className="glass-card rounded-xl p-6">
          {selectedIncident ? (
            <div data-testid="incident-details">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{selectedIncident.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedIncident.service}</p>
                </div>
                <span className={`text-xs font-mono px-3 py-1 rounded ${
                  selectedIncident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  selectedIncident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {selectedIncident.severity}
                </span>
              </div>

              {/* AI Analysis */}
              {selectedIncident.ai_explanation ? (
                <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-5 h-5 text-accent" />
                    <h3 className="font-bold">AI Root Cause Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedIncident.ai_explanation}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => analyzeIncident(selectedIncident.id)}
                  disabled={analyzing}
                  className="mb-6 w-full px-6 py-3 rounded-md bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 font-medium disabled:opacity-50"
                  data-testid="btn-analyze-incident"
                >
                  {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
                </button>
              )}

              {/* Actions */}
              {actions.length > 0 && (
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    Recommended Actions
                  </h3>
                  <div className="space-y-3" data-testid="actions-list">
                    {actions.map((action, index) => (
                      <ActionCard
                        key={index}
                        action={action}
                        onApprove={approveAction}
                        onReject={rejectAction}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select an incident to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const IncidentCard = ({ incident, isSelected, onClick }) => {
  const statusIcons = {
    open: Clock,
    investigating: Activity,
    resolved: CheckCircle,
  };

  const StatusIcon = statusIcons[incident.status] || Zap;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-white/10 hover:border-white/20 bg-white/5'
      }`}
      data-testid={`incident-${incident.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <StatusIcon className="w-5 h-5 text-primary" />
          <h3 className="font-bold">{incident.title}</h3>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{incident.service}</p>
    </motion.div>
  );
};

const ActionCard = ({ action, onApprove, onReject }) => {
  const riskColors = {
    low: 'text-green-400 bg-green-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    high: 'text-red-400 bg-red-500/10',
  };

  const statusColors = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    approved: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg bg-white/5 border border-white/10"
      data-testid={`action-${action.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-bold">{action.action}</h4>
        <div className="flex gap-2">
          <span className={`text-xs font-mono px-2 py-1 rounded ${riskColors[action.risk_level]}`}>
            {action.risk_level} risk
          </span>
          <span className={`text-xs font-mono px-2 py-1 rounded ${statusColors[action.status]}`}>
            {action.status}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
      <p className="text-sm text-muted-foreground mb-4">
        <span className="font-semibold">Impact:</span> {action.impact}
      </p>
      
      {action.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(action.id)}
            className="flex-1 px-4 py-2 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all font-medium"
            data-testid={`btn-approve-${action.id}`}
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Approve
          </button>
          <button
            onClick={() => onReject(action.id)}
            className="flex-1 px-4 py-2 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all font-medium"
            data-testid={`btn-reject-${action.id}`}
          >
            <XCircle className="w-4 h-4 inline mr-2" />
            Reject
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Incidents;
