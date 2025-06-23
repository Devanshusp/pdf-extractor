import click

from ..config import ExtractorConfig
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


cli()
