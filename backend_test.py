#!/usr/bin/env python3
"""
AUTONEX AIOps Platform Backend API Testing Suite
Tests all backend endpoints for functionality and integration
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List, Any

# Use the public endpoint from frontend .env
BACKEND_URL = "https://nexus-aiops.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class AUTONEXAPITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            self.failed_tests.append({"test": test_name, "details": details})
            print(f"❌ {test_name}: FAILED - {details}")
        
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return success, response data, status code"""
        url = f"{API_BASE}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            else:
                return False, {}, 0
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            return response.status_code < 400, response_data, response.status_code
        
        except Exception as e:
            return False, {"error": str(e)}, 0
    
    def test_health_check(self):
        """Test basic health endpoint"""
        success, data, status = self.make_request('GET', '/health')
        if success and data.get('status') == 'healthy':
            self.log_test("Health Check", True)
            return True
        else:
            self.log_test("Health Check", False, f"Status: {status}, Data: {data}")
            return False
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, data, status = self.make_request('GET', '/')
        if success and 'AUTONEX' in str(data.get('message', '')):
            self.log_test("Root Endpoint", True)
            return True
        else:
            self.log_test("Root Endpoint", False, f"Status: {status}, Data: {data}")
            return False
    
    def test_metrics_endpoints(self):
        """Test all metrics-related endpoints"""
        # Test services list
        success, data, status = self.make_request('GET', '/metrics/services')
        if success and 'services' in data:
            services = data['services']
            self.log_test("Get Services List", True, f"Found {len(services)} services")
        else:
            self.log_test("Get Services List", False, f"Status: {status}, Data: {data}")
            return False
        
        # Test latest metrics
        success, data, status = self.make_request('GET', '/metrics/latest')
        if success and 'metrics' in data:
            metrics = data['metrics']
            self.log_test("Get Latest Metrics", True, f"Retrieved {len(metrics)} metrics")
        else:
            self.log_test("Get Latest Metrics", False, f"Status: {status}, Data: {data}")
        
        # Test timeseries for first service
        if services:
            service = services[0]
            success, data, status = self.make_request('GET', '/metrics/timeseries', params={'service': service, 'hours': 1})
            if success and 'metrics' in data:
                self.log_test("Get Timeseries Metrics", True, f"Retrieved timeseries for {service}")
            else:
                self.log_test("Get Timeseries Metrics", False, f"Status: {status}, Data: {data}")
        
        return True
    
    def test_anomaly_detection(self):
        """Test anomaly detection endpoints"""
        # Get existing anomalies
        success, data, status = self.make_request('GET', '/anomalies', params={'hours': 24, 'limit': 50})
        if success and 'anomalies' in data:
            existing_count = len(data['anomalies'])
            self.log_test("Get Anomalies", True, f"Found {existing_count} existing anomalies")
        else:
            self.log_test("Get Anomalies", False, f"Status: {status}, Data: {data}")
        
        # Run anomaly detection
        success, data, status = self.make_request('POST', '/anomalies/detect')
        if success and 'detected' in data:
            detected_count = data['detected']
            self.log_test("Run Anomaly Detection", True, f"Detected {detected_count} new anomalies")
            return data.get('anomalies', [])
        else:
            self.log_test("Run Anomaly Detection", False, f"Status: {status}, Data: {data}")
            return []
    
    def test_incident_management(self):
        """Test incident creation and management"""
        # Get existing incidents
        success, data, status = self.make_request('GET', '/incidents', params={'limit': 50})
        if success and 'incidents' in data:
            existing_incidents = data['incidents']
            self.log_test("Get Incidents", True, f"Found {len(existing_incidents)} existing incidents")
        else:
            self.log_test("Get Incidents", False, f"Status: {status}, Data: {data}")
            existing_incidents = []
        
        # Create a test incident
        incident_data = {
            "title": "Test Performance Issue",
            "severity": "high",
            "service": "api-gateway",
            "anomaly_ids": []
        }
        
        success, data, status = self.make_request('POST', '/incidents', data=incident_data)
        if success and 'id' in data:
            incident_id = data['id']
            self.log_test("Create Incident", True, f"Created incident {incident_id}")
            
            # Test get specific incident
            success, data, status = self.make_request('GET', f'/incidents/{incident_id}')
            if success and data.get('id') == incident_id:
                self.log_test("Get Specific Incident", True)
            else:
                self.log_test("Get Specific Incident", False, f"Status: {status}, Data: {data}")
            
            # Test update incident
            update_data = {"status": "investigating"}
            success, data, status = self.make_request('PATCH', f'/incidents/{incident_id}', data=update_data)
            if success and data.get('status') == 'investigating':
                self.log_test("Update Incident", True)
            else:
                self.log_test("Update Incident", False, f"Status: {status}, Data: {data}")
            
            return incident_id
        else:
            self.log_test("Create Incident", False, f"Status: {status}, Data: {data}")
            return None
    
    def test_ai_analysis(self, incident_id: str):
        """Test AI analysis endpoints"""
        if not incident_id:
            self.log_test("AI Analysis", False, "No incident ID provided")
            return
        
        # Test AI analyze
        success, data, status = self.make_request('POST', '/ai/analyze', params={'incident_id': incident_id})
        if success and 'analysis' in data:
            self.log_test("AI Root Cause Analysis", True, "Analysis completed")
        else:
            self.log_test("AI Root Cause Analysis", False, f"Status: {status}, Data: {data}")
        
        # Wait a moment for analysis to complete
        time.sleep(2)
        
        # Test AI recommendations
        success, data, status = self.make_request('POST', '/ai/recommend', params={'incident_id': incident_id})
        if success and 'recommendations' in data:
            recommendations = data['recommendations']
            self.log_test("AI Recommendations", True, f"Generated {len(recommendations)} recommendations")
            return recommendations
        else:
            self.log_test("AI Recommendations", False, f"Status: {status}, Data: {data}")
            return []
    
    def test_action_workflow(self, incident_id: str):
        """Test action approval workflow"""
        if not incident_id:
            self.log_test("Action Workflow", False, "No incident ID provided")
            return
        
        # Get actions for incident
        success, data, status = self.make_request('GET', '/actions', params={'incident_id': incident_id})
        if success and 'actions' in data:
            actions = data['actions']
            self.log_test("Get Actions", True, f"Found {len(actions)} actions")
            
            if actions:
                action_id = actions[0]['id']
                
                # Test approve action
                approval_data = {"approved_by": "Test User"}
                success, data, status = self.make_request('POST', f'/actions/{action_id}/approve', data=approval_data)
                if success and data.get('status') == 'approved':
                    self.log_test("Approve Action", True)
                else:
                    self.log_test("Approve Action", False, f"Status: {status}, Data: {data}")
        else:
            self.log_test("Get Actions", False, f"Status: {status}, Data: {data}")
    
    def test_demo_mode(self):
        """Test demo mode endpoints"""
        # Get demo status
        success, data, status = self.make_request('GET', '/demo/status')
        if success and 'failure_mode' in data:
            self.log_test("Get Demo Status", True, f"Failure mode: {data['failure_mode']}")
        else:
            self.log_test("Get Demo Status", False, f"Status: {status}, Data: {data}")
        
        # Test inject failure
        success, data, status = self.make_request('POST', '/demo/inject-failure', params={'service': 'api-gateway'})
        if success and 'message' in data:
            self.log_test("Inject Demo Failure", True)
            
            # Wait a moment
            time.sleep(2)
            
            # Test clear failure
            success, data, status = self.make_request('POST', '/demo/clear-failure')
            if success and 'message' in data:
                self.log_test("Clear Demo Failure", True)
            else:
                self.log_test("Clear Demo Failure", False, f"Status: {status}, Data: {data}")
        else:
            self.log_test("Inject Demo Failure", False, f"Status: {status}, Data: {data}")
    
    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        success, data, status = self.make_request('GET', '/stats/dashboard')
        if success and 'service_health' in data:
            service_health = data['service_health']
            self.log_test("Dashboard Stats", True, f"Retrieved stats for {len(service_health)} services")
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}, Data: {data}")
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting AUTONEX AIOps Platform Backend Tests")
        print(f"📡 Testing endpoint: {BACKEND_URL}")
        print("=" * 60)
        
        # Basic connectivity tests
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return self.generate_report()
        
        self.test_root_endpoint()
        
        # Core functionality tests
        self.test_metrics_endpoints()
        anomalies = self.test_anomaly_detection()
        incident_id = self.test_incident_management()
        
        # AI and workflow tests
        if incident_id:
            recommendations = self.test_ai_analysis(incident_id)
            self.test_action_workflow(incident_id)
        
        # Demo and dashboard tests
        self.test_demo_mode()
        self.test_dashboard_stats()
        
        return self.generate_report()
    
    def generate_report(self):
        """Generate final test report"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests ({len(self.failed_tests)}):")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['details']}")
        
        # Determine overall status
        if success_rate >= 90:
            overall_status = "EXCELLENT"
        elif success_rate >= 75:
            overall_status = "GOOD"
        elif success_rate >= 50:
            overall_status = "NEEDS ATTENTION"
        else:
            overall_status = "CRITICAL ISSUES"
        
        print(f"\n🎯 Overall Status: {overall_status}")
        
        return {
            "tests_run": self.tests_run,
            "tests_passed": self.tests_passed,
            "success_rate": success_rate,
            "failed_tests": self.failed_tests,
            "overall_status": overall_status,
            "detailed_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = AUTONEXAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Return appropriate exit code
    return 0 if results['success_rate'] >= 75 else 1

if __name__ == "__main__":
    sys.exit(main())