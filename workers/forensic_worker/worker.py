"""
LeakGuard AI — Forensic Worker
================================
Standalone Python process that polls the database for unprocessed forensic
uploads and runs the full image → QR decode → leak attribution pipeline.

Usage:
    python worker.py                        # uses .env from repo root
    SUPABASE_URL=... python worker.py       # or set env vars directly

Pipeline stages:
    1. Poll forensic_uploads WHERE status = 'processing'
    2. Download image from Supabase Storage
    3. OpenCV enhancement: deskew → CLAHE → adaptive binarization
    4. QR / Data Matrix decode via pyzbar (+ pylibdmtx fallback)
    5. Parse TMC JSON payload
    6. LeakAttributionEngine: cross-reference operator, transit chain, score
    7. Write forensic_reports row + update upload status + audit log
"""

import os
import sys
import json
import time
import logging
import math
from datetime import datetime, timezone
from uuid import uuid4, UUID

import cv2
import numpy as np

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S"
)
logger = logging.getLogger("forensic_worker")

# ─── Environment bootstrap ─────────────────────────────────────────────────
def _load_env():
    """Load .env file from common locations (repo root or cwd)."""
    candidates = [".env", "../../.env", "../.env", "/app/.env"]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            logger.info(f"Loaded environment from {os.path.abspath(path)}")
            return
    logger.warning("No .env file found — relying on existing env vars")

_load_env()

from supabase import create_client, Client  # noqa: E402  (after env load)

# ─── Supabase client ───────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    sys.exit(1)

db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

POLL_INTERVAL = int(os.getenv("FORENSIC_POLL_INTERVAL", "5"))


# ═══════════════════════════════════════════════════════════════════════════
# Stage 1 — Image Enhancement Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Detect dominant line angle via Canny + Hough Line Transform and
    rotate the image to correct skew.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, math.pi / 180, threshold=100,
                            minLineLength=100, maxLineGap=10)

    if lines is None or len(lines) == 0:
        logger.debug("No lines detected for deskew — returning original image")
        return image

    # Compute angles of all detected line segments
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Only consider near-horizontal lines (within ±45°)
        if -45 < angle < 45:
            angles.append(angle)

    if not angles:
        return image

    median_angle = float(np.median(angles))

    # Only correct if skew is meaningful (> 0.5°)
    if abs(median_angle) < 0.5:
        logger.debug(f"Skew angle {median_angle:.2f}° below threshold — skipping rotation")
        return image

    logger.info(f"Deskew: rotating by {-median_angle:.2f}°")
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(image, rotation_matrix, (w, h),
                             flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_REPLICATE)
    return rotated


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE on the L channel of the LAB color space to boost local contrast.
    """
    if len(image.shape) == 2:
        # Already grayscale
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(image)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)

    merged = cv2.merge([l_enhanced, a_channel, b_channel])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def generate_binarized_variants(image: np.ndarray) -> list[np.ndarray]:
    """
    Convert to grayscale and apply adaptive Gaussian thresholding using a sweep
    of parameters to account for various lighting conditions and noise levels.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    variants = []
    
    # Sweep block sizes and C constants to handle over/under-exposed photos
    for block_size in [11, 21, 51]:
        for c_val in [2, 5, 10]:
            binary = cv2.adaptiveThreshold(
                gray, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                blockSize=block_size,
                C=c_val
            )
            variants.append(binary)
    return variants


def run_image_pipeline(raw_bytes: bytes) -> tuple:
    """
    Execute the full enhancement pipeline on raw image bytes.
    Returns (original_image, enhanced_color_image, binarized_image).
    """
    # Decode image from bytes
    nparr = np.frombuffer(raw_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to decode image from bytes")

    logger.info(f"Image decoded: {image.shape[1]}×{image.shape[0]} px")

    # Pipeline: deskew → CLAHE → multiple binarized variants
    deskewed = deskew_image(image)
    enhanced = enhance_contrast(deskewed)
    binarized_variants = generate_binarized_variants(enhanced)

    return image, enhanced, binarized_variants


# ═══════════════════════════════════════════════════════════════════════════
# Stage 2 — QR / Data Matrix Decode
# ═══════════════════════════════════════════════════════════════════════════

def attempt_decode(image: np.ndarray, binarized_variants: list[np.ndarray]) -> dict | None:
    """
    Try to decode QR codes and Data Matrix codes from the image.
    Attempts multiple image variants for robustness:
      1. All generated Binarized variants (best for degraded photos)
      2. Enhanced color image
      3. Grayscale of the enhanced image
      4. Inverted binarized variants
    Returns the parsed TMC payload dict, or None.
    """
    try:
        from pyzbar import pyzbar
        has_pyzbar = True
    except ImportError:
        logger.warning("pyzbar not available — QR decoding disabled")
        has_pyzbar = False

    try:
        from pylibdmtx import pylibdmtx
        has_dmtx = True
    except ImportError:
        logger.warning("pylibdmtx not available — Data Matrix decoding disabled")
        has_dmtx = False

    # Prepare candidate images in priority order
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    candidates = []
    # Add all binarized variants first, as they are most likely to succeed
    for i, b_var in enumerate(binarized_variants):
        candidates.append((f"binarized_v{i}", b_var))
        candidates.append((f"inverted_v{i}", cv2.bitwise_not(b_var)))
        
    # Fallbacks
    candidates.append(("color", image))
    candidates.append(("grayscale", gray))

    # Try pyzbar first (handles QR codes well)
    if has_pyzbar:
        for label, img in candidates:
            decoded = pyzbar.decode(img)
            if decoded:
                for obj in decoded:
                    try:
                        payload = json.loads(obj.data.decode("utf-8"))
                        if _is_valid_tmc(payload):
                            logger.info(f"pyzbar decoded TMC from {label} image (type={obj.type})")
                            return payload
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue

    # Fallback: try pylibdmtx for Data Matrix codes
    if has_dmtx:
        for label, img in candidates:
            # pylibdmtx works best with grayscale
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            decoded = pylibdmtx.decode(img_gray, timeout=3000)
            if decoded:
                for obj in decoded:
                    try:
                        payload = json.loads(obj.data.decode("utf-8"))
                        if _is_valid_tmc(payload):
                            logger.info(f"pylibdmtx decoded TMC from {label} image")
                            return payload
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue

    return None


def _is_valid_tmc(payload: dict) -> bool:
    """Validate that the decoded JSON looks like a legitimate TMC payload."""
    required_keys = {"printer_id", "operator_id", "center_id", "batch_id",
                     "timestamp_unix", "copy_index", "page_index"}
    return required_keys.issubset(payload.keys())


def _is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID (required for DB FK columns)."""
    try:
        UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


# ═══════════════════════════════════════════════════════════════════════════
# Stage 3 — Leak Attribution Engine
# ═══════════════════════════════════════════════════════════════════════════

def run_attribution(tmc: dict) -> dict:
    """
    Cross-reference the decoded TMC payload against the database to build
    the full leak attribution report:
      - Resolve operator name
      - Resolve center name
      - Look up transit batch and custody chain
      - Compute confidence score based on transit anomalies
    """
    operator_id = tmc["operator_id"]
    center_id = tmc["center_id"]
    batch_id = tmc["batch_id"]
    printer_id = tmc["printer_id"]
    timestamp_unix = tmc["timestamp_unix"]

    # ── Resolve operator name ───────────────────────────────────────────
    operator_name = "Unknown Operator"
    try:
        profile_resp = db.table("user_profiles").select("full_name").eq("id", operator_id).execute()
        if profile_resp.data:
            operator_name = profile_resp.data[0]["full_name"]
    except Exception as e:
        logger.warning(f"Could not resolve operator name for {operator_id}: {e}")

    # ── Resolve center name ─────────────────────────────────────────────
    center_name = "Unknown Center"
    try:
        center_resp = db.table("exam_centers").select("name").eq("id", center_id).execute()
        if center_resp.data:
            center_name = center_resp.data[0]["name"]
    except Exception as e:
        logger.warning(f"Could not resolve center name for {center_id}: {e}")

    # ── Look up print job from watermark batch ──────────────────────────
    print_job = None
    try:
        job_resp = (
            db.table("print_jobs")
            .select("id, completed_at, printer_id, operator_id")
            .eq("watermark_batch_id", batch_id)
            .execute()
        )
        if job_resp.data:
            print_job = job_resp.data[0]
    except Exception as e:
        logger.warning(f"Could not look up print job for batch {batch_id}: {e}")

    # ── Build custody chain & calculate realistic confidence ─────────────
    custody_chain = []
    
    # Base confidence just for having a valid deciphered TMC
    confidence_score = 0.50
    
    if operator_name != "Unknown Operator":
        confidence_score += 0.15
    if center_name != "Unknown Center":
        confidence_score += 0.15
    if print_job is not None:
        confidence_score += 0.10

    # Event 1: print event
    printed_at = datetime.fromtimestamp(timestamp_unix, tz=timezone.utc).isoformat()
    custody_chain.append({
        "event": "printed",
        "actor": operator_name,
        "timestamp": print_job["completed_at"] if print_job and print_job.get("completed_at") else printed_at
    })

    # ── Look up transit batch (if transit module data exists) ───────────
    try:
        transit_resp = (
            db.table("transit_batches")
            .select("id, assigned_driver_id, status, dispatched_at, delivered_at, compromised_reason")
            .eq("print_job_id", print_job["id"] if print_job else "")
            .execute()
        )

        if transit_resp.data:
            batch = transit_resp.data[0]
            transit_batch_id = batch["id"]

            # Resolve driver name
            driver_name = "Unknown Driver"
            if batch.get("assigned_driver_id"):
                try:
                    driver_resp = db.table("user_profiles").select("full_name").eq(
                        "id", batch["assigned_driver_id"]
                    ).execute()
                    if driver_resp.data:
                        driver_name = driver_resp.data[0]["full_name"]
                except Exception:
                    pass

            # Event 2: dispatched
            custody_chain.append({
                "event": "dispatched",
                "actor": driver_name,
                "timestamp": batch.get("dispatched_at")
            })

            # Look up checkpoint scans
            try:
                cp_resp = (
                    db.table("transit_checkpoints")
                    .select("label, scanned_at, scanned_by")
                    .eq("batch_id", transit_batch_id)
                    .order("checkpoint_index")
                    .execute()
                )
                for cp in (cp_resp.data or []):
                    if cp.get("scanned_at"):
                        custody_chain.append({
                            "event": "checkpoint_scanned",
                            "actor": cp.get("label", "Checkpoint"),
                            "timestamp": cp["scanned_at"]
                        })
            except Exception:
                pass

            # Event: delivered (if applicable)
            if batch.get("delivered_at"):
                custody_chain.append({
                    "event": "delivered",
                    "actor": driver_name,
                    "timestamp": batch["delivered_at"]
                })

            # ── Confidence scoring: check for transit anomalies ─────────
            try:
                pings_resp = (
                    db.table("transit_pings")
                    .select("geofence_status")
                    .eq("batch_id", transit_batch_id)
                    .in_("geofence_status", ["deviation", "stationary"])
                    .execute()
                )
                deviation_count = len(pings_resp.data) if pings_resp.data else 0
                if deviation_count == 0:
                    # Successfully arrived with zero anomalies
                    confidence_score += 0.10
                else:
                    # Significant deviations lower confidence slightly
                    confidence_score -= (0.05 * deviation_count)
                    
                confidence_score = max(0.0, min(1.0, confidence_score))
                logger.info(f"Transit anomalies found: {deviation_count} → confidence={confidence_score:.2f}")
            except Exception as e:
                logger.warning(f"Could not check transit pings: {e}")

    except Exception as e:
        logger.debug(f"No transit data found for print job (expected if transit module not built yet): {e}")

    return {
        "operator_id": operator_id,
        "operator_name": operator_name,
        "center_id": center_id,
        "center_name": center_name,
        "printer_id": printer_id,
        "batch_id": batch_id,
        "leaked_at": printed_at,
        "custody_chain": custody_chain,
        "confidence_score": round(confidence_score, 2)
    }


# ═══════════════════════════════════════════════════════════════════════════
# Stage 4 — Job Processing Loop
# ═══════════════════════════════════════════════════════════════════════════

def process_job(upload: dict):
    """Process a single forensic upload job end-to-end."""
    upload_id = upload["id"]
    storage_path = upload["storage_path"]
    logger.info(f"Processing job {upload_id} — file: {storage_path}")

    # ── Download image from Supabase Storage ────────────────────────────
    try:
        file_bytes = db.storage.from_("forensic-uploads").download(storage_path)
    except Exception as e:
        logger.error(f"Failed to download {storage_path}: {e}")
        _fail_job(upload_id, f"Storage download failed: {str(e)}")
        return

    if not file_bytes or len(file_bytes) == 0:
        _fail_job(upload_id, "Downloaded file is empty")
        return

    # ── Run image enhancement pipeline ──────────────────────────────────
    try:
        original, enhanced, binarized = run_image_pipeline(file_bytes)
    except Exception as e:
        logger.error(f"Image pipeline failed for {upload_id}: {e}")
        _fail_job(upload_id, f"Image processing error: {str(e)}")
        return

    # ── Attempt QR / Data Matrix decode ─────────────────────────────────
    tmc_payload = attempt_decode(enhanced, binarized_variants)

    if tmc_payload is None:
        logger.warning(f"No TMC watermark found in {upload_id}")
        # Write report with no watermark found
        report_id = str(uuid4())
        db.table("forensic_reports").insert({
            "id": report_id,
            "upload_id": upload_id,
            "tmc_decoded": None,
            "confidence_score": 0.0,
            "processing_notes": "No TMC found after full pipeline (deskew + CLAHE + binarize + pyzbar + pylibdmtx)"
        }).execute()

        db.table("forensic_uploads").update({
            "status": "no_watermark_found",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", upload_id).execute()

        logger.info(f"Job {upload_id} completed — no watermark found")
        return

    # ── TMC found → run leak attribution ────────────────────────────────
    logger.info(f"TMC decoded for {upload_id}: operator={tmc_payload.get('operator_id')}, "
                f"printer={tmc_payload.get('printer_id')}")

    try:
        attribution = run_attribution(tmc_payload)
    except Exception as e:
        logger.error(f"Attribution engine failed for {upload_id}: {e}")
        _fail_job(upload_id, f"Attribution error: {str(e)}")
        return

    # ── Write forensic_reports row ──────────────────────────────────────
    report_id = str(uuid4())
    # Validate UUIDs before inserting into FK columns (TMC may contain non-UUID test data)
    op_id = attribution["operator_id"] if _is_valid_uuid(attribution["operator_id"]) else None
    center_id_val = attribution["center_id"] if _is_valid_uuid(attribution["center_id"]) else None

    report_record = {
        "id": report_id,
        "upload_id": upload_id,
        "tmc_decoded": tmc_payload,
        "primary_suspect_operator_id": op_id,
        "primary_suspect_printer_id": attribution["printer_id"],
        "primary_suspect_center_id": center_id_val,
        "leaked_at": attribution["leaked_at"],
        "custody_chain": attribution["custody_chain"],
        "confidence_score": attribution["confidence_score"],
        "processing_notes": f"TMC decoded successfully. Operator: {attribution['operator_name']}, "
                           f"Center: {attribution['center_name']}, Confidence: {attribution['confidence_score']}"
    }
    db.table("forensic_reports").insert(report_record).execute()

    # ── Update upload status ────────────────────────────────────────────
    db.table("forensic_uploads").update({
        "status": "completed",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", upload_id).execute()

    # ── Audit log ───────────────────────────────────────────────────────
    db.table("audit_logs").insert({
        "action_type": "forensic_report_generated",
        "entity_type": "forensic_reports",
        "entity_id": report_id,
        "metadata": {
            "upload_id": upload_id,
            "operator_id": attribution["operator_id"],
            "printer_id": attribution["printer_id"],
            "confidence_score": attribution["confidence_score"]
        }
    }).execute()

    logger.info(
        f"✅ Job {upload_id} completed — Report {report_id} | "
        f"Operator: {attribution['operator_name']} | "
        f"Confidence: {attribution['confidence_score']:.0%}"
    )


def _fail_job(upload_id: str, reason: str):
    """Mark a forensic upload as failed and write a minimal report."""
    try:
        db.table("forensic_uploads").update({
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", upload_id).execute()

        db.table("forensic_reports").insert({
            "id": str(uuid4()),
            "upload_id": upload_id,
            "tmc_decoded": None,
            "confidence_score": 0.0,
            "processing_notes": f"Processing failed: {reason}"
        }).execute()
    except Exception as e:
        logger.error(f"Failed to update failure status for {upload_id}: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Main Loop
# ═══════════════════════════════════════════════════════════════════════════

def main():
    logger.info("=" * 60)
    logger.info("LeakGuard AI — Forensic Worker started")
    logger.info(f"Poll interval: {POLL_INTERVAL}s")
    logger.info(f"Supabase URL: {SUPABASE_URL[:40]}...")
    logger.info("=" * 60)

    while True:
        try:
            # Poll for the oldest unprocessed upload
            resp = (
                db.table("forensic_uploads")
                .select("*")
                .eq("status", "processing")
                .order("created_at")
                .limit(1)
                .execute()
            )

            if resp.data:
                upload = resp.data[0]
                process_job(upload)
            else:
                logger.debug("No pending forensic jobs")

        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
            break
        except Exception as e:
            logger.error(f"Unexpected error in poll loop: {e}", exc_info=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
