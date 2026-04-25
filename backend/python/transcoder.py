import os
import subprocess
import json
from typing import Dict, Any, List, Optional


class Transcoder:
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    def transcode(
        self,
        input_path: str,
        output_path: str,
        template: Dict[str, Any],
        callback=None
    ) -> Dict[str, Any]:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        video_settings = template.get("video", {})
        audio_settings = template.get("audio", {})
        output_settings = template.get("output", {})

        cmd = self._build_ffmpeg_command(
            input_path,
            output_path,
            video_settings,
            audio_settings,
            output_settings
        )

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )

            duration = self._get_duration(input_path)
            
            while True:
                line = process.stdout.readline()
                if line == '' and process.poll() is not None:
                    break
                if line and callback:
                    progress = self._parse_progress(line, duration)
                    if progress is not None:
                        callback(progress, line.strip())

            process.wait()

            if process.returncode != 0:
                raise RuntimeError(f"FFmpeg transcoding failed with code {process.returncode}")

            if not os.path.exists(output_path):
                raise RuntimeError("Output file was not generated")

            output_size = os.path.getsize(output_path)

            return {
                "success": True,
                "output_path": output_path,
                "output_size": output_size
            }

        except Exception as e:
            if os.path.exists(output_path):
                try:
                    os.remove(output_path)
                except Exception:
                    pass
            raise e

    def _build_ffmpeg_command(
        self,
        input_path: str,
        output_path: str,
        video_settings: Dict[str, Any],
        audio_settings: Dict[str, Any],
        output_settings: Dict[str, Any]
    ) -> List[str]:
        cmd = [self.ffmpeg_path, "-y", "-i", input_path]

        codec = video_settings.get("codec", "libx264")
        cmd.extend(["-c:v", codec])

        preset = video_settings.get("preset")
        if preset:
            cmd.extend(["-preset", preset])

        crf = video_settings.get("crf")
        bitrate = video_settings.get("bitrate")

        if codec == "libx264":
            if crf:
                cmd.extend(["-crf", str(crf)])
            if bitrate:
                cmd.extend(["-b:v", f"{bitrate}k"])
                cmd.extend(["-maxrate", f"{bitrate * 2}k"])
                cmd.extend(["-bufsize", f"{bitrate * 4}k"])
        else:
            if bitrate:
                cmd.extend(["-b:v", f"{bitrate}k"])

        width = video_settings.get("width")
        height = video_settings.get("height")
        
        if width and height:
            cmd.extend(["-vf", f"scale={width}:{height}"])
        elif width:
            cmd.extend(["-vf", f"scale={width}:-2"])
        elif height:
            cmd.extend(["-vf", f"scale=-2:{height}"])

        fps = video_settings.get("fps")
        if fps:
            cmd.extend(["-r", str(fps)])

        profile = video_settings.get("profile")
        if profile:
            cmd.extend(["-profile:v", profile])

        level = video_settings.get("level")
        if level:
            cmd.extend(["-level", level])

        pixel_format = video_settings.get("pixel_format")
        if pixel_format:
            cmd.extend(["-pix_fmt", pixel_format])

        audio_codec = audio_settings.get("codec", "aac")
        cmd.extend(["-c:a", audio_codec])

        audio_bitrate = audio_settings.get("bitrate")
        if audio_bitrate:
            cmd.extend(["-b:a", f"{audio_bitrate}k"])

        channels = audio_settings.get("channels")
        if channels:
            cmd.extend(["-ac", str(channels)])

        sample_rate = audio_settings.get("sample_rate")
        if sample_rate:
            cmd.extend(["-ar", str(sample_rate)])

        format = output_settings.get("format", "mp4")
        if format == "hls" or output_settings.get("generate_hls"):
            cmd.extend(["-f", "hls"])
            segment_time = output_settings.get("segment_time", 10)
            cmd.extend(["-hls_time", str(segment_time)])
            cmd.extend(["-hls_list_size", "0"])
            cmd.extend(["-hls_segment_filename", output_path.replace(".m3u8", "_%03d.ts")])
        else:
            cmd.extend(["-f", format])

        cmd.append(output_path)

        return cmd

    def _get_duration(self, input_path: str) -> float:
        try:
            from video_analyzer import VideoAnalyzer
            analyzer = VideoAnalyzer()
            info = analyzer.analyze(input_path)
            return info.get("duration", 0)
        except Exception:
            return 0

    def _parse_progress(self, line: str, duration: float) -> Optional[float]:
        if "time=" in line:
            time_str = line.split("time=")[1].split(" ")[0]
            try:
                hours, minutes, seconds = time_str.split(":")
                current_time = float(hours) * 3600 + float(minutes) * 60 + float(seconds)
                if duration > 0:
                    return min(100.0, (current_time / duration) * 100)
            except Exception:
                pass
        return None

    def transcode_with_thumbnail(
        self,
        input_path: str,
        output_path: str,
        template: Dict[str, Any],
        thumbnail_dir: str = None,
        callback=None
    ) -> Dict[str, Any]:
        result = self.transcode(input_path, output_path, template, callback)

        output_settings = template.get("output", {})
        if output_settings.get("generate_thumbnail") and thumbnail_dir:
            try:
                from thumbnail_generator import ThumbnailGenerator
                generator = ThumbnailGenerator()
                
                thumbnail_name = os.path.splitext(os.path.basename(output_path))[0] + "_thumb.jpg"
                thumbnail_path = os.path.join(thumbnail_dir, thumbnail_name)
                
                thumb_result = generator.generate(output_path, thumbnail_path)
                result["thumbnail"] = thumbnail_name
                result["thumbnail_info"] = thumb_result
            except Exception as e:
                result["thumbnail_error"] = str(e)

        return result
