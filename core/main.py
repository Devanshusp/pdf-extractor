import json
import time

from fastapi import FastAPI, HTTPException

from core.config import ExtractorConfig
from core.core import Extractor
from core.output import ExtractorOutput, ExtractRequest

app = FastAPI()


extractor = Extractor.from_config(ExtractorConfig())


@app.post("/extract")
def extract_pdf(request: ExtractRequest):
    start_time = time.time()
    try:
        print(f"Extracting PDF Data from URL: {request.pdf_url}")
        try:
            pdf_page_data = extractor.extract_pdf(request.pdf_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF fetch failed: {str(e)}")
        print(f"Extracting Text Chunks from PDF by: {request.by}")
        text_chunks = extractor.page_data_to_text_chunks(
            pdf_page_data,
            by=request.by,
            filter_non_english_words=request.filter_non_english_words,
            min_word_length=request.min_word_length,
            min_word_frequency=request.min_word_frequency,
            remove_non_alpha=request.remove_non_alpha,
        )
        run_time_seconds = round(time.time() - start_time, 4)
        result = ExtractorOutput(
            text_chunks=text_chunks, run_time_seconds=run_time_seconds
        )
        return json.loads(result.model_dump_json())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
