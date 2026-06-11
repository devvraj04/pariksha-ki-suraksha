import os
import hashlib
from Crypto.Cipher import AES
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
import fitz
import secrets
from supabase import Client
from services.vault_cache import DECRYPTED_PAPER_CACHE, schedule_cache_wipe
from services.realtime_service import broadcast_realtime_event

# Prime field configuration for 2-of-2 Shamir's Secret Sharing (fits 256-bit key)
# P is the first prime larger than 2**256: 2**256 + 297
P = 2**256 + 297

def encrypt_paper_pdf(pdf_bytes: bytes) -> tuple[bytes, str, str, bytes]:
    """
    Encrypt PDF bytes using AES-256-GCM.
    Returns: (ciphertext, iv_hex, auth_tag_hex, aes_key)
    """
    aes_key = os.urandom(32)
    iv = os.urandom(12)
    
    cipher = AES.new(aes_key, AES.MODE_GCM, nonce=iv)
    ciphertext, auth_tag = cipher.encrypt_and_digest(pdf_bytes)
    
    return ciphertext, iv.hex(), auth_tag.hex(), aes_key

def split_aes_key(key: bytes) -> tuple[str, str]:
    """
    Split a 32-byte AES key into 2 shares using a 2-of-2 SSS scheme over prime field P.
    Share A (evaluated at x=1): y1 = (S + a1) % P
    Share B (evaluated at x=2): y2 = (S + 2 * a1) % P
    """
    S = int.from_bytes(key, 'big')
    
    # Generate random coefficient a1 (1 <= a1 < P)
    a1_bytes = os.urandom(32)
    a1 = int.from_bytes(a1_bytes, 'big') % P
    if a1 == 0:
        a1 = 1
        
    y1 = (S + a1) % P
    y2 = (S + 2 * a1) % P
    
    # Format as 66-character hex strings to cover values up to P
    share_a = f"{y1:066x}"
    share_b = f"{y2:066x}"
    
    return share_a, share_b

def derive_authority_key(authority_role: str) -> bytes:
    """
    Derive a 32-byte key using PBKDF2-HMAC-SHA256 from VAULT_MASTER_SALT and the role name.
    """
    master_salt = os.getenv("VAULT_MASTER_SALT", "default-vault-master-salt-here")
    return hashlib.pbkdf2_hmac(
        hash_name='sha256',
        password=master_salt.encode('utf-8'),
        salt=authority_role.encode('utf-8'),
        iterations=100000,
        dklen=32
    )

def encrypt_share(share: str, authority_role: str) -> str:
    """
    Encrypt the SSS share string using the derived authority key and AES-256-GCM.
    Returns: iv_hex + auth_tag_hex + ciphertext_hex
    """
    derived_key = derive_authority_key(authority_role)
    share_bytes = share.encode('utf-8')
    iv = os.urandom(12)
    
    cipher = AES.new(derived_key, AES.MODE_GCM, nonce=iv)
    ciphertext, auth_tag = cipher.encrypt_and_digest(share_bytes)
    
    return iv.hex() + auth_tag.hex() + ciphertext.hex()

def upload_and_register_paper(
    db: Client,
    pdf_bytes: bytes,
    exam_id: str,
    title: str,
    uploader_id: str
) -> dict:
    """
    Upload and encrypt paper PDF, split AES key, encrypt shares, and log to Supabase.
    """
    paper_id = str(uuid4())
    
    # 1. Encrypt paper PDF
    ciphertext, iv_hex, auth_tag_hex, aes_key = encrypt_paper_pdf(pdf_bytes)
    
    # 2. Upload ciphertext to Supabase Storage
    storage_path = f"{exam_id}/{paper_id}.enc"
    db.storage.from_("encrypted-papers").upload(
        path=storage_path,
        file=ciphertext,
        file_options={"content-type": "application/octet-stream"}
    )
    
    # 3. Split AES key into 2 Shamir Secret shares
    share_a, share_b = split_aes_key(aes_key)
    
    # 4. Encrypt shares for each authority role
    encrypted_share_a = encrypt_share(share_a, "authority_a")
    encrypted_share_b = encrypt_share(share_b, "authority_b")
    
    # 5. Insert paper record
    paper_record = {
        "id": paper_id,
        "exam_id": exam_id,
        "title": title,
        "encrypted_blob_path": storage_path,
        "iv_hex": iv_hex,
        "auth_tag_hex": auth_tag_hex,
        "file_size_bytes": len(pdf_bytes),
        "status": "encrypted",
        "uploaded_by": uploader_id
    }
    db.table("papers").insert(paper_record).execute()
    
    # 6. Insert key share records
    key_shares = [
        {
            "paper_id": paper_id,
            "authority_role": "authority_a",
            "share_value_encrypted": encrypted_share_a,
            "is_retrieved": False
        },
        {
            "paper_id": paper_id,
            "authority_role": "authority_b",
            "share_value_encrypted": encrypted_share_b,
            "is_retrieved": False
        }
    ]
    key_shares_resp = db.table("key_shares").insert(key_shares).execute()
    
    # Find the generated share IDs to return
    key_share_a_id = None
    key_share_b_id = None
    for row in key_shares_resp.data:
        if row["authority_role"] == "authority_a":
            key_share_a_id = row["id"]
        elif row["authority_role"] == "authority_b":
            key_share_b_id = row["id"]
            
    # 7. Write system audit log
    audit_log = {
        "user_id": uploader_id,
        "action_type": "paper_uploaded",
        "entity_type": "papers",
        "entity_id": paper_id,
        "metadata": {"title": title, "exam_id": exam_id}
    }
    db.table("audit_logs").insert(audit_log).execute()
    
    return {
        "paper_id": paper_id,
        "exam_id": exam_id,
        "key_share_a_id": key_share_a_id,
        "key_share_b_id": key_share_b_id,
        "status": "encrypted"
    }

def decrypt_share(share_value_encrypted: str, authority_role: str) -> str:
    """
    Decrypt the stored share value using PBKDF2 derived key and AES-256-GCM.
    share_value_encrypted is structured as: iv_hex (24 chars) + auth_tag_hex (32 chars) + ciphertext_hex.
    """
    derived_key = derive_authority_key(authority_role)
    
    iv = bytes.fromhex(share_value_encrypted[:24])
    auth_tag = bytes.fromhex(share_value_encrypted[24:56])
    ciphertext = bytes.fromhex(share_value_encrypted[56:])
    
    cipher = AES.new(derived_key, AES.MODE_GCM, nonce=iv)
    share_bytes = cipher.decrypt_and_verify(ciphertext, auth_tag)
    
    return share_bytes.decode('utf-8')

def reconstruct_aes_key(share_a_hex: str, share_b_hex: str) -> bytes:
    """
    Reconstruct the 32-byte AES key from SSS shares using:
    S = (2 * y1 - y2) % P
    """
    y1 = int(share_a_hex, 16)
    y2 = int(share_b_hex, 16)
    
    S = (2 * y1 - y2) % P
    return S.to_bytes(32, 'big')

def decrypt_paper_pdf(ciphertext: bytes, key: bytes, iv_hex: str, auth_tag_hex: str) -> bytes:
    """
    Decrypt question paper PDF using AES-256-GCM.
    """
    iv = bytes.fromhex(iv_hex)
    auth_tag = bytes.fromhex(auth_tag_hex)
    
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    return cipher.decrypt_and_verify(ciphertext, auth_tag)

def authorize_print_session(
    db: Client,
    paper_id: str,
    share_a_hex: str,
    share_b_hex: str,
    authorized_copies: int,
    authorized_centers: list[str],
    print_window_minutes: int,
    background_tasks
) -> dict:
    """
    Verify SSS key reconstruction, decrypt PDF in RAM, register page count,
    create print session, and cache decrypted PDF bytes in memory.
    """
    # 1. Fetch paper details from DB
    paper_resp = db.table("papers").select("*").eq("id", paper_id).execute()
    if not paper_resp.data:
        raise ValueError(f"Paper with ID {paper_id} not found.")
    paper = paper_resp.data[0]
    
    # 2. Reconstruct the AES key
    try:
        aes_key = reconstruct_aes_key(share_a_hex, share_b_hex)
    except Exception as e:
        raise ValueError(f"Failed to reconstruct AES key from shares: {str(e)}")
        
    # 3. Download encrypted PDF from Storage
    try:
        encrypted_pdf = db.storage.from_("encrypted-papers").download(paper["encrypted_blob_path"])
    except Exception as e:
        raise RuntimeError(f"Failed to download encrypted paper blob: {str(e)}")
        
    # 4. Decrypt PDF in RAM
    try:
        decrypted_pdf = decrypt_paper_pdf(encrypted_pdf, aes_key, paper["iv_hex"], paper["auth_tag_hex"])
    except Exception as e:
        raise ValueError(f"Decryption failed (integrity check failed): {str(e)}")
        
    # 5. Parse PDF to count pages using PyMuPDF
    try:
        doc = fitz.open(stream=decrypted_pdf, filetype="pdf")
        page_count = doc.page_count
        doc.close()
    except Exception as e:
        raise ValueError(f"Failed to parse decrypted PDF structure: {str(e)}")
        
    # 6. Update paper status and page count in DB
    db.table("papers").update({
        "page_count": page_count,
        "status": "print_authorized"
    }).eq("id", paper_id).execute()
    
    # 7. Identify users who retrieved key shares for this paper
    shares_resp = db.table("key_shares").select("authority_role", "retrieved_by").eq("paper_id", paper_id).execute()
    authorized_by_a = None
    authorized_by_b = None
    for row in shares_resp.data:
        if row["authority_role"] == "authority_a":
            authorized_by_a = row["retrieved_by"]
        elif row["authority_role"] == "authority_b":
            authorized_by_b = row["retrieved_by"]
            
    # 8. Create a print session
    session_id = str(uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=print_window_minutes)
    
    session_record = {
        "id": session_id,
        "paper_id": paper_id,
        "authorized_by_a": authorized_by_a,
        "authorized_by_b": authorized_by_b,
        "authorized_copies": authorized_copies,
        "authorized_centers": authorized_centers,
        "expires_at": expires_at.isoformat(),
        "is_active": True
    }
    db.table("print_sessions").insert(session_record).execute()
    
    # 9. Store the decrypted PDF bytes in RAM cache
    DECRYPTED_PAPER_CACHE[session_id] = decrypted_pdf
    
    # Emit print_room Realtime event indicating session is open
    broadcast_realtime_event(
        "print_room",
        "print_session_open",
        {
            "print_session_id": session_id,
            "paper_id": paper_id,
            "expires_at": expires_at.isoformat()
        }
    )
    
    # 10. Schedule cache wipe in the background
    delay_seconds = print_window_minutes * 60.0
    background_tasks.add_task(schedule_cache_wipe, session_id, delay_seconds)
    
    # 11. Write system audit log
    audit_log = {
        "user_id": authorized_by_a or authorized_by_b,
        "action_type": "print_authorized",
        "entity_type": "print_sessions",
        "entity_id": session_id,
        "metadata": {
            "paper_id": paper_id,
            "authorized_copies": authorized_copies,
            "expires_at": expires_at.isoformat()
        }
    }
    db.table("audit_logs").insert(audit_log).execute()
    
    return {
        "print_session_id": session_id,
        "expires_at": expires_at.isoformat(),
        "authorized_copies": authorized_copies
    }

def generate_view_token(db: Client, paper_id: str) -> str:
    """
    Generate a secure, single-use 60-second view token for paper decryption display.
    """
    token = secrets.token_urlsafe(32)
    # Expiry 60s from now
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()
    
    db.table("vault_view_tokens").insert({
        "paper_id": paper_id,
        "token": token,
        "is_used": False,
        "expires_at": expires_at
    }).execute()
    
    return token

def get_decrypted_paper_by_token(db: Client, paper_id: str, token: str) -> bytes:
    """
    Validate the view token, mark it as used (replay protection), and return decrypted PDF bytes from RAM.
    """
    # Query token
    token_resp = db.table("vault_view_tokens") \
        .select("*") \
        .eq("token", token) \
        .eq("paper_id", paper_id) \
        .eq("is_used", False) \
        .execute()
        
    if not token_resp.data:
        raise ValueError("Invalid, used, or expired view token.")
        
    token_record = token_resp.data[0]
    expires_at = datetime.fromisoformat(token_record["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        raise ValueError("View token has expired.")
        
    # Mark as used immediately to prevent replay attacks
    db.table("vault_view_tokens").update({"is_used": True}).eq("id", token_record["id"]).execute()
    
    # Resolve active print session for this paper
    session_resp = db.table("print_sessions") \
        .select("id") \
        .eq("paper_id", paper_id) \
        .eq("is_active", True) \
        .execute()
        
    if not session_resp.data:
        raise ValueError("No active print session found for this paper.")
        
    session_id = session_resp.data[0]["id"]
    
    if session_id not in DECRYPTED_PAPER_CACHE:
        raise KeyError("ERR_SESSION_EXPIRED")
        
    return DECRYPTED_PAPER_CACHE[session_id]

