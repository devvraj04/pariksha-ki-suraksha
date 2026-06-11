import sys
import os
import unittest
import asyncio
from unittest.mock import MagicMock, patch

# Add apps/backend to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/backend')))

from fastapi.testclient import TestClient
from main import app
from dependencies.db import get_db
from dependencies.auth import require_super_admin, require_authority, AuthenticatedUser
from services.vault_cache import DECRYPTED_PAPER_CACHE

class TestVaultAuthorize(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
        # Mocks
        self.mock_db = MagicMock()
        self.mock_user = AuthenticatedUser(
            user_id="d1a8c546-1e63-47cb-b461-71fb58d203ab",
            email="authority_a@leakguard.ai",
            role="authority_a"
        )
        
        # Setup overrides
        app.dependency_overrides[get_db] = lambda: self.mock_db
        app.dependency_overrides[require_authority] = lambda: self.mock_user
        app.dependency_overrides[require_super_admin] = lambda: AuthenticatedUser(
            user_id="d1a8c546-1e63-47cb-b461-71fb58d203ab",
            email="admin@leakguard.ai",
            role="super_admin"
        )

    def tearDown(self):
        app.dependency_overrides.clear()
        DECRYPTED_PAPER_CACHE.clear()

    def test_get_key_share_unauthorized_role(self):
        # 1. Mock DB to return a share owned by authority_b
        mock_execute = MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000123",
            "paper_id": "00000000-0000-0000-0000-000000000001",
            "authority_role": "authority_b",
            "share_value_encrypted": "dummy-enc-value",
            "is_retrieved": False
        }])
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = mock_execute

        # 2. Call endpoint as authority_a
        response = self.client.get("/api/v1/vault/key-shares/00000000-0000-0000-0000-000000000123")
        
        # 3. Assertions (Should be 403 Forbidden since role doesn't match)
        self.assertEqual(response.status_code, 403)

    def test_get_key_share_already_retrieved(self):
        # 1. Mock DB to return an already retrieved share for authority_a
        mock_execute = MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000123",
            "paper_id": "00000000-0000-0000-0000-000000000001",
            "authority_role": "authority_a",
            "share_value_encrypted": "dummy-enc-value",
            "is_retrieved": True
        }])
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = mock_execute

        # 2. Call endpoint
        response = self.client.get("/api/v1/vault/key-shares/00000000-0000-0000-0000-000000000123")
        
        # 3. Assertions (Should be 409 Conflict with ERR_SHARE_ALREADY_USED)
        self.assertEqual(response.status_code, 409)
        self.assertIn("ERR_SHARE_ALREADY_USED", response.json()["error"]["message"])

    @patch("services.vault_service.decrypt_share")
    def test_get_key_share_success(self, mock_decrypt_share):
        # 1. Mock decryption helper
        mock_decrypt_share.return_value = "decrypted-share-value-hex"
        
        # Mock DB select
        mock_execute = MagicMock(data=[{
            "id": "00000000-0000-0000-0000-000000000123",
            "paper_id": "00000000-0000-0000-0000-000000000001",
            "authority_role": "authority_a",
            "share_value_encrypted": "dummy-enc-value",
            "is_retrieved": False
        }])
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        
        # Set up chain side effect so select returns mock_table but insert/update return another mock
        def table_side_effect(name):
            if name == "key_shares":
                return mock_table
            return MagicMock()
            
        self.mock_db.table.side_effect = table_side_effect
        mock_table.execute.return_value = mock_execute

        # 2. Call endpoint
        response = self.client.get("/api/v1/vault/key-shares/00000000-0000-0000-0000-000000000123")
        
        # 3. Assertions
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertTrue(resp_json["success"])
        self.assertEqual(resp_json["data"]["share_value"], "decrypted-share-value-hex")
        
        # Check that update was called to mark as retrieved
        mock_table.update.assert_called_once()

    @patch("services.vault_service.schedule_cache_wipe")
    @patch("services.vault_service.decrypt_paper_pdf")
    @patch("services.vault_service.reconstruct_aes_key")
    @patch("fitz.open")
    def test_authorize_print_session_success(self, mock_fitz_open, mock_reconstruct_key, mock_decrypt_pdf, mock_schedule_cache_wipe):
        # 1. Mock decryption & SSS key recovery
        mock_reconstruct_key.return_value = b"32-bytes-aes-key-reconstructed--"
        mock_decrypt_pdf.return_value = b"%PDF-1.4 dummy decrypted pdf bytes"
        
        # Mock PyMuPDF page counting
        mock_doc = MagicMock()
        mock_doc.page_count = 10
        mock_fitz_open.return_value = mock_doc
        
        # Mock database selects & updates
        mock_paper_data = {
            "id": "00000000-0000-0000-0000-000000000001",
            "encrypted_blob_path": "00000000-0000-0000-0000-000000000001/paper.enc",
            "iv_hex": "00" * 12,
            "auth_tag_hex": "00" * 16,
            "exam_id": "00000000-0000-0000-0000-000000000002"
        }
        
        mock_shares_data = [
            {"authority_role": "authority_a", "retrieved_by": "00000000-0000-0000-0000-00000000000a"},
            {"authority_role": "authority_b", "retrieved_by": "00000000-0000-0000-0000-00000000000b"}
        ]
        
        mock_table = MagicMock()
        self.mock_db.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        
        # Simulate different queries based on table names
        def table_side_effect(name):
            t_mock = MagicMock()
            t_mock.select.return_value = t_mock
            t_mock.eq.return_value = t_mock
            t_mock.insert.return_value = t_mock
            t_mock.update.return_value = t_mock
            
            if name == "papers":
                t_mock.execute.return_value = MagicMock(data=[mock_paper_data])
            elif name == "key_shares":
                t_mock.execute.return_value = MagicMock(data=mock_shares_data)
            else:
                t_mock.execute.return_value = MagicMock(data=[{"id": "dummy"}])
            return t_mock

        self.mock_db.table.side_effect = table_side_effect
        
        # Mock Storage download
        mock_storage = MagicMock()
        self.mock_db.storage.from_.return_value = mock_storage
        mock_storage.download.return_value = b"encrypted-pdf-blob-from-storage"

        # 2. Call endpoint
        payload = {
            "share_a": "0123456789abcdef",
            "share_b": "fedcba9876543210",
            "authorized_copies": 100,
            "authorized_centers": ["00000000-0000-0000-0000-000000000010"],
            "print_window_minutes": 30
        }
        
        response = self.client.post(
            "/api/v1/vault/papers/00000000-0000-0000-0000-000000000001/authorize-print",
            json=payload
        )
        
        # 3. Assertions
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertTrue(resp_json["success"])
        
        session_id = resp_json["data"]["print_session_id"]
        self.assertIsNotNone(session_id)
        self.assertEqual(resp_json["data"]["authorized_copies"], 100)
        
        # Verify RAM cache was populated
        self.assertIn(session_id, DECRYPTED_PAPER_CACHE)
        self.assertEqual(DECRYPTED_PAPER_CACHE[session_id], b"%PDF-1.4 dummy decrypted pdf bytes")

if __name__ == "__main__":
    unittest.main()
