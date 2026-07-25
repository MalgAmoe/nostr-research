#!/usr/bin/env python3
"""Sequential, repository-backed Codex worker/reviewer task runner."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / "workflow"
TASKS = WORKFLOW / "tasks"
RUNS = WORKFLOW / "runs"
PROMPTS = WORKFLOW / "prompts"
CONTEXT = ROOT / "CONTEXT.md"
VALID_STATUSES = {"ready", "in_progress", "done", "blocked"}
VERDICTS = {"PASS", "CHANGES_REQUIRED", "BLOCKED"}


def parse_task(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", text, re.S)
    if not match:
        raise ValueError(f"{path} has no valid front matter")
    metadata: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        if not separator:
            raise ValueError(f"Invalid task metadata line in {path}: {line}")
        metadata[key.strip()] = value.strip()
    required = {"id", "status", "max_attempts", "validation", "depends_on"}
    missing = required - metadata.keys()
    if missing:
        raise ValueError(f"{path} is missing metadata: {', '.join(sorted(missing))}")
    if metadata["status"] not in VALID_STATUSES:
        raise ValueError(f"{path} has unsupported status {metadata['status']}")
    return metadata, match.group(2)


def write_status(path: Path, status: str) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Unsupported status {status}")
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"(?m)^status:\s*\S+\s*$",
        f"status: {status}",
        text,
        count=1,
    )
    if count != 1:
        raise ValueError(f"Could not update status in {path}")
    path.write_text(updated, encoding="utf-8")


def completed_task_ids() -> set[str]:
    completed = set()
    for path in sorted(TASKS.glob("*.md")):
        metadata, _ = parse_task(path)
        if metadata["status"] == "done":
            completed.add(metadata["id"])
    return completed


def select_task() -> tuple[Path, dict[str, str]] | None:
    completed = completed_task_ids()
    for path in sorted(TASKS.glob("*.md")):
        metadata, _ = parse_task(path)
        if metadata["status"] not in {"ready", "in_progress"}:
            continue
        dependencies = {item.strip() for item in metadata["depends_on"].split(",") if item.strip()}
        if dependencies <= completed:
            return path, metadata
    return None


def attempt_count(task_id: str) -> int:
    task_root = RUNS / task_id
    if not task_root.exists():
        return 0
    return len([path for path in task_root.glob("attempt-*") if path.is_dir()])


def resumable_review(task_id: str) -> Path | None:
    """Return the latest attempt whose worker finished but review did not."""
    count = attempt_count(task_id)
    if not count:
        return None
    attempt_dir = RUNS / task_id / f"attempt-{count:02d}"
    required = (attempt_dir / "worker-output.md", attempt_dir / "validation.txt")
    if all(path.exists() for path in required) and not (attempt_dir / "review.md").exists():
        return attempt_dir
    return None


def latest_review(task_id: str) -> Path | None:
    reviews = sorted((RUNS / task_id).glob("attempt-*/review.md"))
    return reviews[-1] if reviews else None


def run_process(command: list[str], *, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        input=stdin,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )


def worktree_is_clean() -> bool:
    status = run_process(["git", "status", "--porcelain"])
    if status.returncode != 0:
        raise RuntimeError(f"Could not inspect Git worktree:\n{status.stdout}")
    return not status.stdout.strip()


def task_commit_message(task_path: Path, task_id: str) -> str:
    _, body = parse_task(task_path)
    title = next(
        (line.removeprefix("# ").strip() for line in body.splitlines() if line.startswith("# ")),
        task_id,
    )
    return f"workflow({task_id}): {title}"


def commit_completed_task(task_path: Path, task_id: str) -> tuple[bool, str]:
    staged = run_process(["git", "add", "-A"])
    if staged.returncode != 0:
        return False, f"Git staging failed:\n{staged.stdout}"

    commit = run_process(["git", "commit", "-m", task_commit_message(task_path, task_id)])
    if commit.returncode != 0:
        return False, f"Git commit failed:\n{commit.stdout}"
    return True, commit.stdout.strip()


def fingerprint_paths(value: str) -> str:
    digest = hashlib.sha256()
    for relative in value.split():
        path = ROOT / relative
        candidates = sorted(item for item in path.rglob("*") if item.is_file()) if path.is_dir() else [path]
        for candidate in candidates:
            digest.update(str(candidate.relative_to(ROOT)).encode())
            digest.update(b"\0")
            if candidate.exists():
                digest.update(candidate.read_bytes())
            digest.update(b"\0")
    return digest.hexdigest()


def codex_command(sandbox: str, output: Path) -> list[str]:
    return [
        "codex",
        "exec",
        "--ephemeral",
        "--color",
        "never",
        "--sandbox",
        sandbox,
        "--cd",
        str(ROOT),
        "--output-last-message",
        str(output),
        "-",
    ]


def build_worker_prompt(task_path: Path, review_path: Path | None) -> str:
    sections = [
        (PROMPTS / "worker.md").read_text(encoding="utf-8"),
    ]
    if CONTEXT.exists():
        sections.extend(["\n# Canonical project context\n", CONTEXT.read_text(encoding="utf-8")])
    sections.extend(["\n# Selected task\n", task_path.read_text(encoding="utf-8")])
    if review_path:
        sections.extend([
            "\n# Latest independent review\n",
            review_path.read_text(encoding="utf-8"),
        ])
    return "\n".join(sections)


def build_review_prompt(task_path: Path, attempt_dir: Path) -> str:
    sections = [
        (PROMPTS / "reviewer.md").read_text(encoding="utf-8"),
    ]
    if CONTEXT.exists():
        sections.extend(["\n# Canonical project context\n", CONTEXT.read_text(encoding="utf-8")])
    sections.extend([
        "\n# Selected task\n",
        task_path.read_text(encoding="utf-8"),
        "\n# Worker report\n",
        (attempt_dir / "worker-output.md").read_text(encoding="utf-8"),
        "\n# Validation output\n",
        (attempt_dir / "validation.txt").read_text(encoding="utf-8"),
        "\n# Review instruction\n",
        "Inspect the actual deliverables and relevant repository sources now. "
        "Do not rely only on the worker report.",
    ])
    return "\n".join(sections)


def verdict_from(review: str) -> str:
    first = next((line.strip() for line in review.splitlines() if line.strip()), "")
    if first not in VERDICTS:
        return "CHANGES_REQUIRED"
    return first


def write_run_state(task_id: str, status: str, attempt: int, detail: str) -> None:
    task_root = RUNS / task_id
    task_root.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    (task_root / "state.md").write_text(
        f"# {task_id}\n\n"
        f"Status: {status}\n\n"
        f"Latest attempt: {attempt}\n\n"
        f"Updated: {timestamp}\n\n"
        f"Detail: {detail}\n",
        encoding="utf-8",
    )


def execute_task(task_path: Path, metadata: dict[str, str]) -> str:
    task_id = metadata["id"]
    maximum = int(metadata["max_attempts"])
    current = attempt_count(task_id)
    pending_review = resumable_review(task_id)
    if current >= maximum and pending_review is None:
        write_status(task_path, "blocked")
        write_run_state(task_id, "blocked", current, "Maximum attempts already reached.")
        return "blocked"

    write_status(task_path, "in_progress")
    while current < maximum or pending_review is not None:
        if pending_review is not None:
            attempt_dir = pending_review
            pending_review = None
            validation_text = (attempt_dir / "validation.txt").read_text(encoding="utf-8")
            match = re.match(r"Exit code:\s*(\d+)", validation_text)
            validation_returncode = int(match.group(1)) if match else 1
        else:
            current += 1
            attempt_dir = RUNS / task_id / f"attempt-{current:02d}"
            attempt_dir.mkdir(parents=True, exist_ok=False)

            worker_prompt = build_worker_prompt(task_path, latest_review(task_id))
            (attempt_dir / "worker-prompt.md").write_text(worker_prompt, encoding="utf-8")
            worker_output = attempt_dir / "worker-output.md"
            protected_before = fingerprint_paths(metadata.get("protected_paths", ""))
            worker_process = run_process(codex_command("workspace-write", worker_output), stdin=worker_prompt)
            protected_after = fingerprint_paths(metadata.get("protected_paths", ""))
            (attempt_dir / "worker-process.log").write_text(worker_process.stdout, encoding="utf-8")
            if worker_process.returncode != 0 or not worker_output.exists():
                write_status(task_path, "blocked")
                write_run_state(task_id, "blocked", current, f"Worker infrastructure failed with exit code {worker_process.returncode}; see worker-process.log.")
                return "blocked"

            validation_path = ROOT / metadata["validation"]
            validation = run_process(["sh", str(validation_path)])
            validation_text = f"Exit code: {validation.returncode}\n\n{validation.stdout}"
            validation_returncode = validation.returncode
            if protected_before != protected_after:
                validation_returncode = 1
                validation_text += "\nProtected product paths changed during this worker attempt.\n"
            validation_text = re.sub(r"^Exit code: \d+", f"Exit code: {validation_returncode}", validation_text)
            (attempt_dir / "validation.txt").write_text(validation_text, encoding="utf-8")

        review_prompt = build_review_prompt(task_path, attempt_dir)
        (attempt_dir / "review-prompt.md").write_text(review_prompt, encoding="utf-8")
        review_output = attempt_dir / "review.md"
        reviewer = run_process(codex_command("read-only", review_output), stdin=review_prompt)
        (attempt_dir / "review-process.log").write_text(reviewer.stdout, encoding="utf-8")
        if reviewer.returncode != 0 or not review_output.exists():
            write_status(task_path, "blocked")
            write_run_state(task_id, "blocked", current, f"Reviewer infrastructure failed with exit code {reviewer.returncode}; see review-process.log.")
            return "blocked"

        verdict = verdict_from(review_output.read_text(encoding="utf-8"))
        if verdict == "PASS" and validation_returncode == 0:
            write_status(task_path, "done")
            write_run_state(
                task_id,
                "done",
                current,
                "Validation passed and reviewer returned PASS; task committed automatically.",
            )
            committed, detail = commit_completed_task(task_path, task_id)
            if not committed:
                write_status(task_path, "blocked")
                write_run_state(
                    task_id,
                    "blocked",
                    current,
                    f"Review passed, but automatic task commit failed. {detail}",
                )
                run_process(["git", "add", "-A"])
                return "blocked"
            print(detail)
            return "done"
        if verdict == "BLOCKED":
            write_status(task_path, "blocked")
            write_run_state(task_id, "blocked", current, "Reviewer returned BLOCKED.")
            return "blocked"

        detail = "Reviewer requested changes."
        if validation_returncode != 0:
            detail = "Validation failed; reviewer feedback recorded."
        write_run_state(task_id, "in_progress", current, detail)

    write_status(task_path, "blocked")
    write_run_state(task_id, "blocked", current, "Maximum attempts reached without PASS.")
    return "blocked"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-tasks", type=int, default=1, help="Maximum queued tasks to process.")
    parser.add_argument("--dry-run", action="store_true", help="Show the next selectable task.")
    args = parser.parse_args()
    if args.max_tasks < 1:
        parser.error("--max-tasks must be at least 1")

    processed = 0
    while processed < args.max_tasks:
        selected = select_task()
        if not selected:
            print("No ready task with satisfied dependencies.")
            break
        task_path, metadata = selected
        print(f"Selected {metadata['id']} ({metadata['status']})")
        if args.dry_run:
            break
        if metadata["status"] == "ready" and not worktree_is_clean():
            print(
                "Refusing to start a ready task with uncommitted changes. "
                "Commit the queue definition and any other intended baseline first."
            )
            return 2
        result = execute_task(task_path, metadata)
        print(f"{metadata['id']}: {result}")
        processed += 1
        if result == "blocked":
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
