import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Add apps/backend to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/backend')))

from fastapi.testclient import TestClient
from main import app
from dependencies.db import get_db
from dependencies.auth import require_super_admin, AuthenticatedUser

class TestVaultUpload(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
        # Setup mock user
        self.mock_user = AuthenticatedUser(
            user_id="d1a8c546-1e63-47cb-b461-71fb58d203ab",
            email="admin@leakguard.ai",
            role="super_admin"
        )
        
        # Setup mock db
        self.mock_db = MagicMock()
        
        # Override dependencies
        app.dependency_overrides[require_super_admin] = lambda: self.mock_user
        app.dependency_overrides[get_db] = lambda: self.mock_db

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_upload_paper_success(self):
        # 1. Setup mock database responses
        
        # Mock exam check: db.table("exams").select("id").eq("id", exam_id).execute()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_execute_exam = MagicMock(data=[{"id": "00000000-0000-0000-0000-000000000001"}])
        
        self.mock_db.table.return_value = mock_select
        mock_select.select.return_value = mock_eq
        mock_eq.eq.return_value = mock_eq
        mock_eq.execute.return_value = mock_execute_exam
        
        # Mock storage bucket upload: db.storage.from_("encrypted-papers").upload(...)
        mock_storage = MagicMock()
        self.mock_db.storage.from_.return_value = mock_storage
        mock_storage.upload.return_value = {"path": "00000000-0000-0000-0000-000000000001/paper-uuid-456.enc"}
        
        # Mock inserts: papers, key_shares, audit_logs
        mock_execute_insert_shares = MagicMock(data=[
            {"id": "00000000-0000-0000-0000-00000000000a", "authority_role": "authority_a"},
            {"id": "00000000-0000-0000-0000-00000000000b", "authority_role": "authority_b"}
        ])
        
        # Set up a side effect for db.table().insert().execute()
        # The first insert is for papers (we can return anything), the second is key_shares (returns roles & ids), the third is audit_logs
        mock_table_obj = MagicMock()
        mock_insert_obj = MagicMock()
        
        # Chain calls: db.table(x).insert(y).execute()
        self.mock_db.table.return_value = mock_table_obj
        mock_table_obj.insert.return_value = mock_insert_obj
        
        # We alternate return values for execute() depending on which table is being operated on
        def mock_execute_side_effect():
            # If the last table call was key_shares, return the shares data
            # Otherwise return dummy data
            table_name = self.mock_db.table.call_args[0][0]
            if table_name == "key_shares":
                return mock_execute_shares_resp
            return MagicMock(data=[{"id": "dummy"}])
            
        mock_execute_shares_resp = MagicMock(data=[
            {"id": "00000000-0000-0000-0000-00000000000a", "authority_role": "authority_a"},
            {"id": "00000000-0000-0000-0000-00000000000b", "authority_role": "authority_b"}
        ])
        
        mock_insert_obj.execute.side_effect = mock_execute_side_effect

        # 2. Perform upload request
        pdf_content = b"%PDF-1.4 dummy pdf content for unit testing"
        files = {
            "file": ("question_paper.pdf", pdf_content, "application/pdf")
        }
        data = {
            "exam_id": "00000000-0000-0000-0000-000000000001",
            "title": "Mathematics Midterm Set A"
        }
        
        response = self.client.post("/api/v1/vault/papers", files=files, data=data)
        
        # 3. Assertions
        print("Response status:", response.status_code)
        print("Response JSON:", response.json())
        
        self.assertEqual(response.status_code, 201)
        resp_json = response.json()
        
        self.assertTrue(resp_json["success"])
        self.assertIsNotNone(resp_json["data"])
        self.assertEqual(resp_json["data"]["status"], "encrypted")
        self.assertEqual(resp_json["data"]["exam_id"], "00000000-0000-0000-0000-000000000001")
        self.assertEqual(resp_json["data"]["key_share_a_id"], "00000000-0000-0000-0000-00000000000a")
        self.assertEqual(resp_json["data"]["key_share_b_id"], "00000000-0000-0000-0000-00000000000b")
        
        # Verify db storage was called
        mock_storage.upload.assert_called_once()
        
        # Verify database inserts were made
        # 3 table calls: exams select, papers insert, key_shares insert, audit_logs insert
        table_calls = [call[0][0] for call in self.mock_db.table.call_args_list]
        self.assertIn("papers", table_calls)
        self.assertIn("key_shares", table_calls)
        self.assertIn("audit_logs", table_calls)

if __name__ == "__main__":
    unittest.main()
