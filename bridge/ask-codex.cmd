@echo off
REM Ask Codex one question, non-interactively, and print the answer.
REM Usage:  ask-codex "your question here"
REM (Claude can call this via Bash to consult Codex.)
codex exec %*
