"""
File Utilities — upload handling, validation, cleanup
"""

import hashlib
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Tuple

import aiofiles
import structlog
from fastapi import UploadFile, HTTPException, status

from core.config import settings

logger = structlog.get_logger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
}


async def validate_and_save_file(
    file: UploadFile,
    user_id: str,
) -> Tuple[str, str, str, int]:
    """
    Validate & persist uploaded file.
    Returns: (storage_path, filename, file_type, file_size_bytes)
    """
    # Content type check
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{content_type}' not allowed. Upload PDF or DOCX.",
        )
    file_ext = ALLOWED_MIME_TYPES[content_type]

    # Read file
    contents = await file.read()
    file_size = len(contents)

    # Size check
    if file_size > settings.max_file_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB",
        )

    if file_size < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File appears to be empty or corrupt.",
        )

    # Generate unique filename
    file_hash = hashlib.md5(contents).hexdigest()[:8]
    unique_name = f"{uuid.uuid4().hex}_{file_hash}.{file_ext}"

    # Ensure upload dir exists
    upload_path = Path(settings.UPLOAD_DIR) / user_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / unique_name

    # Write file
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(contents)

    logger.info("File saved", path=str(file_path), size=file_size, user=user_id)
    return str(file_path), unique_name, file_ext, file_size


async def delete_file(path: str) -> None:
    try:
        os.remove(path)
        logger.info("File deleted", path=path)
    except FileNotFoundError:
        logger.warning("File not found for deletion", path=path)
    except OSError as e:
        logger.error("Failed to delete file", path=path, error=str(e))


def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def sanitize_filename(filename: str) -> str:
    """Remove dangerous characters from filename."""
    import re
    name = Path(filename).stem
    ext = Path(filename).suffix
    safe_name = re.sub(r"[^\w\-_\. ]", "_", name)
    return f"{safe_name[:100]}{ext}"
