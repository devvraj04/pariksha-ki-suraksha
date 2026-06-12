from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.v1.forensic import limiter as forensic_limiter

# Import module routers
from api.v1.vault import router as vault_router
from api.v1.print_jobs import router as print_router
from api.v1.transit import router as transit_router
from api.v1.centers import router as centers_router
from api.v1.omr import router as omr_router
from api.v1.forensic import router as forensic_router
from api.v1.vision import router as vision_router
from api.v1.system import router as system_router

app = FastAPI(
    title="LeakGuard AI - Backend API",
    description="FastAPI Backend Orchestrator for LeakGuard AI security services",
    version="1.0.0"
)

# Attach slowapi rate limiter to app state (required for @limiter.limit to work)
app.state.limiter = forensic_limiter

# Custom 429 handler that returns the standard error envelope
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "ERR_RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. You are limited to 5 uploads per hour."
            }
        }
    )

# CORS Middleware to allow requests from Next.js frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standardized Error Envelope Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": f"ERR_HTTP_{exc.status_code}",
                "message": exc.detail
            }
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "ERR_VALIDATION_FAILED",
                "message": "Input validation failed.",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": "ERR_INTERNAL_SERVER_ERROR",
                "message": f"An unhandled internal server error occurred: {str(exc)}"
            }
        }
    )

# Mount all routers under /api/v1 prefix
app.include_router(vault_router, prefix="/api/v1")
app.include_router(print_router, prefix="/api/v1")
app.include_router(transit_router, prefix="/api/v1")
app.include_router(centers_router, prefix="/api/v1")
app.include_router(omr_router, prefix="/api/v1")
app.include_router(forensic_router, prefix="/api/v1")
app.include_router(vision_router, prefix="/api/v1")
app.include_router(system_router, prefix="/api/v1")
