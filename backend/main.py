import os
import hmac
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv()
import re
import hashlib
import secrets
import base64
import psycopg2
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from database import get_connection
security = HTTPBearer()
app = FastAPI(
    title="Accessible World API",
    description="Backend for Accessible World"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://bchaitanyaramakrishna-stack.github.io"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)
@app.get("/")
def home():
    return {
        "message": "Welcome to Accessible World API",
        "status": "Running"
    }
@app.get("/health")
def health():
    return {"status": "healthy"}
@app.get("/db-test")
def test_database():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 'Connected!'")
                result = cursor.fetchone()
        return {
            "database": "PostgreSQL",
            "status": result[0]
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed. Check PostgreSQL connection settings."
        )
# USER REGISTRATION
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=8, max_length=128)
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 600000
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations
    )
    salt_encoded = base64.urlsafe_b64encode(
        salt
    ).decode("utf-8")
    hash_encoded = base64.urlsafe_b64encode(
        password_hash
    ).decode("utf-8")
    return (
        f"pbkdf2_sha256${iterations}"
        f"${salt_encoded}${hash_encoded}"
    )
@app.post("/register")
def register_user(user: RegisterRequest):
    full_name = user.full_name.strip()
    email = user.email.strip().lower()
    password = user.password
    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid full name."
        )
    if not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+",
        email
    ):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address."
        )
    if not any(c.isalpha() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one letter."
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one number."
        )
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT USER_ID
                    FROM USERS
                    WHERE EMAIL = %(email)s
                    """,
                    {"email": email}
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail="Email is already registered."
                    )
                password_hash = hash_password(password)
                cursor.execute(
                    """
                    INSERT INTO USERS (
                        FULL_NAME,
                        EMAIL,
                        PASSWORD_HASH
                    )
                    VALUES (
                        %(full_name)s,
                        %(email)s,
                        %(password_hash)s
                    )
                    RETURNING USER_ID
                    """,
                    {
                        "full_name": full_name,
                        "email": email,
                        "password_hash": password_hash
                    }
                )
                user_id = cursor.fetchone()[0]
            connection.commit()
        return {
            "message": "Registration successful!",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered."
        )

    except psycopg2.IntegrityError:
        raise HTTPException(
            status_code=500,
            detail="Database constraint error."
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Registration failed. Please try again."
        )
# USER LOGIN AND AUTHENTICATION
class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=1, max_length=128)
def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_encoded, hash_encoded = (
            stored_hash.split("$")
        )
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_encoded)
        expected_hash = base64.urlsafe_b64decode(hash_encoded)
        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations)
        )
        return hmac.compare_digest(actual_hash, expected_hash)
    except (ValueError, TypeError):
        return False
@app.post("/login")
def login_user(user: LoginRequest):
    email = user.email.strip().lower()
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT USER_ID, FULL_NAME, EMAIL,
                           PASSWORD_HASH, USER_ROLE
                    FROM USERS
                    WHERE EMAIL = %(email)s
                    """,
                    {"email": email}
                )
                result = cursor.fetchone()
        if not result or not verify_password(user.password, result[3]):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password."
            )
        secret_key = os.getenv("JWT_SECRET_KEY")
        if not secret_key:
            raise HTTPException(
                status_code=500,
                detail="Authentication configuration is missing."
            )
        user_id, full_name, email, password_hash, user_role = result
        token = jwt.encode(
            {
                "sub": str(user_id),
                "role": user_role,
                "exp": datetime.now(timezone.utc) + timedelta(hours=1)
            },
            secret_key,
            algorithm="HS256"
        )
        return {
            "message": "Login successful!",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "user_id": user_id,
                "full_name": full_name,
                "email": email,
                "user_role": user_role
            }
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Login failed. Please try again."
        )
# VERIFY LOGGED-IN USER
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        raise HTTPException(
            status_code=500,
            detail="Authentication configuration is missing."
        )
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=["HS256"]
        )
        user_id = int(payload["sub"])
        user_role = payload["role"]
        return {
            "user_id": user_id,
            "user_role": user_role
        }
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    # VERIFY ADMINISTRATOR
def get_current_admin(
    current_user: dict = Depends(get_current_user)
):
    if current_user["user_role"] != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )
    return current_user
    # ACCESSIBILITY REPORT SUBMISSION
class ReportRequest(BaseModel):
    location_id: int = Field(gt=0)
    report_type: str = Field(min_length=2, max_length=100)
    report_description: str = Field(min_length=5, max_length=2000)
@app.post("/reports")
def submit_report(
    report: ReportRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO REPORTS (
                        USER_ID,
                        LOCATION_ID,
                        REPORT_TYPE,
                        REPORT_DESCRIPTION,
                        STATUS
                    )
                    VALUES (
                        %(user_id)s,
                        %(location_id)s,
                        %(report_type)s,
                        %(report_description)s,
                        'PENDING'
                    )
                    RETURNING REPORT_ID
                    """,
                    {
                        "user_id": current_user["user_id"],
                        "location_id": report.location_id,
                        "report_type": report.report_type.strip(),
                        "report_description": report.report_description.strip()
                    }
                )
                report_id = cursor.fetchone()[0]
            connection.commit()
        return {
            "message": "Accessibility report submitted successfully!",
            "report_id": int(report_id),
            "status": "PENDING"
        }
    except psycopg2.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Invalid user or location reference."
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not submit the accessibility report."
        )
    # ADMIN VIEW ALL REPORTS
@app.get("/admin/reports")
def get_all_reports(
    admin: dict = Depends(get_current_admin)
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        r.REPORT_ID,
                        r.USER_ID,
                        u.FULL_NAME,
                        u.EMAIL,
                        r.LOCATION_ID,
                        l.NAME,
                        r.REPORT_TYPE,
                        r.REPORT_DESCRIPTION,
                        r.STATUS,
                        r.CREATED_AT
                    FROM REPORTS r
                    JOIN USERS u
                        ON r.USER_ID = u.USER_ID
                    JOIN LOCATIONS l
                        ON r.LOCATION_ID = l.LOCATION_ID
                    ORDER BY r.CREATED_AT DESC
                """)
                rows = cursor.fetchall()
                reports = []
                for row in rows:
                    reports.append({
                        "report_id": row[0],
                        "user_id": row[1],
                        "full_name": row[2],
                        "email": row[3],
                        "location_id": row[4],
                        "location_name": row[5],
                        "report_type": row[6],
                        "report_description": row[7],
                        "status": row[8],
                        "created_at": (
                            row[9].isoformat()
                            if row[9] else None
                        )
                    })
        return reports
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve accessibility reports."
        )
class ReportStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=8)
@app.patch("/admin/reports/{report_id}/status")
def update_report_status(
    report_id: int,
    update: ReportStatusRequest,
    admin: dict = Depends(get_current_admin)
):
    new_status = update.status.strip().upper()
    if new_status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be APPROVED or REJECTED."
        )
    if report_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid report ID."
        )
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE REPORTS
                    SET STATUS = %(status)s
                    WHERE REPORT_ID = %(report_id)s
                    """,
                    {
                        "status": new_status,
                        "report_id": report_id
                    }
                )
                if cursor.rowcount == 0:
                    raise HTTPException(
                        status_code=404,
                        detail="Report not found."
                    )
            connection.commit()
        return {
            "message": "Report status updated successfully!",
            "report_id": report_id,
            "status": new_status
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update report status."
        )
@app.get("/my-reports")
def get_my_reports(
    current_user: dict = Depends(get_current_user)
):
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        r.REPORT_ID,
                        r.LOCATION_ID,
                        l.NAME,
                        r.REPORT_TYPE,
                        r.REPORT_DESCRIPTION,
                        r.STATUS,
                        r.CREATED_AT
                    FROM REPORTS r
                    JOIN LOCATIONS l
                        ON r.LOCATION_ID = l.LOCATION_ID
                    WHERE r.USER_ID = %(user_id)s
                    ORDER BY r.CREATED_AT DESC
                    """,
                    {"user_id": current_user["user_id"]}
                )
                rows = cursor.fetchall()
                reports = []
                for row in rows:
                    reports.append({
                        "report_id": row[0],
                        "location_id": row[1],
                        "location_name": row[2],
                        "report_type": row[3],
                        "report_description": row[4],
                        "status": row[5],
                        "created_at": row[6].isoformat() if row[6] else None
                    })
        return reports
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve your reports."
        )
@app.get("/locations")
def get_locations():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        l.location_id,
                        l.name,
                        l.address,
                        l.city,
                        l.description,
                        l.latitude,
                        l.longitude,
                        f.feature_name,
                        lf.availability,
                        lf.notes
                    FROM LOCATIONS l
                    LEFT JOIN LOCATION_FEATURES lf
                        ON l.location_id = lf.location_id
                    LEFT JOIN ACCESSIBILITY_FEATURES f
                        ON lf.feature_id = f.feature_id
                    ORDER BY l.location_id, f.feature_name
                """)
                rows = cursor.fetchall()
        locations = {}
        for row in rows:
            location_id = row[0]
            if location_id not in locations:
                locations[location_id] = {
                    "location_id": location_id,
                    "name": row[1],
                    "address": row[2],
                    "city": row[3],
                    "description": row[4],
                    "latitude": float(row[5]) if row[5] is not None else None,
                    "longitude": float(row[6]) if row[6] is not None else None,
                    "features": []
                }
            if row[7] is not None:
                locations[location_id]["features"].append({
                    "feature_name": row[7],
                    "availability": row[8],
                    "notes": row[9]
                })
        return list(locations.values())
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve locations and accessibility features."
        )




# USER PROFILE

class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)


def fetch_user_profile(user_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    u.USER_ID,
                    u.FULL_NAME,
                    u.EMAIL,
                    u.USER_ROLE,
                    u.CREATED_AT,
                    COUNT(r.REPORT_ID) AS TOTAL_REPORTS,
                    COUNT(r.REPORT_ID) FILTER (
                        WHERE r.STATUS = 'PENDING'
                    ) AS PENDING_REPORTS,
                    COUNT(r.REPORT_ID) FILTER (
                        WHERE r.STATUS = 'APPROVED'
                    ) AS APPROVED_REPORTS,
                    COUNT(r.REPORT_ID) FILTER (
                        WHERE r.STATUS = 'REJECTED'
                    ) AS REJECTED_REPORTS
                FROM USERS u
                LEFT JOIN REPORTS r
                    ON u.USER_ID = r.USER_ID
                WHERE u.USER_ID = %(user_id)s
                GROUP BY
                    u.USER_ID,
                    u.FULL_NAME,
                    u.EMAIL,
                    u.USER_ROLE,
                    u.CREATED_AT
                """,
                {"user_id": user_id}
            )

            row = cursor.fetchone()

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail="User profile not found."
                )

            return {
                "user_id": row[0],
                "full_name": row[1],
                "email": row[2],
                "user_role": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "total_reports": row[5],
                "pending_reports": row[6],
                "approved_reports": row[7],
                "rejected_reports": row[8]
            }


@app.get("/profile")
def get_user_profile(
    current_user: dict = Depends(get_current_user)
):
    try:
        return fetch_user_profile(current_user["user_id"])

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve your profile."
        )


@app.patch("/profile")
def update_user_profile(
    profile: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    full_name = profile.full_name.strip()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid full name."
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE USERS
                    SET FULL_NAME = %(full_name)s
                    WHERE USER_ID = %(user_id)s
                    """,
                    {
                        "full_name": full_name,
                        "user_id": current_user["user_id"]
                    }
                )

                if cursor.rowcount == 0:
                    raise HTTPException(
                        status_code=404,
                        detail="User not found."
                    )

            connection.commit()

        return {
            "message": "Profile updated successfully!",
            "profile": fetch_user_profile(
                current_user["user_id"]
            )
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not update your profile."
        )
