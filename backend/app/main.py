from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.firebase import init_firebase
from backend.app.routers.auth_router import router as auth_router
from backend.app.routers.bookings_router import router as bookings_router
from backend.app.routers.resources_router import router as resources_router
from backend.app.routers.returns_router import router as returns_router
from backend.app.routers.users_router import router as users_router
from backend.app.services.seed_service import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Firebase and seed dev database if in development
    init_firebase()
    if settings.ENVIRONMENT == "test":
        seed_database(force=False)
    yield


app = FastAPI(
    title="ResourceX API",
    description="Campus Resource-Sharing & Scheduling Backend API (FastAPI + Firebase Firestore)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(resources_router)
app.include_router(bookings_router)
app.include_router(returns_router)


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint that avoids exposing secrets."""
    return {
        "status": "healthy",
        "service": "ResourceX Backend",
        "environment": settings.ENVIRONMENT,
        "college_domain": settings.COLLEGE_EMAIL_DOMAINS,
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "name": "ResourceX API",
        "version": "1.0.0",
        "docs": "/docs",
        "college_domain": settings.COLLEGE_EMAIL_DOMAINS,
    }


from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from google.api_core.exceptions import GoogleAPICallError

@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code,
                        content={"detail": exc.detail, "code": f"HTTP_{exc.status_code}"},
                        headers=exc.headers)

@app.exception_handler(GoogleAPICallError)
async def database_error(request: Request, exc: GoogleAPICallError):
    return JSONResponse(status_code=503, content={"detail": "Firebase service unavailable. Check the configured project, credentials and service access.", "code": "FIREBASE_UNAVAILABLE"})
