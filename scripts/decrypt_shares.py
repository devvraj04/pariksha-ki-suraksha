"""
Quick test script: decrypt the key shares directly using the same logic as vault_service.
Use the decrypted share_a and share_b values in the authorize-print API call.
"""
import os
import hashlib
from Crypto.Cipher import AES

# Load .env
for path in ['.env', '../.env']:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

def derive_authority_key(authority_role: str) -> bytes:
    master_salt = os.getenv("VAULT_MASTER_SALT", "default-vault-master-salt-here")
    return hashlib.pbkdf2_hmac(
        hash_name='sha256',
        password=master_salt.encode('utf-8'),
        salt=authority_role.encode('utf-8'),
        iterations=100000,
        dklen=32
    )

def decrypt_share(share_value_encrypted: str, authority_role: str) -> str:
    derived_key = derive_authority_key(authority_role)
    iv         = bytes.fromhex(share_value_encrypted[:24])
    auth_tag   = bytes.fromhex(share_value_encrypted[24:56])
    ciphertext = bytes.fromhex(share_value_encrypted[56:])
    cipher = AES.new(derived_key, AES.MODE_GCM, nonce=iv)
    share_bytes = cipher.decrypt_and_verify(ciphertext, auth_tag)
    return share_bytes.decode('utf-8')

# ── Paste your share_value_encrypted values from the DB here ──────────────────
SHARE_A_ENCRYPTED = "86487f8739133b4f4117e1c8926052ab5f2640a92718d09f6b9f40e466b7b59e4961021a506d329a194c9c9cb63fbaf688a5e84073618477c26d770f72d3200238bff7c734bff244913cb13c88d18f07eebe0bbdee535722f105b0a987dc"
SHARE_B_ENCRYPTED = "8ef817fa25ed4cd3df416b5dab40c114ccb14c909cab6570f899405db66f9935cd328191e27b4a2fd2eadc1e1303b4e214f823c5bafd7d2d876f092f85d65bbc53e7b000565411810a93372cb6669bc7bddc9958ed24069f4e5274e776ef"
# ─────────────────────────────────────────────────────────────────────────────

print("Decrypting shares...\n")

try:
    share_a = decrypt_share(SHARE_A_ENCRYPTED, "authority_a")
    print(f"share_a (use this in authorize-print):\n{share_a}\n")
except Exception as e:
    print(f"ERROR decrypting share_a: {e}\n")

try:
    share_b = decrypt_share(SHARE_B_ENCRYPTED, "authority_b")
    print(f"share_b (use this in authorize-print):\n{share_b}\n")
except Exception as e:
    print(f"ERROR decrypting share_b: {e}\n")
