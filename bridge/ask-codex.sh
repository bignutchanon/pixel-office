#!/usr/bin/env bash
# Ask Codex one question, non-interactively, and print the answer.
# Usage:  ./ask-codex.sh "your question here"
# (Claude can call this via Bash to consult Codex.)
exec codex exec "$*"
