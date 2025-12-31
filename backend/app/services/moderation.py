import hashlib
import io
import re
from PIL import Image
import boto3
import openai
from sqlalchemy.orm import Session
from ..models import ModerationCheck, BannedContent, BlockImage
from ..config import get_settings
import requests

settings = get_settings()
openai.api_key = settings.openai_api_key


class ModerationService:
    def __init__(self, db: Session):
        self.db = db
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        self.rekognition_client = boto3.client(
            'rekognition',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )

    def calculate_image_hash(self, image_bytes: bytes) -> str:
        """Calculate SHA256 hash of image"""
        return hashlib.sha256(image_bytes).hexdigest()

    def check_banned_hash(self, image_hash: str) -> bool:
        """Check if image hash is banned"""
        banned = self.db.query(BannedContent).filter(
            BannedContent.ban_type == 'image_hash',
            BannedContent.value == image_hash
        ).first()
        return banned is not None

    def check_banned_domain(self, url: str) -> bool:
        """Check if URL domain is banned"""
        domain = re.search(r'https?://([^/]+)', url)
        if not domain:
            return False

        domain_name = domain.group(1).lower()
        banned = self.db.query(BannedContent).filter(
            BannedContent.ban_type == 'domain'
        ).all()

        for ban in banned:
            if ban.value.lower() in domain_name:
                return True
        return False

    async def moderate_image_openai(self, image_url: str, block_image_id: str) -> dict:
        """Run OpenAI image moderation"""
        try:
            response = openai.moderations.create(
                input=image_url
            )
            result = response.results[0]

            flagged_categories = [
                category for category, flagged in result.categories.dict().items()
                if flagged
            ]

            check = ModerationCheck(
                block_image_id=block_image_id,
                check_type='openai_image',
                result=result.dict(),
                flagged=result.flagged,
                confidence=None,
                flagged_categories=flagged_categories if flagged_categories else None
            )
            self.db.add(check)
            self.db.commit()

            return {
                'flagged': result.flagged,
                'categories': flagged_categories
            }
        except Exception as e:
            print(f"OpenAI moderation error: {e}")
            return {'flagged': False, 'categories': [], 'error': str(e)}

    async def moderate_image_rekognition(self, s3_key: str, block_image_id: str) -> dict:
        """Run AWS Rekognition moderation"""
        try:
            response = self.rekognition_client.detect_moderation_labels(
                Image={
                    'S3Object': {
                        'Bucket': settings.s3_bucket_name,
                        'Name': s3_key
                    }
                },
                MinConfidence=60.0
            )

            flagged_categories = []
            max_confidence = 0.0

            for label in response.get('ModerationLabels', []):
                flagged_categories.append(label['Name'])
                max_confidence = max(max_confidence, label['Confidence'])

            is_flagged = len(flagged_categories) > 0

            check = ModerationCheck(
                block_image_id=block_image_id,
                check_type='aws_rekognition',
                result={'labels': response.get('ModerationLabels', [])},
                flagged=is_flagged,
                confidence=max_confidence / 100.0 if is_flagged else None,
                flagged_categories=flagged_categories if flagged_categories else None
            )
            self.db.add(check)
            self.db.commit()

            return {
                'flagged': is_flagged,
                'categories': flagged_categories,
                'confidence': max_confidence
            }
        except Exception as e:
            print(f"Rekognition moderation error: {e}")
            return {'flagged': False, 'categories': [], 'error': str(e)}

    async def moderate_url(self, url: str, block_image_id: str) -> dict:
        """Check URL against Google Safe Browsing"""
        try:
            # Simplified URL check - in production use Google Safe Browsing API
            # https://developers.google.com/safe-browsing/v4

            # Check against banned domains first
            is_banned = self.check_banned_domain(url)

            # Check for suspicious patterns
            suspicious_keywords = ['casino', 'porn', 'xxx', 'adult', 'bitcoin', 'crypto', 'free-money']
            url_lower = url.lower()

            flagged_keywords = [kw for kw in suspicious_keywords if kw in url_lower]
            is_flagged = is_banned or len(flagged_keywords) > 0

            check = ModerationCheck(
                block_image_id=block_image_id,
                check_type='url_scan',
                result={
                    'url': url,
                    'banned_domain': is_banned,
                    'suspicious_keywords': flagged_keywords
                },
                flagged=is_flagged,
                confidence=1.0 if is_banned else 0.7,
                flagged_categories=['banned_domain'] if is_banned else flagged_keywords
            )
            self.db.add(check)
            self.db.commit()

            return {
                'flagged': is_flagged,
                'categories': ['banned_domain'] if is_banned else flagged_keywords
            }
        except Exception as e:
            print(f"URL moderation error: {e}")
            return {'flagged': False, 'categories': [], 'error': str(e)}

    async def moderate_text_ocr(self, image_bytes: bytes, block_image_id: str) -> dict:
        """Extract and moderate text from image using Rekognition OCR"""
        try:
            response = self.rekognition_client.detect_text(
                Image={'Bytes': image_bytes}
            )

            extracted_text = ' '.join([
                detection['DetectedText']
                for detection in response.get('TextDetections', [])
                if detection['Type'] == 'LINE'
            ])

            # Check for banned keywords
            banned_keywords = self.db.query(BannedContent).filter(
                BannedContent.ban_type == 'keyword'
            ).all()

            flagged_keywords = []
            text_lower = extracted_text.lower()

            for banned in banned_keywords:
                if banned.value.lower() in text_lower:
                    flagged_keywords.append(banned.value)

            # Additional hardcoded checks
            explicit_keywords = ['porn', 'xxx', 'sex', 'adult', 'casino', 'bitcoin', 'crypto']
            for keyword in explicit_keywords:
                if keyword in text_lower and keyword not in flagged_keywords:
                    flagged_keywords.append(keyword)

            is_flagged = len(flagged_keywords) > 0

            check = ModerationCheck(
                block_image_id=block_image_id,
                check_type='ocr_text',
                result={
                    'extracted_text': extracted_text,
                    'flagged_keywords': flagged_keywords
                },
                flagged=is_flagged,
                confidence=0.9 if is_flagged else None,
                flagged_categories=flagged_keywords if flagged_keywords else None
            )
            self.db.add(check)
            self.db.commit()

            return {
                'flagged': is_flagged,
                'categories': flagged_keywords,
                'text': extracted_text
            }
        except Exception as e:
            print(f"OCR moderation error: {e}")
            return {'flagged': False, 'categories': [], 'error': str(e)}

    async def run_full_moderation(self, image_bytes: bytes, s3_key: str, link_url: str, block_image_id: str) -> dict:
        """Run all moderation checks"""
        image_hash = self.calculate_image_hash(image_bytes)

        # Check banned hash first
        if self.check_banned_hash(image_hash):
            return {
                'auto_approve': False,
                'flagged': True,
                'reason': 'Image hash is banned',
                'checks': []
            }

        # Run all checks
        checks = []

        # OpenAI
        openai_result = await self.moderate_image_openai(
            f"https://{settings.s3_bucket_name}.s3.amazonaws.com/{s3_key}",
            block_image_id
        )
        checks.append(('openai', openai_result))

        # AWS Rekognition
        rekognition_result = await self.moderate_image_rekognition(s3_key, block_image_id)
        checks.append(('rekognition', rekognition_result))

        # OCR text
        ocr_result = await self.moderate_text_ocr(image_bytes, block_image_id)
        checks.append(('ocr', ocr_result))

        # URL scan
        url_result = await self.moderate_url(link_url, block_image_id)
        checks.append(('url', url_result))

        # Determine if auto-approve is safe
        any_flagged = any(check[1].get('flagged', False) for check in checks)

        return {
            'auto_approve': not any_flagged,
            'flagged': any_flagged,
            'checks': checks,
            'image_hash': image_hash
        }
