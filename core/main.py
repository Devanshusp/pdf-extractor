import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from core.config import ExtractorConfig
from core.core import Extractor
from core.output import ExtractorOutput, ExtractRequest

app = FastAPI()


extractor = Extractor.from_config(ExtractorConfig())


@app.post("/extract")
def extract_pdf(request: ExtractRequest):
    try:
        print(f"Extracting PDF Data from URL: {request.pdf_url}")
        pdf_page_data = extractor.extract_pdf(request.pdf_url)
        print(f"Extracting Text Chunks from PDF by: {request.by}")
        text_chunks = extractor.page_data_to_text_chunks(pdf_page_data, by=request.by)
        result = ExtractorOutput(text_chunks=text_chunks)
        return json.loads(result.model_dump_json())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
