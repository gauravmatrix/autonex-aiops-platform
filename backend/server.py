from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random
import numpy as np
from sklearn.ensemble import IsolationForest
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM API Key
llm_api_key = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= Models =============

class SystemMetric(BaseModel):
    model_config = ConfigDict(extra="ignore")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    service: str
    cpu: float
    memory: float
    latency: float
    error_rate: float
    requests_per_sec: float

class Anomaly(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    service: str
    metric_type: str
    severity: str
    confidence: float
    description: str
    value: float
    baseline: float

class Incident(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    status: str
    severity: str
    service: str
    root_cause: Optional[str] = None
    ai_explanation: Optional[str] = None
    recommendations: Optional[List[Dict[str, Any]]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    anomaly_ids: List[str] = []

class Action(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    action: str
    description: str
    risk_level: str
    impact: str
    status: str
    approved_by: Optional[str] = None
    executed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActionApproval(BaseModel):
    approved_by: str

class IncidentCreate(BaseModel):
    title: str
    severity: str
    service: str
    anomaly_ids: List[str] = []

# ============= In-Memory Anomaly Detection Model =============

class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        self.is_trained = False
        self.baseline_data = []
    
    def train(self, metrics_data: List[List[float]]):
        """Train the model on historical metrics"""
        if len(metrics_data) > 20:
            self.model.fit(metrics_data)
            self.is_trained = True
            # Calculate baseline averages
            self.baseline_data = np.mean(metrics_data, axis=0).tolist()
            logger.info(f"Anomaly detector trained on {len(metrics_data)} samples")
    
    def detect(self, metric: List[float]) -> tuple[bool, float]:
        """Detect if a metric is anomalous"""
        if not self.is_trained:
            return False, 0.5
        
        try:
            prediction = self.model.predict([metric])[0]
            score = self.model.score_samples([metric])[0]
            # Convert score to confidence (0-1)
            confidence = 1 / (1 + np.exp(score))  # Sigmoid transformation
            is_anomaly = prediction == -1
            return is_anomaly, float(confidence)
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return False, 0.5

# Global anomaly detector
anomaly_detector = AnomalyDetector()

# ============= Simulation & Demo Mode =============

class DataSimulator:
    """Simulates realistic system metrics with optional failures"""
    
    def __init__(self):
        self.services = ["api-gateway", "auth-service", "database", "cache", "worker"]
        self.failure_mode = False
        self.failure_service = None
        self.failure_start = None
    
    def generate_metric(self, service: str) -> SystemMetric:
        """Generate realistic system metrics"""
        base_time = datetime.now(timezone.utc)
        
        # Normal operation ranges
        cpu = random.uniform(20, 50)
        memory = random.uniform(30, 60)
        latency = random.uniform(50, 150)
        error_rate = random.uniform(0, 2)
        rps = random.uniform(100, 500)
        
        # Inject failure if in failure mode
        if self.failure_mode and service == self.failure_service:
            elapsed = (datetime.now(timezone.utc) - self.failure_start).total_seconds()
            intensity = min(elapsed / 60, 1)  # Ramp up over 1 minute
            
            cpu = random.uniform(70 + intensity * 20, 95)
            memory = random.uniform(70 + intensity * 20, 95)
            latency = random.uniform(300 + intensity * 700, 1000)
            error_rate = random.uniform(10 + intensity * 30, 50)
            rps = random.uniform(50, 100)
        
        return SystemMetric(
            timestamp=base_time,
            service=service,
            cpu=cpu,
            memory=memory,
            latency=latency,
            error_rate=error_rate,
            requests_per_sec=rps
        )
    
    def inject_failure(self, service: str):
        """Start a failure scenario"""
        self.failure_mode = True
        self.failure_service = service
        self.failure_start = datetime.now(timezone.utc)
        logger.info(f"Failure injected for service: {service}")
    
    def clear_failure(self):
        """Clear failure mode"""
        self.failure_mode = False
        self.failure_service = None
        self.failure_start = None
        logger.info("Failure mode cleared")

# Global simulator
data_simulator = DataSimulator()

# ============= Background Tasks =============

async def simulate_metrics_stream():
    """Background task to continuously generate metrics"""
    while True:
        try:
            for service in data_simulator.services:
                metric = data_simulator.generate_metric(service)
                metric_dict = metric.model_dump()
                metric_dict['timestamp'] = metric_dict['timestamp'].isoformat()
                await db.metrics.insert_one(metric_dict)
            
            await asyncio.sleep(5)  # Generate metrics every 5 seconds
        except Exception as e:
            logger.error(f"Metrics simulation error: {e}")
            await asyncio.sleep(5)

async def train_anomaly_detector():
    """Background task to periodically retrain the anomaly detector"""
    while True:
        try:
            await asyncio.sleep(30)  # Train every 30 seconds
            
            # Fetch recent metrics
            metrics = await db.metrics.find({}, {"_id": 0}).sort("timestamp", -1).limit(200).to_list(200)
            
            if len(metrics) > 50:
                # Prepare training data
                training_data = [
                    [m['cpu'], m['memory'], m['latency'], m['error_rate'], m['requests_per_sec']]
                    for m in metrics
                ]
                anomaly_detector.train(training_data)
        except Exception as e:
            logger.error(f"Anomaly detector training error: {e}")

# ============= API Routes =============

@api_router.get("/")
async def root():
    return {"message": "AUTONEX AIOps Platform API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "database": "connected",
            "anomaly_detector": "trained" if anomaly_detector.is_trained else "initializing",
            "simulator": "active" if data_simulator.failure_mode else "normal"
        }
    }

# ============= Metrics Endpoints =============

@api_router.get("/metrics/latest")
async def get_latest_metrics():
    """Get latest metrics for all services"""
    try:
        latest_metrics = []
        for service in data_simulator.services:
            metric = await db.metrics.find_one(
                {"service": service},
                {"_id": 0},
                sort=[("timestamp", -1)]
            )
            if metric:
                latest_metrics.append(metric)
        return {"metrics": latest_metrics}
    except Exception as e:
        logger.error(f"Error fetching latest metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/metrics/timeseries")
async def get_metrics_timeseries(service: str, hours: int = 1):
    """Get time-series metrics for a service"""
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        metrics = await db.metrics.find(
            {"service": service, "timestamp": {"$gte": since.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        return {"service": service, "metrics": metrics}
    except Exception as e:
        logger.error(f"Error fetching timeseries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/metrics/services")
async def get_services():
    """Get list of all monitored services"""
    return {"services": data_simulator.services}

# ============= Anomaly Endpoints =============

@api_router.post("/anomalies/detect")
async def detect_anomalies():
    """Run anomaly detection on latest metrics"""
    try:
        detected_anomalies = []
        
        for service in data_simulator.services:
            metric = await db.metrics.find_one(
                {"service": service},
                {"_id": 0},
                sort=[("timestamp", -1)]
            )
            
            if not metric:
                continue
            
            # Prepare feature vector
            features = [
                metric['cpu'],
                metric['memory'],
                metric['latency'],
                metric['error_rate'],
                metric['requests_per_sec']
            ]
            
            # Detect anomaly
            is_anomaly, confidence = anomaly_detector.detect(features)
            
            if is_anomaly:
                # Determine which metric is most anomalous
                baseline = anomaly_detector.baseline_data if anomaly_detector.baseline_data else features
                deviations = [
                    abs(features[i] - baseline[i]) / (baseline[i] + 1) if i < len(baseline) else 0
                    for i in range(len(features))
                ]
                max_deviation_idx = np.argmax(deviations)
                metric_names = ['cpu', 'memory', 'latency', 'error_rate', 'requests_per_sec']
                anomalous_metric = metric_names[max_deviation_idx]
                
                # Determine severity
                severity = "critical" if confidence > 0.8 else "high" if confidence > 0.6 else "medium"
                
                anomaly = Anomaly(
                    timestamp=datetime.fromisoformat(metric['timestamp']),
                    service=service,
                    metric_type=anomalous_metric,
                    severity=severity,
                    confidence=confidence,
                    description=f"Anomalous {anomalous_metric} detected",
                    value=features[max_deviation_idx],
                    baseline=baseline[max_deviation_idx] if max_deviation_idx < len(baseline) else features[max_deviation_idx]
                )
                
                # Save to database
                anomaly_dict = anomaly.model_dump()
                anomaly_dict['timestamp'] = anomaly_dict['timestamp'].isoformat()
                await db.anomalies.insert_one(anomaly_dict)
                
                detected_anomalies.append(anomaly)
        
        return {
            "detected": len(detected_anomalies),
            "anomalies": [a.model_dump() for a in detected_anomalies]
        }
    except Exception as e:
        logger.error(f"Error detecting anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/anomalies")
async def get_anomalies(hours: int = 24, limit: int = 100):
    """Get recent anomalies"""
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        anomalies = await db.anomalies.find(
            {"timestamp": {"$gte": since.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        return {"anomalies": anomalies}
    except Exception as e:
        logger.error(f"Error fetching anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= Incident Endpoints =============

@api_router.post("/incidents")
async def create_incident(incident: IncidentCreate):
    """Create a new incident"""
    try:
        # Add default status for new incidents
        incident_data = incident.model_dump()
        incident_data['status'] = 'open'
        new_incident = Incident(**incident_data)
        incident_dict = new_incident.model_dump()
        incident_dict['created_at'] = incident_dict['created_at'].isoformat()
        await db.incidents.insert_one(incident_dict)
        return new_incident
    except Exception as e:
        logger.error(f"Error creating incident: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/incidents")
async def get_incidents(status: Optional[str] = None, limit: int = 50):
    """Get incidents"""
    try:
        query = {} if not status else {"status": status}
        incidents = await db.incidents.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return {"incidents": incidents}
    except Exception as e:
        logger.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Get specific incident"""
    try:
        incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        return incident
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching incident: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/incidents/{incident_id}")
async def update_incident(incident_id: str, updates: Dict[str, Any]):
    """Update incident"""
    try:
        if 'resolved_at' in updates and updates['resolved_at']:
            updates['resolved_at'] = datetime.now(timezone.utc).isoformat()
        
        result = await db.incidents.update_one(
            {"id": incident_id},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
        return incident
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating incident: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= AI Analysis Endpoints =============

@api_router.post("/ai/analyze")
async def analyze_incident(incident_id: str):
    """Use AI to analyze incident and generate explanation"""
    try:
        # Fetch incident
        incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        # Fetch related anomalies
        anomalies = []
        if incident.get('anomaly_ids'):
            anomalies = await db.anomalies.find(
                {"id": {"$in": incident['anomaly_ids']}},
                {"_id": 0}
            ).to_list(100)
        
        # Fetch recent metrics for the service
        recent_metrics = await db.metrics.find(
            {"service": incident['service']},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        # Build context for AI
        context = f"""
Incident Analysis Request:

Incident Title: {incident['title']}
Service: {incident['service']}
Severity: {incident['severity']}
Status: {incident['status']}

Detected Anomalies:
"""
        for anomaly in anomalies:
            context += f"\n- {anomaly['metric_type']}: {anomaly['description']} (confidence: {anomaly['confidence']:.2f})"
            context += f"\n  Value: {anomaly['value']:.2f}, Baseline: {anomaly['baseline']:.2f}"
        
        context += "\n\nRecent Metrics (last 10 samples):\n"
        for i, metric in enumerate(recent_metrics[:3]):
            context += f"\nSample {i+1}: CPU={metric['cpu']:.1f}%, Memory={metric['memory']:.1f}%, "
            context += f"Latency={metric['latency']:.1f}ms, Error Rate={metric['error_rate']:.1f}%"
        
        context += "\n\nPlease provide:\n1. Root cause analysis\n2. Impact assessment\n3. Recommended actions"
        
        # Call LLM
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"incident-{incident_id}",
            system_message="You are an expert SRE analyzing system incidents. Provide clear, actionable analysis."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=context)
        response = await chat.send_message(user_message)
        
        # Update incident with AI analysis
        await db.incidents.update_one(
            {"id": incident_id},
            {"$set": {"ai_explanation": response}}
        )
        
        return {
            "incident_id": incident_id,
            "analysis": response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/ai/recommend")
async def generate_recommendations(incident_id: str):
    """Generate AI-powered action recommendations"""
    try:
        incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        # Build context
        context = f"""
Incident: {incident['title']}
Service: {incident['service']}
Severity: {incident['severity']}
"""
        if incident.get('ai_explanation'):
            context += f"\nAnalysis: {incident['ai_explanation']}"
        
        context += "\n\nGenerate 3 specific remediation actions. For each action provide:\n"
        context += "- Action name (brief)\n- Description (1-2 sentences)\n"
        context += "- Risk level (low/medium/high)\n- Expected impact\n"
        context += "\nFormat as JSON array with keys: action, description, risk_level, impact"
        
        # Call LLM
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"recommend-{incident_id}",
            system_message="You are an expert SRE. Provide practical remediation actions in JSON format."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=context)
        response = await chat.send_message(user_message)
        
        # Parse recommendations
        import json
        try:
            # Try to extract JSON from response
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                recommendations = json.loads(response[json_start:json_end])
            else:
                # Fallback to default recommendations
                recommendations = [
                    {
                        "action": "Scale Resources",
                        "description": "Increase CPU and memory allocation for the affected service",
                        "risk_level": "low",
                        "impact": "Improved performance and reduced error rates"
                    },
                    {
                        "action": "Restart Service",
                        "description": "Perform a rolling restart of the service instances",
                        "risk_level": "medium",
                        "impact": "Clears memory leaks and resets connections"
                    },
                    {
                        "action": "Review Recent Changes",
                        "description": "Investigate and potentially rollback recent deployments",
                        "risk_level": "low",
                        "impact": "Identifies root cause if related to recent changes"
                    }
                ]
        except:
            recommendations = [
                {
                    "action": "Scale Resources",
                    "description": "Increase CPU and memory allocation",
                    "risk_level": "low",
                    "impact": "Improved performance"
                }
            ]
        
        # Update incident
        await db.incidents.update_one(
            {"id": incident_id},
            {"$set": {"recommendations": recommendations}}
        )
        
        # Create action items
        for rec in recommendations:
            action = Action(
                incident_id=incident_id,
                action=rec['action'],
                description=rec['description'],
                risk_level=rec['risk_level'],
                impact=rec['impact'],
                status="pending"
            )
            action_dict = action.model_dump()
            action_dict['created_at'] = action_dict['created_at'].isoformat()
            await db.actions.insert_one(action_dict)
        
        return {
            "incident_id": incident_id,
            "recommendations": recommendations
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= Action Endpoints =============

@api_router.get("/actions")
async def get_actions(incident_id: Optional[str] = None, status: Optional[str] = None):
    """Get actions"""
    try:
        query = {}
        if incident_id:
            query['incident_id'] = incident_id
        if status:
            query['status'] = status
        
        actions = await db.actions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"actions": actions}
    except Exception as e:
        logger.error(f"Error fetching actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/actions/{action_id}/approve")
async def approve_action(action_id: str, approval: ActionApproval):
    """Approve and execute an action"""
    try:
        result = await db.actions.update_one(
            {"id": action_id},
            {"$set": {
                "status": "approved",
                "approved_by": approval.approved_by,
                "executed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Action not found")
        
        action = await db.actions.find_one({"id": action_id}, {"_id": 0})
        return action
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/actions/{action_id}/reject")
async def reject_action(action_id: str):
    """Reject an action"""
    try:
        result = await db.actions.update_one(
            {"id": action_id},
            {"$set": {"status": "rejected"}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Action not found")
        
        action = await db.actions.find_one({"id": action_id}, {"_id": 0})
        return action
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= Demo Mode Endpoints =============

@api_router.post("/demo/inject-failure")
async def inject_failure(service: str):
    """Inject a failure into a service for demo purposes"""
    if service not in data_simulator.services:
        raise HTTPException(status_code=400, detail=f"Invalid service. Must be one of {data_simulator.services}")
    
    data_simulator.inject_failure(service)
    return {
        "message": f"Failure injected into {service}",
        "service": service,
        "status": "active"
    }

@api_router.post("/demo/clear-failure")
async def clear_failure():
    """Clear demo failure mode"""
    data_simulator.clear_failure()
    return {
        "message": "Failure mode cleared",
        "status": "normal"
    }

@api_router.get("/demo/status")
async def demo_status():
    """Get demo mode status"""
    return {
        "failure_mode": data_simulator.failure_mode,
        "affected_service": data_simulator.failure_service,
        "services": data_simulator.services
    }

# ============= Stats Endpoints =============

@api_router.get("/stats/dashboard")
async def get_dashboard_stats():
    """Get statistics for dashboard"""
    try:
        # Count incidents by status
        active_incidents = await db.incidents.count_documents({"status": "open"})
        total_incidents = await db.incidents.count_documents({})
        
        # Count recent anomalies
        since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_anomalies = await db.anomalies.count_documents(
            {"timestamp": {"$gte": since_24h.isoformat()}}
        )
        
        # Count pending actions
        pending_actions = await db.actions.count_documents({"status": "pending"})
        
        # Get service health
        service_health = []
        for service in data_simulator.services:
            metric = await db.metrics.find_one(
                {"service": service},
                {"_id": 0},
                sort=[("timestamp", -1)]
            )
            
            if metric:
                # Determine health status
                health = "healthy"
                if metric['cpu'] > 80 or metric['memory'] > 80 or metric['error_rate'] > 10:
                    health = "critical"
                elif metric['cpu'] > 60 or metric['memory'] > 60 or metric['error_rate'] > 5:
                    health = "warning"
                
                service_health.append({
                    "service": service,
                    "status": health,
                    "cpu": metric['cpu'],
                    "memory": metric['memory'],
                    "latency": metric['latency'],
                    "error_rate": metric['error_rate']
                })
        
        return {
            "active_incidents": active_incidents,
            "total_incidents": total_incidents,
            "recent_anomalies": recent_anomalies,
            "pending_actions": pending_actions,
            "service_health": service_health,
            "anomaly_detector_status": "trained" if anomaly_detector.is_trained else "training"
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= Startup & Shutdown Events =============

@app.on_event("startup")
async def startup_event():
    logger.info("Starting AUTONEX AIOps Platform")
    # Start background tasks
    asyncio.create_task(simulate_metrics_stream())
    asyncio.create_task(train_anomaly_detector())
    logger.info("Background tasks started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AUTONEX AIOps Platform")
    client.close()