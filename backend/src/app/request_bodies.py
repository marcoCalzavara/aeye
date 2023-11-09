"""
This module provides the request bodies for the API.
"""

from pydantic import BaseModel


class Text(BaseModel):
    text: str
    collection_name: str
