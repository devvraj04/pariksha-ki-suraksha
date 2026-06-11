import time

print("OpenCV + EasyOCR Forensic Worker pipeline skeleton running...", flush=True)

try:
    while True:
        time.sleep(3600)
except KeyboardInterrupt:
    print("Exiting gracefully...")
