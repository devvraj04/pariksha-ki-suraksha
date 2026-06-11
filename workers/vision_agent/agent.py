import time
import sys

print("YOLOv8 Vision Agent standalone worker skeleton running...", flush=True)
print(f"Args: {sys.argv}", flush=True)

try:
    while True:
        time.sleep(3600)
except KeyboardInterrupt:
    print("Exiting gracefully...")
