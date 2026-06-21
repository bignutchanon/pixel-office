@echo off
REM Ask Claude Code one question, non-interactively, and print the answer.
REM Usage:  ask-claude "your question here"
REM (Codex can call this via its shell/exec tool to consult Claude.)
claude -p %*
