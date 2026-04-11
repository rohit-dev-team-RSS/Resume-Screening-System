"""
PDF Generator Routes — Generate ATS-friendly resume PDF
"""

import os
import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from api.deps import get_current_user, get_resume_repo, get_pdf_service
from core.config import settings
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from services.pdf_generator_service import PDFGeneratorService
from utils.validators import validate_object_id

router = APIRouter()


class GeneratePDFRequest(BaseModel):
    resume_id: str
    template: str = Field(default="modern", pattern="^(modern|classic|minimal)$")


@router.post("/generate")
async def generate_resume_pdf(
    payload: GeneratePDFRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    pdf_service: PDFGeneratorService = Depends(get_pdf_service),
):
    """
    Generate an ATS-friendly resume PDF from parsed resume data.
    Returns download URL.
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before PDF generation.",
        )

    output_dir = f"{settings.UPLOAD_DIR}/generated/{current_user.id}"
    output_filename = f"resume_{uuid.uuid4().hex[:8]}.pdf"
    output_path = os.path.join(output_dir, output_filename)

    await pdf_service.generate_resume_pdf(resume, output_path, template=payload.template)

    return {
        "success": True,
        "resume_id": payload.resume_id,
        "download_path": f"/api/v1/pdf/download/{current_user.id}/{output_filename}",
        "filename": output_filename,
        "template": payload.template,
        "message": "PDF generated successfully.",
    }


@router.get("/download/{user_id}/{filename}")
async def download_pdf(
    user_id: str,
    filename: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Download a generated resume PDF."""
    if str(current_user.id) != user_id and current_user.role.value not in ("admin", "recruiter"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.UPLOAD_DIR, "generated", user_id, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=safe_filename,
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"},
    )
