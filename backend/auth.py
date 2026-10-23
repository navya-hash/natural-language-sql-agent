
# This uses Clerk's official Python SDK to verify the incoming session token and obtain the user ID from the verified token's sub claim. The authorized_parties allowlist restricts which frontend origins are accepted.


# CLERK_SECRET_KEY: Your backend's Clerk secret key, used for trusted server-side authentication operations.

# CLERK_JWT_KEY: An optional JWT verification key, depending on the verification method and your Clerk configuration.

# The sub claim means subject. In a Clerk session token, it normally identifies the Clerk user.
    

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from clerk_backend_api import (
    authenticate_request,
    AuthenticateRequestOptions,
)

# Load Clerk configuration from backend/.env.
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env", override=False)


def require_user(request: Request) -> str:
    """
    Verify a Clerk session token and return the authenticated Clerk user ID.
    """

    secret_key = os.getenv("CLERK_SECRET_KEY")
    jwt_key = os.getenv("CLERK_JWT_KEY")

    authorized_parties = [
        origin.strip()
        for origin in os.getenv(
            "CLERK_AUTHORIZED_PARTIES",
            "http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]

    if not secret_key:
        raise HTTPException(
            status_code=500,
            detail="Authentication is not configured.",
        )

    try:
        state = authenticate_request(
            request,
            AuthenticateRequestOptions(
                secret_key=secret_key,
                jwt_key=jwt_key or None,
                authorized_parties=authorized_parties,
                accepts_token=["session_token"],
            ),
        )
    except Exception:
        # Keep token-validation details out of client responses.
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )

    if not state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    user_id = state.payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has no user identity.",
        )

    return user_id
