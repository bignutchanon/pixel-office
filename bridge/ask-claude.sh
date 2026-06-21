#!/usr/bin/env bash
# Ask Claude Code one question, non-interactively, and print the answer.
# Usage:  ./ask-claude.sh "your question here"
# (Codex can call this via its shell/exec tool to consult Claude.)
exec claude -p "$*"
