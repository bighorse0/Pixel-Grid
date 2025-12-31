import io
import uuid
from PIL import Image
import boto3
from ..config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        self.bucket_name = settings.s3_bucket_name

    def validate_and_process_image(self, image_bytes: bytes, max_width: int, max_height: int) -> bytes:
        """Validate image and resize if needed"""
        try:
            image = Image.open(io.BytesIO(image_bytes))

            # Convert to RGB if necessary
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = background

            # Resize to exact dimensions
            if image.size != (max_width, max_height):
                image = image.resize((max_width, max_height), Image.Resampling.LANCZOS)

            # Save as optimized JPEG
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
            return output.getvalue()

        except Exception as e:
            raise ValueError(f"Invalid image file: {str(e)}")

    def upload_image(self, image_bytes: bytes, block_id: str) -> tuple[str, str]:
        """
        Upload image to S3 and return (s3_key, public_url)
        """
        s3_key = f"blocks/{block_id}/{uuid.uuid4()}.jpg"

        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=s3_key,
            Body=image_bytes,
            ContentType='image/jpeg',
            CacheControl='public, max-age=31536000',
            ACL='public-read'
        )

        public_url = f"https://{self.bucket_name}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"

        return s3_key, public_url

    def delete_image(self, s3_key: str):
        """Delete image from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
        except Exception as e:
            print(f"Error deleting image: {e}")
