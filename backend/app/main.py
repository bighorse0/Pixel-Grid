from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import admin, blocks, moderation, payments
from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="BloxGrid API",
    description="Modern pixel grid marketplace with Roblox aesthetics",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(admin.router)
app.include_router(blocks.router)
app.include_router(moderation.router)
app.include_router(payments.router)


@app.get("/")
async def root():
    return {
        "message": "BloxGrid API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
