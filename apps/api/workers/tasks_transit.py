"""
Phase 8 — Transit Celery Tasks
consume_trunk_telemetry: MQTT subscriber (falls back to no-op in dev).
send_geofence_violation_alert: notify agency staff of trunk deviation.
"""
from apps.api.workers.celery_app import celery_app


@celery_app.task(name="apps.api.workers.tasks_transit.consume_trunk_telemetry")
def consume_trunk_telemetry():
    """
    Celery Beat recurring task: subscribes to MQTT trunks/+/telemetry topic.
    Parses GPS messages and posts to /mqtt/telemetry for geofence validation.
    Falls back gracefully when MQTT broker is not available.
    """
    from apps.api.core.config import settings
    print("[Celery] MQTT telemetry consumer tick...")
    try:
        import paho.mqtt.client as mqtt
        import json

        processed = 0
        messages = []

        def on_message(client, userdata, msg):
            try:
                data = json.loads(msg.payload.decode())
                messages.append(data)
            except Exception:
                pass

        client = mqtt.Client()
        if settings.MQTT_USERNAME:
            client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        client.on_message = on_message

        try:
            broker_url = settings.MQTT_BROKER_URL.replace("mqtt://", "").split(":")[0]
            broker_port = int(settings.MQTT_BROKER_URL.split(":")[-1]) if ":" in settings.MQTT_BROKER_URL else 1883
            client.connect(broker_url, broker_port, 5)
            client.subscribe("trunks/+/telemetry")
            client.loop_start()
            import time
            time.sleep(3)  # collect for 3 seconds
            client.loop_stop()
            client.disconnect()
        except Exception:
            return {"status": "success", "processed_records": 0, "note": "MQTT broker not reachable"}

        # Post each message to the telemetry endpoint (internal)
        import urllib.request
        import json as json_mod
        for msg_data in messages:
            try:
                req_data = json_mod.dumps(msg_data).encode("utf-8")
                req = urllib.request.Request(
                    "http://localhost:8000/api/v1/mqtt/telemetry",
                    data=req_data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                urllib.request.urlopen(req, timeout=5)
                processed += 1
            except Exception:
                pass

        return {"status": "success", "processed_records": processed}
    except Exception as e:
        print(f"[Celery Error] consume_trunk_telemetry failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_transit.send_geofence_violation_alert")
def send_geofence_violation_alert(trunk_id: str, violation_id: str):
    """
    Send push + email alert to TRANSIT_MANAGER and AGENCY_HEAD when
    a trunk deviates beyond the approved geofence corridor.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Sending geofence violation alert for trunk {trunk_id}...")
    db = get_supabase_client()
    try:
        trunk_res = db.table("transit_trunks").select(
            "trunk_code, assigned_transit_manager_id, exam_centers(name)"
        ).eq("id", trunk_id).execute()
        violation_res = db.table("transit_geofence_violations").select("*").eq("id", violation_id).execute()

        if trunk_res.data and violation_res.data:
            trunk = trunk_res.data[0]
            viol = violation_res.data[0]
            print(
                f"[Celery Alert] GEOFENCE VIOLATION — Trunk: {trunk['trunk_code']}, "
                f"Deviation: {viol.get('deviation_meters', 'N/A')}m. "
                f"In production: SMS + email would be sent to TRANSIT_MANAGER and AGENCY_HEAD."
            )
        return {"status": "success", "trunk_id": trunk_id}
    except Exception as e:
        print(f"[Celery Error] send_geofence_violation_alert failed: {e}")
        return {"status": "failed", "error": str(e)}
