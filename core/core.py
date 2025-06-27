import json
import time
from functools import lru_cache, wraps
from typing import List, Literal

import pymupdf
import requests

from .config import ExtractorConfig
from .lm import LLM
from .output import PageData, TextChunk, TextExtractionSettings


def timed_lru_cache(seconds: int, maxsize: int = 128):
    """LRU cache with time-based expiration."""

    def wrapper(fn):
        fn = lru_cache(maxsize=maxsize)(fn)
        fn.lifetime = seconds
        fn.expiry = time.time() + fn.lifetime

        @wraps(fn)
        def wrapped(*args, **kwargs):
            if time.time() >= fn.expiry:
                fn.cache_clear()
                fn.expiry = time.time() + fn.lifetime
            return fn(*args, **kwargs)

        wrapped.cache_clear = fn.cache_clear
        return wrapped

    return wrapper


class Extractor:
    def __init__(
        self, llm: LLM, max_pdf_file_size_bytes: int, max_pdf_file_page_count: int
    ) -> "Extractor":
        self.llm = llm
        self.max_pdf_file_size_bytes = max_pdf_file_size_bytes
        self.max_pdf_file_page_count = max_pdf_file_page_count

    @classmethod
    def from_config(cls, config: ExtractorConfig) -> "Extractor":
        llm = LLM.from_config(config.llm)
        return cls(
            llm=llm,
            max_pdf_file_size_bytes=config.max_pdf_file_size_bytes,
            max_pdf_file_page_count=config.max_pdf_file_page_count,
        )

    @timed_lru_cache(seconds=600, maxsize=6)
    def extract_pdf(self, pdf_url: str) -> List[PageData]:
        """
        Extract text data from a PDF using built-in text and OCR capabilities.
        """
        pdf_document = self._validate_and_download_pdf(pdf_url)

        pdf_page_data: List[PageData] = []
        for page_number, page in enumerate(pdf_document, start=1):
            page: pymupdf.Page = page
            page_data_json = json.loads(page.get_textpage().extractJSON(sort=True))

            # run ocr on page if it has no text
            if page_data_json["blocks"] == []:
                ocr_textpage = page.get_textpage_ocr(full=False)
                page_data_json = json.loads(ocr_textpage.extractJSON(sort=True))

            page_data: PageData = PageData.from_pymupdf_textpage_json(
                page_data_json, page_number=page_number
            )
            pdf_page_data.append(page_data)

        return pdf_page_data

    def page_data_to_text_chunks(
        self,
        pdf_page_data: List[PageData],
        by: Literal["spans", "lines", "blocks"] = "spans",
        filter_non_english_words: bool = True,
        min_word_length: int = 2,
        min_word_frequency: float = 4.0,
        remove_non_alpha: bool = True,
    ) -> List[TextChunk]:
        """
        Converts extracted page data into text chunks optimized for highlighting based on settings.
        """
        settings = TextExtractionSettings(
            filter_non_english_words=filter_non_english_words,
            min_word_length=min_word_length,
            min_word_frequency=min_word_frequency,
            remove_non_alpha=remove_non_alpha,
        )
        text_chunks: List[TextChunk] = []
        for page in pdf_page_data:
            page_number = page.page_number

            if by == "spans":
                for block in page.blocks:
                    for line in block.lines:
                        for span in line.spans:
                            text_chunks.append(
                                TextChunk.from_span_data(
                                    span,
                                    page_number=page_number,
                                    settings=settings,
                                )
                            )
            elif by == "lines":
                for block in page.blocks:
                    for line in block.lines:
                        text_chunks.append(
                            TextChunk.from_line_data(
                                line,
                                page_number=page_number,
                                settings=settings,
                            )
                        )
            elif by == "blocks":
                for block in page.blocks:
                    text_chunks.append(
                        TextChunk.from_block_data(
                            block,
                            page_number=page_number,
                            settings=settings,
                        )
                    )

        return [
            text_chunk
            for text_chunk in text_chunks
            if len(set(text_chunk.text) - {" ", "\t", "\n", "\r"}) > 0
        ]

    def _validate_and_download_pdf(self, pdf_url: str) -> pymupdf.Document:
        """
        Download the PDF from the given URL, validate its format, size, and page count,
        and return a PyMuPDF Document object. Raises ValueError if any check fails.
        """
        # download the PDF with streaming to avoid loading large files into memory at once
        request = requests.get(pdf_url, stream=True)
        content_length = int(request.headers.get("content-length", 0))

        # check if the file size exceeds the allowed maximum
        if content_length > self.max_pdf_file_size_bytes:
            raise ValueError(
                f"PDF file too large. Maximum allowed size is {self.max_pdf_file_size_bytes} bytes."
            )

        # check if the response is a valid PDF
        if request.status_code != 200 or not request.headers.get(
            "content-type", ""
        ).lower().endswith("pdf"):
            raise ValueError("Invalid PDF URL or file format.")

        # stream the content and ensure it does not exceed the size limit
        content = b""
        for chunk in request.iter_content(1024 * 1024):
            content += chunk
            if len(content) > self.max_pdf_file_size_bytes:
                raise ValueError(
                    f"PDF file too large. Maximum allowed size is {self.max_pdf_file_size_bytes} bytes."
                )

        # try to open the PDF document
        try:
            pdf_document = pymupdf.Document(stream=content, filetype="pdf")
        except Exception as e:
            raise ValueError(
                "Failed to open PDF document. The file may be corrupted or not a valid PDF."
            ) from e

        # check if the PDF exceeds the maximum allowed page count
        if pdf_document.page_count > self.max_pdf_file_page_count:
            raise ValueError(
                f"PDF has too many pages. Maximum allowed is {self.max_pdf_file_page_count}."
            )

        return pdf_document
