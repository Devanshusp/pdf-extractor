import json
import re
import time
from pathlib import Path
from typing import List, Literal

import mdformat
import nltk
import pymupdf
import requests
from markdowncleaner import CleanerOptions, MarkdownCleaner
from pymupdf4llm import to_markdown

from .config import ExtractorConfig
from .lm import LLM
from .output import PageData, TextChunk


class Extractor:
    def __init__(self, llm: LLM) -> "Extractor":
        self.llm = llm

    @classmethod
    def from_config(cls, config: ExtractorConfig) -> "Extractor":
        llm = LLM.from_config(config.llm)
        return cls(llm=llm)

    def extract_pdf(self, pdf_url: str) -> List[PageData]:
        print(f"Extracting PDF from URL: {pdf_url}")
        request = requests.get(pdf_url)

        # TODO: check if request is valid format, length, space
        # raise an error if it is not

        pdf_page_data: List[PageData] = []

        pdf_document = pymupdf.Document(stream=request.content, filetype="pdf")
        for page_number, page in enumerate(pdf_document, start=1):
            print(f"Extracting data for page number {page_number}")
            page: pymupdf.Page = page
            page_data_json = json.loads(page.get_textpage().extractJSON(sort=True))
            page_data: PageData = PageData.from_pymupdf_textpage_json(
                page_data_json, page_number=page_number
            )
            pdf_page_data.append(page_data)

        return pdf_page_data

    def page_data_to_text_chunks(
        self,
        pdf_page_data: List[PageData],
        by: Literal["spans", "lines", "blocks"] = "spans",
    ) -> List[TextChunk]:
        text_chunks: List[TextChunk] = []
        for page in pdf_page_data:
            page_number = page.page_number
            print(f"Processing data for page number {page_number}")

            if by == "spans":
                for block in page.blocks:
                    for line in block.lines:
                        for span in line.spans:
                            text_chunks.append(
                                TextChunk.from_span_data(span, page_number=page_number)
                            )
            elif by == "lines":
                for block in page.blocks:
                    for line in block.lines:
                        text_chunks.append(
                            TextChunk.from_line_data(line, page_number=page_number)
                        )
            elif by == "blocks":
                for block in page.blocks:
                    text_chunks.append(
                        TextChunk.from_block_data(block, page_number=page_number)
                    )

        return text_chunks

    def test_extract_pdf(self, pdf_url: str) -> List[PageData]:
        print(f"Extracting PDF from URL: {pdf_url}")

        date = time.strftime("%Y-%m-%d")
        timestamp = time.strftime("%H-%M-%S")
        output_dir = f".local.out/{date}/{timestamp}"
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # get pdf
        s_time = time.time()
        r = requests.get(pdf_url)
        req_ms = (time.time() - s_time) * 1000

        # TODO: check if r is valid format, length, space
        # raise an error if it is not

        # doc pdf
        s_time = time.time()
        doc = pymupdf.Document(stream=r.content, filetype="pdf")
        doc_ms = (time.time() - s_time) * 1000

        block_json_list = []
        string_list = ""

        for num, page in enumerate(doc):
            print(f"PAGE {num}")
            page: pymupdf.Page = page
            textpage = page.get_textpage()
            blocks = textpage.extractJSON(sort=True)
            blocks = json.loads(blocks)
            block_json_list.append(blocks)

        # save as file
        with open(f"{output_dir}/blocks.json", "w", encoding="utf-8") as f:
            json.dump(block_json_list, f, indent=2, ensure_ascii=False)

        for page_block in block_json_list:
            for block in page_block["blocks"]:
                string_list += "\n==========\n"
                for line in block["lines"]:
                    string_list += "\n"
                    for span in line["spans"]:
                        string_list += span["text"] + " "

        with open(f"{output_dir}/text.txt", "w", encoding="utf-8") as f:
            f.write(string_list)

        return

        # md pdf
        s_time = time.time()
        md_text = to_markdown(
            doc=doc,
            write_images=False,
            embed_images=False,
            # image_path=f"{output_dir}/imgs",
            show_progress=True,
            # filename="img",
        )
        mdx_ms = (time.time() - s_time) * 1000

        # output txt
        out = open(f"{output_dir}/output.txt", "wb")
        for page in doc:
            text = page.get_text().encode("utf8")
            out.write(text)
            out.write(bytes((12,)))
        out.close()

        # output md
        out = open(f"{output_dir}/output.md", "wb")
        out.write(md_text.encode("utf-8"))
        out.close()

        if clean := False:
            # cleaner
            s_time = time.time()
            MarkdownCleaner(
                options=CleanerOptions(
                    remove_short_lines=False,
                    min_line_length=3000,
                    remove_whole_lines=False,
                    remove_sections=False,
                    remove_duplicate_headlines=False,
                    remove_duplicate_headlines_threshold=2,
                    remove_footnotes_in_text=False,
                    replace_within_lines=False,
                    remove_within_lines=False,
                    contract_empty_lines=False,
                    crimp_linebreaks=False,
                )
            ).clean_markdown_file(
                input_file=Path(f"{output_dir}/output.md"),
                output_file=Path(f"{output_dir}/clean.md"),
            )
            cln_ms = (time.time() - s_time) * 1000

            # cleaner 2
            s_time = time.time()
            mdformat.file(
                Path(f"{output_dir}/output.md"),
                options={
                    "wrap": 2000,
                },
            )
            cln2_ms = (time.time() - s_time) * 1000

            # custom cleaning
            # nltk.download("punkt_tab")
            s_time = time.time()
            with open(f"{output_dir}/output.md", "r", encoding="utf-8") as f:
                content = f.read()
            sentences = nltk.sent_tokenize(content)
            cleaned_content = "\n".join(sentences)
            with open(f"{output_dir}/custom.md", "w", encoding="utf-8") as f:
                f.write(cleaned_content)
            cus_ms = (time.time() - s_time) * 1000

        print(f"Request took: {req_ms:.2f}ms")
        print(f"Document processing took: {doc_ms:.2f}ms")
        print(f"Markdown processing took: {mdx_ms:.2f}ms")
        # if clean:
        #     print(f"Cleaning processing took: {cln_ms:.2f}ms")
        #     print(f"Cleaning2 processing took: {cln2_ms:.2f}ms")
        #     print(f"Custom Cleaning took: {cus_ms:.2f}ms")

        return None
