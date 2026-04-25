#!/usr/bin/env python3
import sys
import os
import json
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from video_analyzer import VideoAnalyzer
from thumbnail_generator import ThumbnailGenerator
from transcoder import Transcoder


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Missing payload file argument"
        }))
        sys.exit(1)

    payload_path = sys.argv[1]
    
    try:
        with open(payload_path, 'r', encoding='utf-8') as f:
            payload = json.load(f)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to load payload: {str(e)}"
        }))
        sys.exit(1)

    try:
        result = process_video(payload)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)


def process_video(payload: dict) -> dict:
    task_id = payload.get("task_id")
    input_path = payload.get("input_path")
    output_path = payload.get("output_path")
    template = payload.get("template", {})
    resource = payload.get("resource", {})

    if not input_path or not os.path.exists(input_path):
        raise ValueError(f"Input file not found: {input_path}")

    result = {
        "success": False,
        "task_id": task_id,
        "input_path": input_path,
        "output_path": output_path
    }

    analyzer = VideoAnalyzer()
    
    try:
        video_info = analyzer.analyze(input_path)
        result.update({
            "duration": video_info.get("duration"),
            "width": video_info.get("width"),
            "height": video_info.get("height"),
            "codec": video_info.get("codec"),
            "bitrate": video_info.get("bitrate"),
            "fps": video_info.get("fps"),
            "video_info": video_info
        })
    except Exception as e:
        result["analysis_error"] = str(e)

    output_settings = template.get("output", {})
    thumbnail_dir = os.path.dirname(output_path) if output_path else None
    
    transcoder = Transcoder()

    def progress_callback(progress: float, message: str):
        pass

    try:
        transcode_result = transcoder.transcode(
            input_path=input_path,
            output_path=output_path,
            template=template,
            callback=progress_callback
        )
        
        result["output_size"] = transcode_result.get("output_size")
        
        if output_settings.get("generate_thumbnail") and thumbnail_dir:
            try:
                thumbnail_gen = ThumbnailGenerator()
                thumbnail_name = os.path.splitext(os.path.basename(output_path))[0] + "_thumb.jpg"
                thumbnail_path = os.path.join(thumbnail_dir, thumbnail_name)
                
                thumb_result = thumbnail_gen.generate(output_path, thumbnail_path)
                result["thumbnail"] = thumbnail_name
                result["thumbnail_info"] = thumb_result
            except Exception as e:
                result["thumbnail_error"] = str(e)

        result["success"] = True
        
    except Exception as e:
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()
        raise

    return result


if __name__ == "__main__":
    main()
