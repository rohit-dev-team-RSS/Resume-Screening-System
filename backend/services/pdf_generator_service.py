"""
PDF Generator Service — Generate ATS-friendly resume PDFs using ReportLab
"""

import io
import os
from datetime import datetime
from typing import Optional

import structlog
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
)

from models.resume_model import ResumeModel

logger = structlog.get_logger(__name__)

# ─── Color Palette (ATS-safe) ─────────────────────────────────────────────────
PRIMARY = colors.HexColor("#1A1A2E")
ACCENT = colors.HexColor("#16213E")
SUBTEXT = colors.HexColor("#555555")
DIVIDER = colors.HexColor("#CCCCCC")
WHITE = colors.white


class PDFGeneratorService:

    async def generate_resume_pdf(
        self,
        resume: ResumeModel,
        output_path: str,
        template: str = "modern",
    ) -> str:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before PDF generation.")

        parsed = resume.parsed_data
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=LETTER,
            topMargin=0.6 * inch,
            bottomMargin=0.6 * inch,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
        )

        styles = self._build_styles()
        story = []

        # ── Header ────────────────────────────────────────────────────────────
        name = parsed.full_name or "Your Name"
        story.append(Paragraph(name, styles["name"]))

        contact_parts = []
        if parsed.contact_info.email:
            contact_parts.append(parsed.contact_info.email)
        if parsed.contact_info.phone:
            contact_parts.append(parsed.contact_info.phone)
        if parsed.contact_info.location:
            contact_parts.append(parsed.contact_info.location)
        if parsed.contact_info.linkedin:
            contact_parts.append(parsed.contact_info.linkedin)
        if parsed.contact_info.github:
            contact_parts.append(parsed.contact_info.github)

        if contact_parts:
            story.append(Paragraph(" | ".join(contact_parts), styles["contact"]))

        story.append(Spacer(1, 0.1 * inch))
        story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY))
        story.append(Spacer(1, 0.08 * inch))

        # ── Summary ───────────────────────────────────────────────────────────
        if parsed.summary:
            story.append(Paragraph("PROFESSIONAL SUMMARY", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))
            story.append(Paragraph(parsed.summary, styles["body"]))
            story.append(Spacer(1, 0.1 * inch))

        # ── Skills ────────────────────────────────────────────────────────────
        if parsed.skills:
            story.append(Paragraph("TECHNICAL SKILLS", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))
            skills_str = " • ".join(s.title() for s in parsed.technical_skills[:20])
            story.append(Paragraph(skills_str, styles["body"]))
            if parsed.soft_skills:
                soft_str = " • ".join(s.title() for s in parsed.soft_skills[:10])
                story.append(Paragraph(f"<i>Soft Skills:</i> {soft_str}", styles["subtext"]))
            story.append(Spacer(1, 0.1 * inch))

        # ── Work Experience ────────────────────────────────────────────────────
        if parsed.work_experience:
            story.append(Paragraph("WORK EXPERIENCE", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))

            for exp in parsed.work_experience:
                # Role + Company + Dates table
                date_str = ""
                if exp.start_date:
                    date_str = exp.start_date
                    if exp.end_date:
                        date_str += f" – {exp.end_date}"
                    elif exp.is_current:
                        date_str += " – Present"

                role_table = Table(
                    [[
                        Paragraph(exp.title or "Role", styles["job_title"]),
                        Paragraph(date_str, styles["date"]),
                    ]],
                    colWidths=["75%", "25%"],
                )
                role_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]))
                story.append(role_table)

                if exp.company:
                    story.append(Paragraph(exp.company, styles["company"]))

                if exp.description:
                    bullets = [b.strip() for b in exp.description.split(".") if b.strip() and len(b.strip()) > 20]
                    for bullet in bullets[:4]:
                        story.append(Paragraph(f"• {bullet}.", styles["bullet"]))

                if exp.technologies:
                    tech_str = f"<i>Technologies:</i> {', '.join(exp.technologies[:8])}"
                    story.append(Paragraph(tech_str, styles["tech_list"]))

                story.append(Spacer(1, 0.08 * inch))

        # ── Education ─────────────────────────────────────────────────────────
        if parsed.education:
            story.append(Paragraph("EDUCATION", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))

            for edu in parsed.education:
                degree_str = " ".join(filter(None, [edu.degree, edu.field_of_study]))
                year_str = ""
                if edu.start_year and edu.end_year:
                    year_str = f"{edu.start_year} – {edu.end_year}"
                elif edu.end_year:
                    year_str = str(edu.end_year)

                edu_table = Table(
                    [[
                        Paragraph(degree_str or "Degree", styles["job_title"]),
                        Paragraph(year_str, styles["date"]),
                    ]],
                    colWidths=["75%", "25%"],
                )
                edu_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]))
                story.append(edu_table)
                story.append(Paragraph(edu.institution, styles["company"]))
                if edu.gpa:
                    story.append(Paragraph(f"GPA: {edu.gpa}", styles["subtext"]))
                story.append(Spacer(1, 0.06 * inch))

        # ── Projects ──────────────────────────────────────────────────────────
        if parsed.projects:
            story.append(Paragraph("PROJECTS", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))
            for proj in parsed.projects[:5]:
                story.append(Paragraph(proj.name, styles["job_title"]))
                if proj.description:
                    story.append(Paragraph(proj.description[:250], styles["body"]))
                if proj.technologies:
                    story.append(Paragraph(
                        f"<i>Stack:</i> {', '.join(proj.technologies[:6])}", styles["tech_list"]
                    ))
                story.append(Spacer(1, 0.06 * inch))

        # ── Certifications ────────────────────────────────────────────────────
        if parsed.certifications:
            story.append(Paragraph("CERTIFICATIONS", styles["section_header"]))
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
            story.append(Spacer(1, 0.05 * inch))
            for cert in parsed.certifications[:6]:
                cert_str = cert.name
                if cert.issuer:
                    cert_str += f" — {cert.issuer}"
                if cert.issue_date:
                    cert_str += f" ({cert.issue_date})"
                story.append(Paragraph(f"• {cert_str}", styles["bullet"]))
            story.append(Spacer(1, 0.05 * inch))

        # ── Footer ────────────────────────────────────────────────────────────
        story.append(Spacer(1, 0.1 * inch))
        story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER))
        generated = datetime.now().strftime("%B %Y")
        story.append(Paragraph(
            f"<i>Generated by AI Career Co-Pilot | {generated}</i>", styles["footer"]
        ))

        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # Write to disk
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        logger.info("PDF generated", path=output_path, size=len(pdf_bytes))
        return output_path

    def _build_styles(self) -> dict:
        base = getSampleStyleSheet()
        return {
            "name": ParagraphStyle(
                "name", parent=base["Normal"],
                fontSize=20, fontName="Helvetica-Bold",
                textColor=PRIMARY, spaceAfter=3, alignment=TA_CENTER,
            ),
            "contact": ParagraphStyle(
                "contact", parent=base["Normal"],
                fontSize=8.5, fontName="Helvetica",
                textColor=SUBTEXT, spaceAfter=2, alignment=TA_CENTER,
            ),
            "section_header": ParagraphStyle(
                "section_header", parent=base["Normal"],
                fontSize=10, fontName="Helvetica-Bold",
                textColor=PRIMARY, spaceBefore=6, spaceAfter=2,
                letterSpacing=1.5,
            ),
            "job_title": ParagraphStyle(
                "job_title", parent=base["Normal"],
                fontSize=10.5, fontName="Helvetica-Bold",
                textColor=PRIMARY, spaceAfter=1,
            ),
            "company": ParagraphStyle(
                "company", parent=base["Normal"],
                fontSize=9.5, fontName="Helvetica-Oblique",
                textColor=SUBTEXT, spaceAfter=3,
            ),
            "date": ParagraphStyle(
                "date", parent=base["Normal"],
                fontSize=9, fontName="Helvetica",
                textColor=SUBTEXT, alignment=TA_LEFT,
            ),
            "body": ParagraphStyle(
                "body", parent=base["Normal"],
                fontSize=9.5, fontName="Helvetica",
                textColor=colors.black, leading=14, alignment=TA_JUSTIFY, spaceAfter=2,
            ),
            "bullet": ParagraphStyle(
                "bullet", parent=base["Normal"],
                fontSize=9.5, fontName="Helvetica",
                textColor=colors.black, leading=13, leftIndent=10, spaceAfter=2,
            ),
            "tech_list": ParagraphStyle(
                "tech_list", parent=base["Normal"],
                fontSize=8.5, fontName="Helvetica",
                textColor=SUBTEXT, spaceAfter=2,
            ),
            "subtext": ParagraphStyle(
                "subtext", parent=base["Normal"],
                fontSize=8.5, fontName="Helvetica",
                textColor=SUBTEXT, spaceAfter=2,
            ),
            "footer": ParagraphStyle(
                "footer", parent=base["Normal"],
                fontSize=7, fontName="Helvetica",
                textColor=SUBTEXT, alignment=TA_CENTER,
            ),
        }
