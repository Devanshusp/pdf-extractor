from pathlib import Path
from typing import ClassVar

from pydantic import BaseModel, SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    YamlConfigSettingsSource,
)

from .constants import BASE_CONFIG_PATH, LOCAL_CONFIG_PATH


class LLMConfig(BaseModel):
    model_name: str
    api_key: SecretStr


class ExtractorConfig(BaseSettings, case_sensitive=False):
    llm: LLMConfig

    max_pdf_file_size_bytes: int
    max_pdf_file_page_count: int

    custom_config_path: ClassVar[Path | None] = None

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        sources = [
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        ]

        if cls.custom_config_path is not None:
            sources.append(
                YamlConfigSettingsSource(settings_cls, yaml_file=cls.custom_config_path)
            )

        if LOCAL_CONFIG_PATH.exists():
            sources.append(
                YamlConfigSettingsSource(settings_cls, yaml_file=LOCAL_CONFIG_PATH)
            )

        sources.append(
            YamlConfigSettingsSource(settings_cls, yaml_file=BASE_CONFIG_PATH)
        )
        return tuple(sources)
