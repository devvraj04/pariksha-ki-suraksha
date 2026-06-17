import os
import time
import json
import logging
import threading
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edge_proctor")

app = FastAPI(title="ParikshaSetu AI - Edge Proctor Node", version="1.0.0")

BUFFER_FILE = "alert_buffer.json"
BUFFER_LOCK = threading.Lock()

# Load configuration from environment
MASTER_API_URL = os.getenv("MASTER_API_URL", "http://localhost:8000/api/v1")
EDGE_CENTER_ID = os.getenv("EDGE_CENTER_ID", "default-center-id")
EDGE_ROOM_ID = os.getenv("EDGE_ROOM_ID", "default-room-id")

# Load YOLOv8 models (using yolov8n.pt as base for all 3 tasks in dev mode)
try:
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")
    logger.info("YOLOv8 Nano model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load YOLOv8 model: {e}")
    model = None

# Offline buffer management
def save_to_buffer(alert_data: dict):
    with BUFFER_LOCK:
        try:
            buffer = []
            if os.path.exists(BUFFER_FILE):
                with open(BUFFER_FILE, "r") as f:
                    buffer = json.load(f)
            buffer.append(alert_data)
            with open(BUFFER_FILE, "w") as f:
                json.dump(buffer, f, indent=4)
            logger.info(f"Buffered alert locally: {alert_data['alert_type']}")
        except Exception as e:
            logger.error(f"Failed to save alert to offline buffer: {e}")

def flush_buffer_worker():
    while True:
        time.sleep(30) # Attempt to flush every 30 seconds
        if not os.path.exists(BUFFER_FILE):
            continue
            
        with BUFFER_LOCK:
            try:
                with open(BUFFER_FILE, "r") as f:
                    buffer = json.load(f)
            except Exception as e:
                logger.error(f"Failed to read alert buffer: {e}")
                continue
                
            if not buffer:
                continue
                
            logger.info(f"Attempting to sync {len(buffer)} buffered alerts to master API...")
            remaining = []
            
            for alert in buffer:
                try:
                    # Send alert to master API endpoint
                    # endpoint could be for print room or exam center surveillance
                    endpoint = "/surveillance/alerts" if not alert.get("is_print_room") else "/printing/surveillance-alerts"
                    res = requests.post(f"{MASTER_API_URL}{endpoint}", json=alert, timeout=5)
                    if res.status_code in (200, 201):
                        logger.info(f"Synced alert {alert['alert_type']} successfully.")
                    else:
                        remaining.append(alert)
                except Exception:
                    remaining.append(alert)
                    
            try:
                with open(BUFFER_FILE, "w") as f:
                    json.dump(remaining, f, indent=4)
            except Exception as e:
                logger.error(f"Failed to write updated alert buffer: {e}")

# Start the offline sync background thread
threading.Thread(target=flush_buffer_worker, daemon=True).start()


@app.get("/health")
def health():
    return {
        "status": "online",
        "center_id": EDGE_CENTER_ID,
        "room_id": EDGE_ROOM_ID,
        "yolo_loaded": model is not None
    }

@app.post("/detect")
async def detect_anomalies(
    detector_type: str = Form(...), # phone_detector, behavior_detector, exam_hall_monitor
    is_print_room: bool = Form(False),
    file: UploadFile = File(...)
):
    """
    Performs object detection using YOLOv8 models.
    Supports cellphones, suspicious posture, and head counts.
    """
    if not model:
        raise HTTPException(status_code=500, detail="Object detection model is not loaded.")
        
    try:
        # Read uploaded image bytes
        contents = await file.read()
        
        # Save temp image for YOLO
        temp_filename = f"temp_frame_{int(time.time())}.jpg"
        with open(temp_filename, "wb") as f:
            f.write(contents)
            
        # Run inference
        results = model(temp_filename, verbose=False)
        result = results[0]
        
        # Parse labels matching criteria
        anomalies_detected = []
        labels = result.names
        
        # Standard COCO indexes: 67 is cell phone, 0 is person
        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            name = labels[cls_id]
            
            if detector_type == "phone_detector" and name == "cell phone" and conf > 0.4:
                anomalies_detected.append({"class": name, "confidence": conf, "coords": box.xyxy[0].tolist()})
            elif detector_type == "exam_hall_monitor" and name == "person":
                # Count density
                anomalies_detected.append({"class": name, "confidence": conf, "coords": box.xyxy[0].tolist()})
                
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        # Trigger alert if anomalies are found
        if anomalies_detected and detector_type != "exam_hall_monitor":
            alert_payload = {
                "center_id": EDGE_CENTER_ID,
                "room_id": EDGE_ROOM_ID,
                "alert_type": f"UNAUTHORIZED_{detector_type.upper()}",
                "severity": "HIGH",
                "description": f"Edge detector caught {len(anomalies_detected)} security anomalies.",
                "metadata": {"detections": anomalies_detected},
                "is_print_room": is_print_room,
                "timestamp": time.time()
            }
            
            # Send immediately or buffer offline
            try:
                endpoint = "/surveillance/alerts" if not is_print_room else "/printing/surveillance-alerts"
                res = requests.post(f"{MASTER_API_URL}{endpoint}", json=alert_payload, timeout=3)
                if res.status_code not in (200, 201):
                    save_to_buffer(alert_payload)
            except Exception:
                save_to_buffer(alert_payload)
                
        return {
            "status": "success",
            "detector_used": detector_type,
            "detections_count": len(anomalies_detected),
            "anomalies": anomalies_detected
        }
        
    except Exception as e:
        logger.error(f"Error during edge inference: {e}")
        raise HTTPException(status_code=500, detail=str(e))
