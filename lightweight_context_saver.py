#!/usr/bin/env python3
"""
Lightweight Context Saver for OpenCode
A gentle context management plugin that preserves more context than aggressive pruners.
"""

import json
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import re


@dataclass
class ContextChunk:
    """Represents a chunk of conversation context"""

    id: str
    content: str
    role: str  # 'user' or 'assistant'
    timestamp: str
    importance_score: float = 0.5
    token_estimate: int = 0
    topic: Optional[str] = None


class LightweightContextManager:
    """
    Gentle context manager that:
    - Preserves recent conversation (last 10-15 messages)
    - Compresses older content into topic summaries
    - Never cuts mid-thought or mid-task
    - Saves key technical details permanently
    """

    def __init__(
        self,
        recent_window: int = 12,
        compression_threshold: int = 20,
        min_context_tokens: int = 4000,
    ):
        self.recent_window = recent_window  # Keep last N messages intact
        self.compression_threshold = compression_threshold  # Compress older than this
        self.min_context_tokens = min_context_tokens  # Never go below this
        self.saved_chunks: List[ContextChunk] = []
        self.topic_summaries: Dict[str, str] = {}
        self.preserved_insights: List[str] = []  # Key technical facts that must survive

    def add_message(
        self, role: str, content: str, topic: Optional[str] = None
    ) -> ContextChunk:
        """Add a new message to context"""
        chunk_id = hashlib.md5(
            f"{role}:{content[:50]}:{datetime.now()}".encode()
        ).hexdigest()[:8]

        chunk = ContextChunk(
            id=chunk_id,
            content=content,
            role=role,
            timestamp=datetime.now().isoformat(),
            token_estimate=self._estimate_tokens(content),
            topic=topic or self._detect_topic(content),
        )

        self.saved_chunks.append(chunk)

        # Extract and preserve key insights
        self._extract_insights(content)

        return chunk

    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (1 token ≈ 4 chars)"""
        return len(text) // 4

    def _detect_topic(self, content: str) -> Optional[str]:
        """Detect the topic from content"""
        # Simple topic detection based on keywords
        if "function" in content.lower() or "def " in content or "class " in content:
            return "code"
        elif (
            "error" in content.lower()
            or "bug" in content.lower()
            or "fix" in content.lower()
        ):
            return "debugging"
        elif "test" in content.lower():
            return "testing"
        elif any(cmd in content.lower() for cmd in ["git", "npm", "pip", "install"]):
            return "cli"
        elif (
            "file" in content.lower()
            or "folder" in content.lower()
            or "directory" in content.lower()
        ):
            return "files"
        return "general"

    def _extract_insights(self, content: str) -> None:
        """Extract key technical insights that should be preserved"""
        # Look for file paths, function names, key decisions
        file_patterns = re.findall(
            r"[\w\-/\\]+\.(py|js|ts|jsx|tsx|json|md|txt|yml|yaml)", content
        )
        for fp in file_patterns:
            if fp not in self.preserved_insights:
                self.preserved_insights.append(f"File: {fp}")

        # Look for code references like `function_name` or class names
        code_refs = re.findall(r"`([^`]+)`", content)
        for ref in code_refs[:3]:  # Limit to first 3
            if len(ref) > 3 and ref not in self.preserved_insights:
                self.preserved_insights.append(f"Ref: {ref}")

    def get_context(self, max_tokens: int = 8000) -> str:
        """
        Get context with lightweight management:
        1. Always keep recent window intact
        2. Summarize older content by topic
        3. Always include preserved insights
        """
        if not self.saved_chunks:
            return ""

        context_parts = []
        total_tokens = 0

        # Always add preserved insights at the top
        if self.preserved_insights:
            insights_text = "[Key Context]\n" + "\n".join(
                f"• {i}" for i in self.preserved_insights[-10:]
            )
            context_parts.append(insights_text)
            total_tokens += self._estimate_tokens(insights_text)

        # Get recent messages (always keep these)
        recent = self.saved_chunks[-self.recent_window :]
        recent_text = self._format_chunks(recent)
        recent_tokens = self._estimate_tokens(recent_text)

        # If we have room, add older content as summaries
        remaining_tokens = max_tokens - recent_tokens - total_tokens

        if len(self.saved_chunks) > self.recent_window and remaining_tokens > 1000:
            older = self.saved_chunks[: -self.recent_window]
            summary = self._summarize_older(older, remaining_tokens)
            if summary:
                context_parts.append(f"\n[Earlier Conversation Summary]\n{summary}")

        # Add recent messages
        context_parts.append(f"\n[Recent Messages]\n{recent_text}")

        return "\n".join(context_parts)

    def _format_chunks(self, chunks: List[ContextChunk]) -> str:
        """Format chunks as readable text"""
        lines = []
        for chunk in chunks:
            role_label = "User" if chunk.role == "user" else "Assistant"
            lines.append(f"{role_label}: {chunk.content}")
        return "\n\n".join(lines)

    def _summarize_older(self, chunks: List[ContextChunk], max_tokens: int) -> str:
        """Create a lightweight summary of older content"""
        # Group by topic
        by_topic: Dict[str, List[str]] = {}
        for chunk in chunks:
            topic = chunk.topic or "general"
            if topic not in by_topic:
                by_topic[topic] = []
            # Take first 100 chars as summary
            summary = chunk.content[:100].replace("\n", " ")
            if len(chunk.content) > 100:
                summary += "..."
            by_topic[topic].append(summary)

        # Create summary text
        summary_parts = []
        for topic, items in by_topic.items():
            if items:
                summary_parts.append(
                    f"• {topic}: {len(items)} messages about {items[-1][:80]}..."
                )

        summary_text = "\n".join(summary_parts)

        # Truncate if needed
        if self._estimate_tokens(summary_text) > max_tokens:
            while (
                summary_parts
                and self._estimate_tokens("\n".join(summary_parts)) > max_tokens
            ):
                summary_parts.pop()
            summary_text = "\n".join(summary_parts) if summary_parts else ""

        return summary_text

    def should_compress(self, current_tokens: int, threshold: int = 12000) -> bool:
        """Check if we should consider compression (very lenient)"""
        return current_tokens > threshold

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about current context"""
        total_messages = len(self.saved_chunks)
        recent_messages = min(total_messages, self.recent_window)
        older_messages = max(0, total_messages - self.recent_window)
        total_tokens = sum(c.token_estimate for c in self.saved_chunks)

        return {
            "total_messages": total_messages,
            "recent_intact": recent_messages,
            "summarized": older_messages,
            "total_tokens": total_tokens,
            "preserved_insights": len(self.preserved_insights),
            "topics": list(set(c.topic for c in self.saved_chunks if c.topic)),
        }

    def export_state(self) -> str:
        """Export current state as JSON"""
        return json.dumps(
            {
                "chunks": [asdict(c) for c in self.saved_chunks],
                "insights": self.preserved_insights,
                "stats": self.get_stats(),
            },
            indent=2,
        )

    def import_state(self, state_json: str):
        """Import state from JSON"""
        data = json.loads(state_json)
        self.saved_chunks = [ContextChunk(**c) for c in data.get("chunks", [])]
        self.preserved_insights = data.get("insights", [])


# Example usage and integration helpers
def create_gentle_manager() -> LightweightContextManager:
    """Factory function with sensible defaults for gentle context management"""
    return LightweightContextManager(
        recent_window=12,  # Keep last 12 messages intact
        compression_threshold=25,  # Start thinking about compression at 25 messages
        min_context_tokens=5000,  # Never go below this
    )


if __name__ == "__main__":
    # Demo
    manager = create_gentle_manager()

    # Simulate some messages
    manager.add_message("user", "I need help with a Python function in myapp/utils.py")
    manager.add_message(
        "assistant", "I'd be happy to help! What's the issue with the function?"
    )
    manager.add_message(
        "user", "The function `calculate_total` is giving wrong results"
    )
    manager.add_message("assistant", "Let me look at the code...")

    print("Stats:", json.dumps(manager.get_stats(), indent=2))
    print("\n--- Context ---\n")
    print(manager.get_context())
