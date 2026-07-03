"""Needfire — offline survival knowledge computer.

A pure-Python-stdlib RAG application: retrieve answers from an offline knowledge
corpus and (optionally) synthesize them with a local LLM, always with citations.

No third-party packages are required to run. Optional accelerators (Ollama for
LLM + embeddings, faiss for vector search, libzim for ZIM extraction) are
detected at runtime and used when present, but the app is fully functional
without any of them.
"""

__version__ = "2.1.1"
__all__ = ["__version__"]
