import sys
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# Add apps/backend to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/backend')))

from fastapi.testclient import TestClient
from main import app
from dependencies.db import get_db
from dependencies.auth import get_current_user, require_print_operator, AuthenticatedUser
from services.vault_cache import DECRYPTED_PAPER_CACHE

class TestPrintSpooler(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        
        # Default mock user (Print Operator)
        self.mock_operator = AuthenticatedUser(
            user_id="d0000000-0000-0000-0000-000000000001",
            email="operator@leakguard.ai",
            role="print_operator"
        )
        
        # Override FastAPI dependencies
        app.dependency_overrides[get_db] = lambda: self.mock_db
        app.dependency_overrides[require_print_operator] = lambda: self.mock_operator
        app.dependency_overrides[get_current_user] = lambda: self.mock_operator
        
        # Clear cache before each test
        DECRYPTED_PAPER_CACHE.clear()

    def tearDown(self):
        app.dependency_overrides.clear()
        DECRYPTED_PAPER_CACHE.clear()

    @patch("services.print_service.execute_spool_print")
    @patch("services.print_service.broadcast_realtime_event")
    def test_create_print_job_success(self, mock_broadcast, mock_spool):
        session_id = "00000000-0000-0000-0000-00000000000a"
        paper_id = "00000000-0000-0000-0000-00000000000b"
        center_id = "00000000-0000-0000-0000-00000000000c"
        
        # Add dummy PDF bytes to RAM cache
        # We need a small mock PDF format for PyMuPDF to open, or mock the PDF compilation.
        # Actually, let's create a minimal 1-page PDF using PyMuPDF and write it to the cache.
        import fitz
        doc = fitz.open()
        doc.new_page()
        pdf_bytes = doc.write()
        doc.close()
        
        DECRYPTED_PAPER_CACHE[session_id] = pdf_bytes
        
        # Mock DB select for print sessions
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        session_data = [{
            "id": session_id,
            "paper_id": paper_id,
            "is_active": True,
            "expires_at": future_expiry,
            "authorized_centers": [center_id],
            "authorized_copies": 100
        }]
        
        # Mock DB select for existing print jobs under session
        existing_jobs = [
            {"copies_requested": 40},
            {"copies_requested": 30}
        ]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.neq.return_value = mock_table
        
        def execute_side_effect():
            # Return session_data on print_sessions query, existing_jobs on print_jobs query
            call_args = self.mock_db.table.call_args[0][0]
            if call_args == "print_sessions":
                return MagicMock(data=session_data)
            elif call_args == "print_jobs":
                return MagicMock(data=existing_jobs)
            return MagicMock(data=[{"id": "dummy"}])
            
        mock_table.execute.side_effect = execute_side_effect
        
        # Payload requesting 20 copies (Total: 40 + 30 + 20 = 90 <= 100 limit)
        payload = {
            "paper_id": paper_id,
            "session_id": session_id,
            "center_id": center_id,
            "printer_id": "printer-secure-1",
            "copies_requested": 20
        }
        
        response = self.client.post("/api/v1/print/jobs", json=payload)
        
        self.assertEqual(response.status_code, 201)
        resp_json = response.json()
        self.assertTrue(resp_json["success"])
        self.assertEqual(resp_json["data"]["copies_printed"], 20)
        self.assertEqual(resp_json["data"]["status"], "completed")
        
        mock_spool.assert_called_once()
        mock_broadcast.assert_any_call("print_room", "print_job_completed", {"job_id": resp_json["data"]["job_id"]})

    def test_create_print_job_expired_session(self):
        session_id = "00000000-0000-0000-0000-00000000000a"
        paper_id = "00000000-0000-0000-0000-00000000000b"
        center_id = "00000000-0000-0000-0000-00000000000c"
        
        # Expiry set to 10 minutes ago
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        session_data = [{
            "id": session_id,
            "paper_id": paper_id,
            "is_active": True,
            "expires_at": past_expiry,
            "authorized_centers": [center_id],
            "authorized_copies": 100
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=session_data)
        
        payload = {
            "paper_id": paper_id,
            "session_id": session_id,
            "center_id": center_id,
            "printer_id": "printer-secure-1",
            "copies_requested": 20
        }
        
        response = self.client.post("/api/v1/print/jobs", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.json()["error"]["message"].lower())

    def test_create_print_job_unauthorized_center(self):
        session_id = "00000000-0000-0000-0000-00000000000a"
        paper_id = "00000000-0000-0000-0000-00000000000b"
        center_id = "00000000-0000-0000-0000-00000000000c"
        unauth_center = "00000000-0000-0000-0000-00000000000d"
        
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        session_data = [{
            "id": session_id,
            "paper_id": paper_id,
            "is_active": True,
            "expires_at": future_expiry,
            "authorized_centers": [center_id],
            "authorized_copies": 100
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=session_data)
        
        payload = {
            "paper_id": paper_id,
            "session_id": session_id,
            "center_id": unauth_center,
            "printer_id": "printer-secure-1",
            "copies_requested": 20
        }
        
        response = self.client.post("/api/v1/print/jobs", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("not authorized", response.json()["error"]["message"].lower())

    def test_create_print_job_exceeds_copies(self):
        session_id = "00000000-0000-0000-0000-00000000000a"
        paper_id = "00000000-0000-0000-0000-00000000000b"
        center_id = "00000000-0000-0000-0000-00000000000c"
        
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        session_data = [{
            "id": session_id,
            "paper_id": paper_id,
            "is_active": True,
            "expires_at": future_expiry,
            "authorized_centers": [center_id],
            "authorized_copies": 100
        }]
        
        # Already printed 90 copies
        existing_jobs = [{"copies_requested": 90}]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.neq.return_value = mock_table
        
        def execute_side_effect():
            call_args = self.mock_db.table.call_args[0][0]
            if call_args == "print_sessions":
                return MagicMock(data=session_data)
            elif call_args == "print_jobs":
                return MagicMock(data=existing_jobs)
            return MagicMock(data=[])
            
        mock_table.execute.side_effect = execute_side_effect
        
        # Requesting 20 copies -> exceeds 100 limit (Total 110)
        payload = {
            "paper_id": paper_id,
            "session_id": session_id,
            "center_id": center_id,
            "printer_id": "printer-secure-1",
            "copies_requested": 20
        }
        
        response = self.client.post("/api/v1/print/jobs", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("exceeds print limit", response.json()["error"]["message"].lower())

    def test_create_print_job_cache_expired(self):
        session_id = "00000000-0000-0000-0000-00000000000a"
        paper_id = "00000000-0000-0000-0000-00000000000b"
        center_id = "00000000-0000-0000-0000-00000000000c"
        
        # RAM cache has no entry (e.g. wiped after expiry)
        self.assertNotIn(session_id, DECRYPTED_PAPER_CACHE)
        
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        session_data = [{
            "id": session_id,
            "paper_id": paper_id,
            "is_active": True,
            "expires_at": future_expiry,
            "authorized_centers": [center_id],
            "authorized_copies": 100
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.neq.return_value = mock_table
        
        def execute_side_effect():
            call_args = self.mock_db.table.call_args[0][0]
            if call_args == "print_sessions":
                return MagicMock(data=session_data)
            elif call_args == "print_jobs":
                return MagicMock(data=[])
            return MagicMock(data=[])
            
        mock_table.execute.side_effect = execute_side_effect
        
        payload = {
            "paper_id": paper_id,
            "session_id": session_id,
            "center_id": center_id,
            "printer_id": "printer-secure-1",
            "copies_requested": 20
        }
        
        response = self.client.post("/api/v1/print/jobs", json=payload)
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()["error"]["code"], "ERR_SESSION_EXPIRED")

    @patch("services.print_service.broadcast_realtime_event")
    def test_abort_print_job_success(self, mock_broadcast):
        job_id = "00000000-0000-0000-0000-0000000000ff"
        job_data = [{
            "id": job_id,
            "status": "queued",
            "operator_id": self.mock_operator.id,
            "copies_requested": 10
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=job_data)
        
        payload = {"reason": "Webcam alert: mobile phone detected."}
        response = self.client.post(f"/api/v1/print/jobs/{job_id}/abort", json=payload)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        mock_table.update.assert_called_once()
        mock_broadcast.assert_called_once_with("print_room", "print_job_aborted", {"job_id": job_id, "reason": payload["reason"]})

    def test_abort_print_job_forbidden(self):
        job_id = "00000000-0000-0000-0000-0000000000ff"
        # Job created by a different operator
        job_data = [{
            "id": job_id,
            "status": "queued",
            "operator_id": "another-operator-id",
            "copies_requested": 10
        }]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=job_data)
        
        payload = {"reason": "Incorrect print layout."}
        response = self.client.post(f"/api/v1/print/jobs/{job_id}/abort", json=payload)
        
        self.assertEqual(response.status_code, 403)
        self.assertIn("access denied", response.json()["error"]["message"].lower())

    @patch("services.print_service.broadcast_realtime_event")
    def test_abort_print_job_super_admin_bypass(self, mock_broadcast):
        job_id = "00000000-0000-0000-0000-0000000000ff"
        job_data = [{
            "id": job_id,
            "status": "printing",
            "operator_id": "another-operator-id",
            "copies_requested": 10
        }]
        
        # Override to Super Admin
        admin_user = AuthenticatedUser(
            user_id="admin-id",
            email="admin@leakguard.ai",
            role="super_admin"
        )
        app.dependency_overrides[get_current_user] = lambda: admin_user
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=job_data)
        
        payload = {"reason": "Super Admin force abort."}
        response = self.client.post(f"/api/v1/print/jobs/{job_id}/abort", json=payload)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        mock_table.update.assert_called_once()
        mock_broadcast.assert_called_once_with("print_room", "print_job_aborted", {"job_id": job_id, "reason": payload["reason"]})

if __name__ == "__main__":
    unittest.main()
