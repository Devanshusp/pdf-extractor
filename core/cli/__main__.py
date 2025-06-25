import json

import click

from ..config import ExtractorConfig
from ..core import Extractor
from ..lm import LLM


@click.group()
@click.pass_context
def cli(ctx):
    """A simple CLI for interacting with LLMs."""
    ctx.ensure_object(dict)
    ctx.obj["config"] = ExtractorConfig()


@cli.command()
@click.pass_context
def test(ctx):
    """Test configs."""
    click.echo("Loading configs...")
    config: ExtractorConfig = ctx.obj["config"]
    click.echo(f"Loaded configs!\n{config.model_dump_json(indent=2)}")


@cli.command()
@click.option(
    "--query",
    "-q",
    type=str,
    help="The query to send to the LLM.",
)
@click.pass_context
def ask(ctx, query: str):
    """Ask LLM"""
    config: ExtractorConfig = ctx.obj["config"]
    llm = LLM.from_config(config.llm)
    response = llm.generate(system_prompt="", user_prompt=query)
    click.echo(response)


@cli.command()
@click.option(
    "--pdf-url",
    "-u",
    type=str,
    help="PDF url to extract data from.",
)
@click.pass_context
def extract(ctx, pdf_url: str):
    """Extract PDF data"""
    config: ExtractorConfig = ctx.obj["config"]
    extractor = Extractor.from_config(config)
    pdf_page_data = extractor.extract_pdf(pdf_url=pdf_url)
    text_chunks = extractor.page_data_to_text_chunks(pdf_page_data, by="blocks")

    final_output = []
    for i, text_chunk in enumerate(text_chunks):
        final_output.append(
            {
                "id": i,
                "title": f"Highlight {i+1}",
                "text": text_chunk.text,
                "highlights": [
                    {
                        "pageNumber": text_chunk.page_number,
                        "left": text_chunk.px_left,
                        "top": text_chunk.px_bottom,  # not sure why this is the case exactly...
                        "width": text_chunk.width,
                        "height": text_chunk.height,
                    }
                ],
            }
        )

    with open(f".local.output.json", "w", encoding="utf-8") as f:
        json_list = final_output
        # json_list = [json.loads(data.model_dump_json()) for data in final_output]
        json.dump(json_list, f, indent=2, ensure_ascii=False)


cli()
