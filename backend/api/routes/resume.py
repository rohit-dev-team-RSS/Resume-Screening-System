"""
Resume Routes — Upload, Parse, List, Delete
"""

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from core.config import settings
from api.deps import (
    get_current_user, get_resume_repo, get_parser_service, get_user_repo,
    PaginationParams
)
from models.resume_model import ResumeModel, ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from repositories.user_repo import UserRepository
from schemas.resume_schema import (
    ResumeUploadResponse, ResumeDetailResponse,
    ResumeListResponse, ResumeUpdateRequest
)
from services.parser_service import ParserService
from utils.file_utils import validate_and_save_file, delete_file, sanitize_filename
from utils.validators import validate_object_id
from services.gamification_service import GamificationService
from services.pdf_generator_service import upload_to_ftp
from config.db import get_database
from fastapi import Depends
from ftplib import FTP
import os
import uuid
from core.config import settings


logger = structlog.get_logger(__name__)

def get_gamification_service(db=Depends(get_database)) -> GamificationService:
    return GamificationService(db)

router = APIRouter()


async def _parse_resume_background(
    resume_id: str,
    file_path: str,
    file_type: str,
    resume_repo: ResumeRepository,
    user_repo: UserRepository,
    user_id: str,
    parser: ParserService,
):
    """Background task: parse uploaded resume and save structured data."""
    try:
        await resume_repo.update_status(resume_id, ResumeStatus.PROCESSING)
        parsed = await parser.parse_resume(file_path, file_type)
        await resume_repo.update_parsed_data(resume_id, parsed.model_dump())
        await user_repo.increment_counter(user_id, "total_resumes")
        logger.info("Resume parsed", resume_id=resume_id)

    except Exception as e:
        logger.error("Resume parse failed", resume_id=resume_id, error=str(e))
        await resume_repo.update_status(resume_id, ResumeStatus.FAILED, error=str(e))

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)



# ─── POST /resume/upload ──────────────────────────────────────────────────────
# @router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
# async def upload_resume(
#     background_tasks: BackgroundTasks,
#     file: UploadFile = File(..., description="PDF or DOCX resume file"),
#     current_user: UserModel = Depends(get_current_user),
#     resume_repo: ResumeRepository = Depends(get_resume_repo),
#     user_repo: UserRepository = Depends(get_user_repo),
#     parser: ParserService = Depends(get_parser_service),
#     gamification: GamificationService = Depends(get_gamification_service),
# ):
#     """Upload a resume (PDF/DOCX) — triggers async parsing."""
#     storage_path, filename, file_type, file_size = await validate_and_save_file(
#         file, str(current_user.id)
#     )

#     # keep original filename from validate_and_save_file
#     # it's already unique
#     # 🔥 Upload to Hostinger
#     try:
#         upload_to_hostinger(storage_path, filename)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"FTP Upload Failed: {str(e)}")

#     # 🌐 Generate public URL
#     file_url = f"https://techhubtechnology.com/uploads/resumes/{filename}"
#     original_filename = sanitize_filename(file.filename or "resume")
#     # ✅ calculate version
#     count = await resume_repo.count_by_user(str(current_user.id))
#     version = count + 1
#     await resume_repo.collection.update_many(
#         {"user_id": str(current_user.id)},
#         {"$set": {"is_primary": False}}
#     )
#     resume_data = {
#         "user_id": str(current_user.id),
#         "filename": filename,
#         "original_filename": original_filename,
#         "file_type": file_type,
#         "file_size_bytes": file_size,
#         "storage_path": storage_path,   # local path
#         "file_url": file_url,          # public URL
#         "status": ResumeStatus.PENDING,
#         "tags": [],
#         "is_primary": True,
#         "version": version,
#     }
#     resume = await resume_repo.create(resume_data)
    
#     await gamification.mark_daily_activity(str(current_user.id))

#     background_tasks.add_task(
#         _parse_resume_background,
#         str(resume.id), storage_path, file_type,
#         resume_repo, user_repo, str(current_user.id), parser,
#     )

#     return ResumeUploadResponse(
#         resume_id=str(resume.id),
#         filename=filename,
#         status=ResumeStatus.PENDING,
#         message="Resume uploaded. Parsing in progress — check status in a few seconds.",
#     )

def upload_resume_to_ftp(local_file_path, remote_filename):
    from ftplib import FTP
    from core.config import settings

    try:
        print("🔌 Connecting FTP...")
        ftp = FTP()
        ftp.connect(settings.FTP_HOST, settings.FTP_PORT, timeout=10)
        ftp.login(settings.FTP_USERNAME, settings.FTP_PASSWORD)
        ftp.set_pasv(True)

        print("📁 Changing directory...")
        try:
            ftp.cwd("resumes")   # 🔥 DIRECT folder
        except:
            ftp.mkd("resumes")
            ftp.cwd("resumes")

        print("⬆ Uploading file...")
        with open(local_file_path, "rb") as f:
            ftp.storbinary(f"STOR {remote_filename}", f)

        ftp.quit()

        url = f"{settings.FTP_BASE_URL}/resumes/{remote_filename}"
        print("✅ Uploaded:", url)

        return url

    except Exception as e:
        print("🔥 FTP ERROR:", str(e))
        raise

    
@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF or DOCX resume file"),
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    parser: ParserService = Depends(get_parser_service),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Upload a resume (PDF/DOCX) — triggers async parsing."""

    # ✅ Save locally
    storage_path, filename, file_type, file_size = await validate_and_save_file(
        file, str(current_user.id)
    )

    # ✅ Upload 
    try:
        filename = os.path.basename(storage_path)

        ftp_url = upload_resume_to_ftp(storage_path, filename)

        if not ftp_url:
            raise HTTPException(status_code=500, detail="FTP Upload Failed")

        file_url = ftp_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FTP upload failed: {str(e)}")

    original_filename = sanitize_filename(file.filename or "resume")

    # # ✅ Version logic
    # count = await resume_repo.count_by_user(str(current_user.id))
    # version = count + 1

    # # ✅ Make old resumes inactive
    # await resume_repo.collection.update_many(
    #     {"user_id": str(current_user.id)},
    #     {"$set": {"is_primary": False}}
    # )
    # 🔥 DELETE old resumes (only keep latest)
    await resume_repo.collection.delete_many({
        "user_id": str(current_user.id)
    })

    # ✅ Save in DB
    resume_data = {
        "user_id": str(current_user.id),
        "filename": filename,
        "original_filename": original_filename,
        "file_type": file_type,
        "file_size_bytes": file_size,
        "storage_path": storage_path,   # for parsing
        "file_url": file_url,           # for recruiter
        "status": ResumeStatus.PENDING,
        "tags": [],
        "is_primary": True
    }

    resume = await resume_repo.create(resume_data)

    # ✅ Gamification
    await gamification.mark_daily_activity(str(current_user.id))

    # ✅ Background parsing
    background_tasks.add_task(
        _parse_resume_background,
        str(resume.id), storage_path, file_type,
        resume_repo, user_repo, str(current_user.id), parser,
    )

    return ResumeUploadResponse(
        resume_id=str(resume.id),
        filename=filename,
        status=ResumeStatus.PENDING,
        message="Resume uploaded. Parsing in progress — check status in a few seconds.",
    )


# ─── GET /resume/ ─────────────────────────────────────────────────────────────
@router.get("/", response_model=ResumeListResponse)
async def list_resumes(
    pagination: PaginationParams = Depends(),
    status_filter: ResumeStatus = Query(default=None, alias="status"),
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """List all resumes for the authenticated user."""
    resumes, total = await resume_repo.get_by_user(
        str(current_user.id),
        skip=pagination.skip,
        limit=pagination.page_size,
        status=status_filter,
    )
    return ResumeListResponse(
        resumes=[_resume_to_response(r) for r in resumes],
        total=total,
    )


# ─── GET /resume/{resume_id} ──────────────────────────────────────────────────
@router.get("/{resume_id}", response_model=ResumeDetailResponse)
async def get_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Get a specific resume by ID."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    return _resume_to_response(resume)


# ─── PUT /resume/{resume_id} ──────────────────────────────────────────────────
@router.put("/{resume_id}", response_model=ResumeDetailResponse)
async def update_resume(
    resume_id: str,
    payload: ResumeUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Update resume tags or mark as primary."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    update_data = payload.model_dump(exclude_none=True)
    updated = await resume_repo.update(resume_id, update_data)
    return _resume_to_response(updated)


# ─── POST /resume/{resume_id}/reparse ─────────────────────────────────────────
@router.post("/{resume_id}/reparse", response_model=ResumeUploadResponse)
async def reparse_resume(
    resume_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    parser: ParserService = Depends(get_parser_service),
):
    """Re-trigger parsing for an existing resume."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    background_tasks.add_task(
        _parse_resume_background,
        resume_id, resume.storage_path, resume.file_type,
        resume_repo, user_repo, str(current_user.id), parser,
    )
    return ResumeUploadResponse(
        resume_id=resume_id,
        filename=resume.filename,
        status=ResumeStatus.PENDING,
        message="Reparsing triggered.",
    )


# ─── DELETE /resume/{resume_id} ───────────────────────────────────────────────
@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: str,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Delete a resume and its stored file."""
    validate_object_id(resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    # await delete_file(local_path)
    await delete_file(resume.storage_path)
    deleted = await resume_repo.delete(resume_id, str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Delete failed.")


def _resume_to_response(resume: ResumeModel) -> ResumeDetailResponse:
    return ResumeDetailResponse(
        id=str(resume.id),
        user_id=resume.user_id,
        filename=resume.filename,
        original_filename=resume.original_filename,
        file_type=resume.file_type,
        file_url=resume.file_url,
        file_size_bytes=resume.file_size_bytes,
        status=resume.status,
        parsed_data=resume.parsed_data,
        tags=resume.tags,
        is_primary=resume.is_primary,
        version=resume.version,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )
