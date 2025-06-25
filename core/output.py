import json
from typing import List

from pydantic import BaseModel


class Coordinates(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    bottom_left: Coordinates
    top_right: Coordinates

    def from_pymupdf_bbox_list(bbox_list: list[int]) -> "BoundingBox":
        return BoundingBox(
            bottom_left=Coordinates(x=bbox_list[0], y=bbox_list[1]),
            top_right=Coordinates(x=bbox_list[2], y=bbox_list[3]),
        )


class SpanData(BaseModel):
    bounding_box: BoundingBox
    text: str

    def from_pymupdf_span_json(span_json: json) -> "SpanData":
        return SpanData(
            bounding_box=BoundingBox.from_pymupdf_bbox_list(span_json["bbox"]),
            text=span_json["text"],
        )


class LineData(BaseModel):
    bounding_box: BoundingBox
    spans: List[SpanData]

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

    def from_span_data(span_data: SpanData, page_number: int) -> "TextChunk":
        bottom_left = span_data.bounding_box.bottom_left
        top_right = span_data.bounding_box.top_right

        px_left = bottom_left.x
        px_bottom = bottom_left.y
        width = top_right.x - bottom_left.x
        height = top_right.y - bottom_left.y

        return TextChunk(
            page_number=page_number,
            text=span_data.text,
            px_left=px_left,
            px_bottom=px_bottom,
            width=width,
            height=height,
        )

    def from_line_data(line_data: LineData, page_number: int) -> "TextChunk":
        bottom_left = line_data.bounding_box.bottom_left
        top_right = line_data.bounding_box.top_right

        px_left = bottom_left.x
        px_bottom = bottom_left.y
        width = top_right.x - bottom_left.x
        height = top_right.y - bottom_left.y

        text = " ".join([span.text for span in line_data.spans])

        return TextChunk(
            page_number=page_number,
            text=text,
            px_left=px_left,
            px_bottom=px_bottom,
            width=width,
            height=height,
        )

    def from_block_data(block_data: BlockData, page_number: int) -> "TextChunk":
        bottom_left = block_data.bounding_box.bottom_left
        top_right = block_data.bounding_box.top_right

        px_left = bottom_left.x
        px_bottom = bottom_left.y
        width = top_right.x - bottom_left.x
        height = top_right.y - bottom_left.y

        text = " ".join(
            [
                " ".join([span.text for span in line_data.spans])
                for line_data in block_data.lines
            ]
        )

        return TextChunk(
            page_number=page_number,
            text=text,
            px_left=px_left,
            px_bottom=px_bottom,
            width=width,
            height=height,
        )
