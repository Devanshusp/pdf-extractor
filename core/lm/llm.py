from litellm import CustomStreamWrapper, completion
from litellm.files.main import ModelResponse

from ..config import LLMConfig


class LLM:
    def __init__(self, model_name: str, api_key: str):
        self.model_name = model_name
        self.api_key = api_key

    @classmethod
    def from_config(cls, config: LLMConfig) -> "LLM":
        return cls(
            model_name=config.model_name,
            api_key=config.api_key.get_secret_value(),
        )

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a response from the LLM."""

        response: ModelResponse | CustomStreamWrapper = completion(
            model=self.model_name,
            api_key=self.api_key,
            messages=[
                {"content": system_prompt, "role": "system"},
                {"content": user_prompt, "role": "user"},
            ],
        )

        return response.choices[0].message.content  # type: ignore
