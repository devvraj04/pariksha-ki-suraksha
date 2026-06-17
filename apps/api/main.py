from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apps.api.routers import public, admin, agencies, exams, students, vault, printing, transit, dayof, answersheet, center_auth, evaluation, results, leaks, whistleblower, grievance
from apps.api.core.config import settings

app = FastAPI(
    title="ParikshaSetu AI - Security & Examination Management Portal API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

import re
# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    f"http://{settings.PLATFORM_DOMAIN}",
    f"https://{settings.PLATFORM_DOMAIN}"
]

escaped_domain = re.escape(settings.PLATFORM_DOMAIN)
origin_regex = rf"https?://(?:.*\.)?{escaped_domain}(?::[0-9]+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    # Always print error log server-side
    traceback.print_exc()
    
    detail_msg = "An internal server error occurred." if settings.ENVIRONMENT == "production" else str(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "code": "INTERNAL_SERVER_ERROR",
            "detail": detail_msg
        }
    )

# Include routers under /api/v1
app.include_router(public.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(agencies.router, prefix="/api/v1")
app.include_router(exams.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(vault.router, prefix="/api/v1")
app.include_router(printing.router, prefix="/api/v1")
app.include_router(transit.router, prefix="/api/v1")
app.include_router(dayof.router, prefix="/api/v1")
app.include_router(answersheet.router, prefix="/api/v1")
app.include_router(center_auth.router, prefix="/api/v1")
app.include_router(evaluation.router, prefix="/api/v1")
app.include_router(results.router, prefix="/api/v1")
app.include_router(leaks.router, prefix="/api/v1")
app.include_router(whistleblower.router, prefix="/api/v1")
app.include_router(grievance.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "ParikshaSetu AI API is fully functional"}
