import sys
import os
import unittest
import base64
from unittest.mock import MagicMock, patch, ANY

# Add apps/backend and workers/vision_agent to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/backend')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../workers/vision_agent')))

from fastapi.testclient import TestClient
from main import app
from dependencies.db import get_db
from dependencies.auth import require_internal_worker

class TestVisionAgent(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        
        # Override FastAPI dependencies
        app.dependency_overrides[get_db] = lambda: self.mock_db
        app.dependency_overrides[require_internal_worker] = lambda: "dev-internal-key"

    def tearDown(self):
        app.dependency_overrides.clear()
        if "SIMULATE_VIOLATION" in os.environ:
            del os.environ["SIMULATE_VIOLATION"]
        if "MOCK_WEBCAM" in os.environ:
            del os.environ["MOCK_WEBCAM"]

    def test_fire_vision_alert_unauthorized(self):
        # Clear override for require_internal_worker to test authentication rejection
        if require_internal_worker in app.dependency_overrides:
            del app.dependency_overrides[require_internal_worker]
            
        payload = {
            "agent_id": "agent_print_room_1",
            "location_type": "print_room",
            "location_id": "00000000-0000-0000-0000-00000000000c",
            "detected_class": "cell phone",
            "confidence": 0.89,
            "frame_jpeg_b64": base64.b64encode(b"dummy jpeg data").decode('utf-8')
        }
        
        # Call without header (returns 422 because header is required)
        response = self.client.post("/api/v1/vision/alert", json=payload)
        self.assertEqual(response.status_code, 422)
        
        # Call with invalid header (returns 403)
        headers = {"X-Internal-API-Key": "invalid-key"}
        response = self.client.post("/api/v1/vision/alert", json=payload, headers=headers)
        self.assertEqual(response.status_code, 403)

    @patch("api.v1.vision.broadcast_realtime_event")
    def test_fire_vision_alert_print_room_abort(self, mock_broadcast):
        # Mock active print job lookup
        active_jobs = [{
            "id": "00000000-0000-0000-0000-0000000000ff",
            "operator_id": "d0000000-0000-0000-0000-000000000001"
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.in_.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=active_jobs)
        
        # Mock Storage
        mock_storage = MagicMock()
        self.mock_db.storage.from_.return_value = mock_storage
        
        payload = {
            "agent_id": "agent_print_room_1",
            "location_type": "print_room",
            "location_id": "00000000-0000-0000-0000-00000000000c",
            "detected_class": "cell phone",
            "confidence": 0.89,
            "frame_jpeg_b64": base64.b64encode(b"dummy jpeg data").decode('utf-8')
        }
        
        headers = {"X-Internal-API-Key": "dev-internal-key"}
        response = self.client.post("/api/v1/vision/alert", json=payload, headers=headers)
        
        self.assertEqual(response.status_code, 201)
        resp_json = response.json()
        self.assertTrue(resp_json["success"])
        self.assertTrue(resp_json["data"]["triggered_abort"])
        
        # Check print job abort update was called
        mock_table.update.assert_called()
        # Check realtime alert and abort events were broadcast
        mock_broadcast.assert_any_call("print_room", "print_job_aborted", {"job_id": "00000000-0000-0000-0000-0000000000ff", "reason": "vision_alert"})
        mock_broadcast.assert_any_call("vision_alerts", "vision_alert_fired", ANY)

    @patch("api.v1.vision.broadcast_realtime_event")
    def test_fire_vision_alert_exam_hall_no_abort(self, mock_broadcast):
        # Mock Storage
        mock_storage = MagicMock()
        self.mock_db.storage.from_.return_value = mock_storage
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        
        payload = {
            "agent_id": "agent_exam_hall_1",
            "location_type": "exam_hall",
            "location_id": "00000000-0000-0000-0000-00000000000d",
            "detected_class": "cell phone",
            "confidence": 0.82,
            "frame_jpeg_b64": base64.b64encode(b"dummy jpeg data").decode('utf-8')
        }
        
        headers = {"X-Internal-API-Key": "dev-internal-key"}
        response = self.client.post("/api/v1/vision/alert", json=payload, headers=headers)
        
        self.assertEqual(response.status_code, 201)
        resp_json = response.json()
        self.assertTrue(resp_json["success"])
        self.assertFalse(resp_json["data"]["triggered_abort"])
        
        # Check print job abort update was NOT called
        mock_table.update.assert_not_called()
        # Check alert event was broadcast
        mock_broadcast.assert_called_once_with("vision_alerts", "vision_alert_fired", ANY)

    @patch("agent.YOLO")
    @patch("httpx.post")
    def test_agent_script_simulation(self, mock_post, mock_yolo_class):
        # Set environment to trigger simulation and avoid OpenCV camera init
        os.environ["SIMULATE_VIOLATION"] = "true"
        
        # Mock YOLO model methods
        mock_model = MagicMock()
        mock_model.names = {67: "cell phone"}
        mock_yolo_class.return_value = mock_model
        
        # Mock HTTP response
        mock_post.return_value = MagicMock(status_code=201, text='{"success": true}')
        
        # Mock sys.argv
        test_args = [
            "agent.py",
            "--location-type", "print_room",
            "--location-id", "00000000-0000-0000-0000-00000000000c",
            "--api-base-url", "http://127.0.0.1:8000",
            "--internal-api-key", "dev-internal-key"
        ]
        
        with patch.object(sys, 'argv', test_args):
            import agent
            # Call agent main which runs the simulation and exits
            agent.main()
            
        # Assert httpx was called to send alert
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        self.assertIn("api/v1/vision/alert", call_args[0])
        self.assertEqual(call_kwargs["headers"]["X-Internal-API-Key"], "dev-internal-key")

if __name__ == "__main__":
    unittest.main()
