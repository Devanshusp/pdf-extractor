import json
import statistics
from collections import Counter
from typing import List, Literal, Optional

from pydantic import BaseModel
from wordfreq import zipf_frequency


class Coordinates(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    bottom_left: Coordinates
    top_right: Coordinates

    @property
    def px_left(self) -> float:
        return self.bottom_left.x

    @property
    def px_bottom(self) -> float:
        return self.bottom_left.y

    @property
    def width(self) -> float:
        return self.top_right.x - self.bottom_left.x

    @property
    def height(self) -> float:
        return self.top_right.y - self.bottom_left.y

    def from_pymupdf_bbox_list(bbox_list: list[int]) -> "BoundingBox":
        return BoundingBox(
            bottom_left=Coordinates(x=bbox_list[0], y=bbox_list[1]),
            top_right=Coordinates(x=bbox_list[2], y=bbox_list[3]),
        )


class TextExtractionSettings(BaseModel):
    filter_non_english_words: bool
    min_word_length: int
    min_word_frequency: float
    remove_non_alpha: bool


class SpanData(BaseModel):
    bounding_box: BoundingBox
    text: str

    def clean_text(self, settings: TextExtractionSettings) -> str:
        cleaned = []
        for word in self.text.split():
            if settings.remove_non_alpha and not word.isalpha():
                continue
            if len(word) < settings.min_word_length:
                continue
            if (
                settings.filter_non_english_words
                and zipf_frequency(word, lang="en") < settings.min_word_frequency
            ):
                continue
            cleaned.append(word)
        return " ".join(cleaned)

    @staticmethod
    def from_pymupdf_span_json(span_json: json) -> "SpanData":
        return SpanData(
            bounding_box=BoundingBox.from_pymupdf_bbox_list(span_json["bbox"]),
            text=span_json["text"],
        )


class LineData(BaseModel):
    bounding_box: BoundingBox
    spans: List[SpanData]

    @property
    def height_variation(self) -> float:
        heights = [span.bounding_box.height for span in self.spans]
        if not heights or len(heights) == 1:
            return 0.0
        mean = statistics.mean(heights)
        std = statistics.stdev(heights)
        if mean == 0:
            return 0.0
        return float(std / mean)

    @property
    def most_common_span_height(self) -> float:
        heights = [span.bounding_box.height for span in self.spans]
        if not heights:
            return 0.0
        counter = Counter(heights)
        most_common = counter.most_common(1)[0][0]
        return most_common

    @property
    def span_count(self) -> int:
        return len(self.spans)

    # def clean_spans(self, settings: TextExtractionSettings) -> List[SpanData]:
    #     """
    #     Returns spans whose height is within 5% of the most common span height
    #     if height_variation is above 0.1. Otherwise, returns all spans.
    #     Optionally filters out spans with non-English/gibberish text.
    #     """
    #     # heights = [span.bounding_box.height for span in self.spans]
    #     # if not heights:
    #     #     return []
    #     # most_common = Counter(heights).most_common(1)[0][0]
    #     # tolerance = 0.05 * most_common  # 5% tolerance
    #     # filtered_spans = self.spans
    #     # if self.height_variation > 0.1:
    #     #     filtered_spans = [
    #     #         span
    #     #         for span in self.spans
    #     #         if abs(span.bounding_box.height - most_common) <= tolerance
    #     #     ]
    #     filtered_spans = [
    #         span for span in self.spans if span.clean_text(settings).strip() != ""
    #     ]
    #     return filtered_spans

    def from_pymupdf_line_json(line_json: json) -> "LineData":
        return LineData(
            bounding_box=BoundingBox.from_pymupdf_bbox_list(line_json["bbox"]),
            spans=[SpanData.from_pymupdf_span_json(s) for s in line_json["spans"]],
        )


class BlockData(BaseModel):
    bounding_box: BoundingBox
    index: int
    lines: List[LineData]

    def from_pymupdf_block_json(block_json: json) -> "BlockData":
        return BlockData(
            bounding_box=BoundingBox.from_pymupdf_bbox_list(block_json["bbox"]),
            index=block_json["number"],
            lines=[LineData.from_pymupdf_line_json(l) for l in block_json["lines"]],
        )


class PageData(BaseModel):
    height: float
    width: float
    page_number: int
    blocks: List[BlockData]

    def from_pymupdf_textpage_json(textpage_json: json, page_number: int) -> "PageData":
        return PageData(
            height=textpage_json["height"],
            width=textpage_json["width"],
            page_number=page_number,
            blocks=[
                BlockData.from_pymupdf_block_json(b) for b in textpage_json["blocks"]
            ],
        )


class TextChunk(BaseModel):
    page_number: int
    text: str
    px_left: float
    px_bottom: float
    width: float
    height: float

    @staticmethod
    def from_span_data(
        span_data: SpanData,
        page_number: int,
        settings: Optional[TextExtractionSettings] = None,
    ) -> "TextChunk":
        text = span_data.clean_text(settings) if settings else span_data.text
        return TextChunk(
            page_number=page_number,
            text=text,
            px_left=span_data.bounding_box.px_left,
            px_bottom=span_data.bounding_box.px_bottom,
            width=span_data.bounding_box.width,
            height=span_data.bounding_box.height,
        )

    @staticmethod
    def from_line_data(
        line_data: LineData,
        page_number: int,
        settings: Optional[TextExtractionSettings] = None,
    ) -> "TextChunk":
        # spans = line_data.clean_spans(settings) if settings else line_data.spans
        text = " ".join(
            [
                span.clean_text(settings) if settings else span.text
                for span in line_data.spans
            ]
        )
        return TextChunk(
            page_number=page_number,
            text=text,
            px_left=line_data.bounding_box.px_left,
            px_bottom=line_data.bounding_box.px_bottom,
            width=line_data.bounding_box.width,
            height=line_data.bounding_box.height,
        )

    @staticmethod
    def from_block_data(
        block_data: BlockData,
        page_number: int,
        settings: Optional[TextExtractionSettings] = None,
    ) -> "TextChunk":
        block_text = []
        for line in block_data.lines:
            line_text = []
            # spans = line.clean_spans(settings) if settings else line.spans
            for span in line.spans:
                span_text = span.clean_text(settings) if settings else span.text
                if span_text:
                    line_text.append(span_text)
            block_text.append(" ".join(line_text))
        text = " ".join(block_text)
        return TextChunk(
            page_number=page_number,
            text=text,
            px_left=block_data.bounding_box.px_left,
            px_bottom=block_data.bounding_box.px_bottom,
            width=block_data.bounding_box.width,
            height=block_data.bounding_box.height,
        )


# API IO
class ExtractRequest(BaseModel):
    pdf_url: str
    by: Literal["spans", "lines", "blocks"]
    filter_non_english_words: bool
    min_word_length: int
    min_word_frequency: float
    remove_non_alpha: bool


class ExtractorOutput(BaseModel):
    text_chunks: List[TextChunk]
    run_time_seconds: float
