import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    NEXT_PUBLIC_SUPABASE_URL: str
    NEXT_PUBLIC_SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    PLATFORM_DOMAIN: str = "localhost"

    ENVIRONMENT: str = "development"
    STUDENT_ID_ENCRYPTION_KEY: str = ""
    INTERNAL_SERVICE_KEY: str = ""

    # JWT Keys for Admit Cards
    ADMIT_CARD_JWT_PRIVATE_KEY: str = ""
    ADMIT_CARD_JWT_PUBLIC_KEY: str = ""

    # Vault
    HSM_KEY_SHARE_ENDPOINT: str = ""
    SUPABASE_VAULT_KEY_STORE_ID: str = ""

    # Payment
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # AI / LLM
    LLM_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # IoT
    MQTT_BROKER_URL: str = "mqtt://localhost:1883"
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""

    # Live CCTV
    WEBRTC_RELAY_URL: str = ""

    # Communications
    SMS_OTP_PROVIDER_KEY: str = ""
    EMAIL_PROVIDER_KEY: str = ""

    # Result PDF
    RESULT_PDF_SIGNING_KEY: str = ""

    # Watermark
    WATERMARK_MASTER_KEY: str = ""

settings = Settings()
