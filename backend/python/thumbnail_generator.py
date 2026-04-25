import os
import subprocess
from typing import Dict, Any, Optional
from PIL import Image


class ThumbnailGenerator:
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    def generate(
        self,
        input_path: str,
        output_path: str,
        width: int = 320,
        height: int = 180,
        position: float = 0.1,
        quality: int = 85
    ) -> Dict[str, Any]:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        temp_output = output_path + ".tmp.jpg"
        
        try:
            seek_time = self._calculate_seek_time(input_path, position)
            
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-ss", str(seek_time),
                "-i", input_path,
                "-vframes", "1",
                "-q:v", str(quality),
                "-f", "image2",
                temp_output
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg thumbnail generation failed: {result.stderr}")

            if not os.path.exists(temp_output):
                raise RuntimeError("Thumbnail was not generated")

            self._resize_and_optimize(temp_output, output_path, width, height, quality)

            if os.path.exists(temp_output):
                os.remove(temp_output)

            file_size = os.path.getsize(output_path)
            
            with Image.open(output_path) as img:
                actual_width, actual_height = img.size

            return {
                "success": True,
                "path": output_path,
                "width": actual_width,
                "height": actual_height,
                "size": file_size,
                "seek_time": seek_time
            }

        except Exception as e:
            if os.path.exists(temp_output):
                os.remove(temp_output)
            raise e

    def _calculate_seek_time(self, input_path: str, position: float) -> float:
        try:
            from video_analyzer import VideoAnalyzer
            analyzer = VideoAnalyzer()
            info = analyzer.analyze(input_path)
            duration = info.get("duration", 0)
            
            if duration > 0:
                seek_time = duration * position
                if seek_time > 10:
                    return seek_time
        except Exception:
            pass
        
        return 5.0

    def _resize_and_optimize(
        self,
        input_path: str,
        output_path: str,
        target_width: int,
        target_height: int,
        quality: int
    ):
        with Image.open(input_path) as img:
            original_width, original_height = img.size
            
            aspect_ratio = original_width / original_height
            target_aspect = target_width / target_height
            
            if aspect_ratio > target_aspect:
                new_width = target_width
                new_height = int(target_width / aspect_ratio)
            else:
                new_height = target_height
                new_width = int(target_height * aspect_ratio)
            
            resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            final_img = Image.new("RGB", (target_width, target_height), (0, 0, 0))
            
            offset_x = (target_width - new_width) // 2
            offset_y = (target_height - new_height) // 2
            final_img.paste(resized, (offset_x, offset_y))
            
            final_img.save(
                output_path,
                "JPEG",
                quality=quality,
                optimize=True,
                progressive=True
            )

    def generate_thumbnails(
        self,
        input_path: str,
        output_dir: str,
        widths: list = None,
        position: float = 0.1
    ) -> Dict[str, Any]:
        if widths is None:
            widths = [320, 640, 1280]

        results = {}
        
        for width in widths:
            height = int(width * 9 / 16)
            filename = f"thumbnail_{width}x{height}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            try:
                result = self.generate(
                    input_path,
                    output_path,
                    width,
                    height,
                    position
                )
                results[str(width)] = result
            except Exception as e:
                results[str(width)] = {
                    "success": False,
                    "error": str(e)
                }

        return {
            "success": True,
            "thumbnails": results
        }
