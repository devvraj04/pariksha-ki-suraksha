import os
import sys
import time
import argparse
import base64
import json
import httpx
import numpy as np
import cv2
from ultralytics import YOLO

def main():
    parser = argparse.ArgumentParser(description="LeakGuard AI - Standalone CV Vision Agent")
    parser.add_argument("--location-type", choices=["print_room", "exam_hall"], required=True, help="Location type being monitored")
    parser.add_argument("--location-id", required=True, help="UUID of the location/center")
    parser.add_argument("--webcam-index", type=int, default=0, help="Webcam device index")
    parser.add_argument("--api-base-url", required=True, help="FastAPI backend base URL")
    parser.add_argument("--internal-api-key", required=True, help="API key for internal worker requests")
    
    args = parser.parse_args()
    
    # Load YOLOv8 model
    model_path = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    print(f"Loading YOLOv8 model from {model_path}...", flush=True)
    try:
        model = YOLO(model_path)
        print("Model loaded successfully.", flush=True)
    except Exception as e:
        print(f"Error loading model: {str(e)}", flush=True)
        sys.exit(1)
        
    target_classes = ["cell phone"]
    if args.location_type == "exam_hall":
        target_classes.append("remote")
        
    confidence_threshold = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.65"))
    print(f"Vision agent configuration: Location={args.location_type} ({args.location_id}), Threshold={confidence_threshold}", flush=True)
    
    # Webcam capture setup
    mock_mode = os.getenv("MOCK_WEBCAM", "false").lower() == "true" or os.getenv("SIMULATE_VIOLATION", "false").lower() == "true"
    cap = None
    
    if not mock_mode:
        cap = cv2.VideoCapture(args.webcam_index)
        if not cap.isOpened():
            print(f"Warning: Failed to open webcam at index {args.webcam_index}. Falling back to Mock Webcam mode.", flush=True)
            mock_mode = True
            
    print("Vision agent running...", flush=True)
    frame_count = 0
    start_time = time.time()
    last_alert_time = 0
    alert_cooldown = 10.0 # seconds
    
    try:
        while True:
            frame_count += 1
            
            if mock_mode:
                time.sleep(0.1) # Simulate frame rate
                # Generate black frame with text
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"Mock Frame {frame_count}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                
                simulate_violation = os.getenv("SIMULATE_VIOLATION", "false").lower() == "true"
                elapsed = time.time() - start_time
                
                # In simulation mode, trigger a cell phone detection after 3 seconds
                if simulate_violation and elapsed > 3.0:
                    print(f"Simulating security violation: cell phone detected (confidence 0.88)", flush=True)
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_jpeg_b64 = base64.b64encode(buffer).decode('utf-8')
                    
                    payload = {
                        "agent_id": f"agent_{args.location_type}_{args.location_id[:8]}",
                        "location_type": args.location_type,
                        "location_id": args.location_id,
                        "detected_class": "cell phone",
                        "confidence": 0.88,
                        "frame_jpeg_b64": frame_jpeg_b64
                    }
                    
                    headers = {
                        "X-Internal-API-Key": args.internal_api_key,
                        "Content-Type": "application/json"
                    }
                    
                    url = f"{args.api_base_url.rstrip('/')}/api/v1/vision/alert"
                    print(f"Sending alert to: {url}...", flush=True)
                    try:
                        resp = httpx.post(url, headers=headers, json=payload, timeout=10.0)
                        print(f"Alert response status: {resp.status_code}, body: {resp.text}", flush=True)
                    except Exception as err:
                        print(f"Failed to deliver simulated alert: {str(err)}", flush=True)
                    
                    # Exit simulated mode after firing the single alert
                    print("Simulation complete. Exiting.", flush=True)
                    break
            else:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Failed to read frame from webcam.", flush=True)
                    time.sleep(1.0)
                    continue
                    
                # Process inference on every 5th frame
                if frame_count % 5 == 0:
                    results = model(frame, verbose=False)
                    for result in results:
                        boxes = result.boxes
                        for box in boxes:
                            class_id = int(box.cls[0])
                            conf = float(box.conf[0])
                            class_name = model.names[class_id]
                            
                            if class_name in target_classes and conf >= confidence_threshold:
                                current_time = time.time()
                                if current_time - last_alert_time >= alert_cooldown:
                                    last_alert_time = current_time
                                    print(f"Detection alert! {class_name} detected with confidence {conf:.2f}", flush=True)
                                    
                                    _, buffer = cv2.imencode('.jpg', frame)
                                    frame_jpeg_b64 = base64.b64encode(buffer).decode('utf-8')
                                    
                                    payload = {
                                        "agent_id": f"agent_{args.location_type}_{args.location_id[:8]}",
                                        "location_type": args.location_type,
                                        "location_id": args.location_id,
                                        "detected_class": class_name,
                                        "confidence": conf,
                                        "frame_jpeg_b64": frame_jpeg_b64
                                    }
                                    
                                    headers = {
                                        "X-Internal-API-Key": args.internal_api_key,
                                        "Content-Type": "application/json"
                                    }
                                    
                                    url = f"{args.api_base_url.rstrip('/')}/api/v1/vision/alert"
                                    try:
                                        resp = httpx.post(url, headers=headers, json=payload, timeout=10.0)
                                        print(f"Alert dispatched: {resp.status_code}", flush=True)
                                    except Exception as err:
                                        print(f"Failed to dispatch alert to backend: {str(err)}", flush=True)
    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Shutting down.", flush=True)
    finally:
        if cap is not None:
            cap.release()
        print("Vision agent shut down.", flush=True)

if __name__ == "__main__":
    main()
