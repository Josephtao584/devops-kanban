"""Session API router with WebSocket support."""

import asyncio
import json
import os
import subprocess
import tempfile
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.models.session import Session, SessionCreate, SessionStatus, SessionUpdate
from app.repositories.session import session_repo
from app.services.task_service import task_service

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# Store running subprocess processes
running_processes: Dict[int, subprocess.Popen] = {}

# Store WebSocket subscriptions for each session
# Format: { session_id: { "output": [WebSocket, ...], "status": [WebSocket, ...] } }
session_subscriptions: Dict[int, Dict[str, list[WebSocket]]] = {}


class SessionInput(BaseModel):
    """Input for session."""

    input: str


class SessionContinue(BaseModel):
    """Continue session with input."""

    input: str


def success_response(data=None, message: str = "Success") -> dict:
    """Create a success response."""
    return {"success": True, "message": message, "data": data}


def error_response(message: str) -> dict:
    """Create an error response."""
    return {"success": False, "message": message, "data": None}


def get_worktree_path(task_id: int, task_title: str) -> str:
    """Generate a unique worktree path for a task."""
    # Clean task title for use as directory name
    safe_title = "".join(c if c.isalnum() else "_" for c in task_title)[:50]
    base_path = tempfile.gettempdir() / "claude-worktrees"
    worktree_name = f"task_{task_id}_{safe_title}"
    return str(base_path / worktree_name)


def create_worktree(task_id: int, task_title: str) -> str:
    """Create a git worktree for the task."""
    worktree_path = get_worktree_path(task_id, task_title)

    try:
        # Get the main repository path
        repo_path = os.getcwd()

        # Create a unique branch name
        branch_name = f"task/{task_id}"

        # Check if worktree already exists
        if os.path.exists(worktree_path):
            return worktree_path

        # Create the worktree directory parent if needed
        os.makedirs(os.path.dirname(worktree_path), exist_ok=True)

        # Create worktree with new branch using git command
        subprocess.run(
            ["git", "worktree", "add", "-b", branch_name, worktree_path],
            cwd=repo_path,
            check=True,
            capture_output=True,
        )

        return worktree_path
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create worktree: {e.stderr.decode() if e.stderr else str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create worktree: {str(e)}")


def cleanup_worktree(worktree_path: str) -> bool:
    """Remove a git worktree."""
    try:
        if os.path.exists(worktree_path):
            repo_path = os.getcwd()
            subprocess.run(
                ["git", "worktree", "remove", worktree_path, "--force"],
                cwd=repo_path,
                check=True,
                capture_output=True,
            )
        return True
    except Exception:
        return False


async def broadcast_to_session(session_id: int, channel: str, data: dict):
    """Broadcast message to all subscribers of a session channel."""
    if session_id not in session_subscriptions:
        return

    if channel not in session_subscriptions[session_id]:
        return

    disconnected = []
    for ws in session_subscriptions[session_id][channel]:
        try:
            await ws.send_json(data)
        except Exception:
            disconnected.append(ws)

    # Clean up disconnected clients
    for ws in disconnected:
        session_subscriptions[session_id][channel].remove(ws)


async def send_status_update(session_id: int, status: str):
    """Send status update to WebSocket subscribers."""
    await broadcast_to_session(session_id, "status", {"type": "status", "status": status})


async def send_output(session_id: int, content: str, stream: str = "stdout"):
    """Send output to WebSocket subscribers."""
    await broadcast_to_session(
        session_id,
        "output",
        {
            "type": "chunk",
            "content": content,
            "stream": stream,
            "timestamp": datetime.now().isoformat(),
        },
    )


# REST API endpoints

@router.get("")
async def get_sessions(taskId: Optional[int] = None, activeOnly: Optional[bool] = False) -> dict:
    """Get all sessions, optionally filtered by task ID."""
    if taskId:
        sessions = session_repo.get_by_task(taskId)
        if activeOnly:
            sessions = [s for s in sessions if s.status in [SessionStatus.RUNNING, SessionStatus.IDLE]]
    else:
        sessions = session_repo.find_all()

    return success_response([s.model_dump() for s in sessions])


@router.get("/task/{task_id}/active")
async def get_active_session(task_id: int) -> dict:
    """Get the active session for a task."""
    session = session_repo.get_active_by_task(task_id)
    if session:
        return success_response(session.model_dump())
    return success_response(None)


@router.get("/{session_id}")
async def get_session(session_id: int) -> dict:
    """Get a session by ID."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return success_response(session.model_dump())


@router.post("")
async def create_session(session: SessionCreate) -> dict:
    """Create a new session for a task."""
    # Verify task exists
    task = task_service.get_by_id(session.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create worktree for the session
    worktree_path = create_worktree(session.task_id, task.title)

    # Create the session
    session_data = SessionCreate(
        task_id=session.task_id,
        agent_id=session.agent_id,
        branch=f"task/{session.task_id}",
        worktree_path=worktree_path,
        initial_prompt=session.initial_prompt or task.description,
    )

    new_session = session_repo.create(session_data)
    return success_response(new_session.model_dump(), "Session created")


@router.post("/{session_id}/start")
async def start_session(session_id: int) -> dict:
    """Start a session - run Claude Code in the worktree."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status in [SessionStatus.RUNNING, SessionStatus.IDLE]:
        return success_response(session.model_dump(), "Session already running")

    # Get task for prompt
    task = task_service.get_by_id(session.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update session status to RUNNING
    session = session_repo.update(session_id, SessionUpdate(status=SessionStatus.RUNNING))

    # Start Claude Code in the worktree (non-blocking)
    if session.worktree_path and os.path.exists(session.worktree_path):
        # Build the Claude Code command
        prompt = session.initial_prompt or task.description
        cmd = ["npx", "-y", "@anthropic-ai/claude-code", "--prompt", prompt, "--verbose"]

        # Start the process
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=session.worktree_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            running_processes[session_id] = proc

            # Start async output reading
            asyncio.create_task(read_process_output(session_id, proc))

        except Exception as e:
            # Update status to ERROR
            session_repo.update(session_id, SessionUpdate(status=SessionStatus.ERROR))
            raise HTTPException(status_code=500, detail=f"Failed to start Claude Code: {str(e)}")

    return success_response(session.model_dump(), "Session started")


async def read_process_output(session_id: int, proc: subprocess.Popen):
    """Read output from the Claude Code process."""
    output = []
    try:
        # Read stdout line by line
        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip()
            if line:
                output.append(line)
                await send_output(session_id, line, "stdout")

        # Wait for process to complete
        proc.wait()
        exit_code = proc.returncode

        # Update session status
        status = SessionStatus.COMPLETED if exit_code == 0 else SessionStatus.ERROR

        # Save output to session
        session_repo.update(
            session_id,
            SessionUpdate(
                status=status,
                output="\n".join(output),
            ),
        )

        # Send final status
        await send_status_update(session_id, status.value)

        # Clean up process
        if session_id in running_processes:
            del running_processes[session_id]

    except Exception as e:
        await send_output(session_id, f"Error: {str(e)}", "stderr")
        session_repo.update(session_id, SessionUpdate(status=SessionStatus.ERROR))


@router.post("/{session_id}/stop")
async def stop_session(session_id: int) -> dict:
    """Stop a running session."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status not in [SessionStatus.RUNNING, SessionStatus.IDLE]:
        return success_response(session.model_dump(), "Session not running")

    # Kill the process if running
    if session_id in running_processes:
        proc = running_processes[session_id]
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        del running_processes[session_id]

    # Update session status
    session = session_repo.update(session_id, SessionUpdate(status=SessionStatus.STOPPED))

    # Send status update via WebSocket
    await send_status_update(session_id, SessionStatus.STOPPED.value)

    return success_response(session.model_dump(), "Session stopped")


@router.post("/{session_id}/continue")
async def continue_session(session_id: int, data: SessionContinue) -> dict:
    """Continue a stopped session with new input (--resume mode)."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != SessionStatus.STOPPED:
        raise HTTPException(status_code=400, detail="Session is not stopped")

    # Update session status to RUNNING
    session = session_repo.update(session_id, SessionUpdate(status=SessionStatus.RUNNING))

    # Resume Claude Code with --resume flag
    if session.worktree_path and os.path.exists(session.worktree_path):
        cmd = [
            "npx",
            "-y",
            "@anthropic-ai/claude-code",
            "--resume",
            "--prompt",
            data.input,
        ]

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=session.worktree_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            running_processes[session_id] = proc
            asyncio.create_task(read_process_output(session_id, proc))
        except Exception as e:
            session_repo.update(session_id, SessionUpdate(status=SessionStatus.ERROR))
            raise HTTPException(status_code=500, detail=f"Failed to resume Claude Code: {str(e)}")

    return success_response(session.model_dump(), "Session continued")


@router.post("/{session_id}/input")
async def send_input(session_id: int, data: SessionInput) -> dict:
    """Send input to a running session."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status not in [SessionStatus.RUNNING, SessionStatus.IDLE]:
        raise HTTPException(status_code=400, detail="Session is not running")

    # Send input to the process
    if session_id in running_processes:
        proc = running_processes[session_id]
        try:
            proc.stdin.write(data.input + "\n")
            proc.stdin.flush()
            # Echo input to output
            await broadcast_to_session(session_id, "output", {
                "type": "chunk",
                "content": data.input,
                "stream": "stdin",
                "timestamp": datetime.now().isoformat(),
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send input: {str(e)}")

    return success_response(None, "Input sent")


@router.get("/{session_id}/output")
async def get_session_output(session_id: int) -> dict:
    """Get the output of a session."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return success_response(session.output or "")


@router.delete("/{session_id}")
async def delete_session(session_id: int) -> dict:
    """Delete a session."""
    session = session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Stop if running
    if session.status in [SessionStatus.RUNNING, SessionStatus.IDLE]:
        await stop_session(session_id)

    # Cleanup worktree
    if session.worktree_path:
        cleanup_worktree(session.worktree_path)

    # Delete the session
    session_repo.delete(session_id)

    return success_response(None, "Session deleted")


# WebSocket endpoint for STOMP-like communication
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time session communication.
    Supports STOMP-like destination paths:
    - SUBSCRIBE /topic/session/{sessionId}/output
    - SUBSCRIBE /topic/session/{sessionId}/status
    - SEND /app/session/{sessionId}/input
    """
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)

                # Handle STOMP-like frames
                frame_type = msg.get("type", "")
                destination = msg.get("destination", "")
                session_id = msg.get("session_id")

                # Parse destination for STOMP-style paths
                if destination:
                    # /topic/session/{id}/output or /topic/session/{id}/status
                    if destination.startswith("/topic/session/"):
                        parts = destination.split("/")
                        if len(parts) >= 5:
                            try:
                                sid = int(parts[3])
                                channel = parts[4]  # 'output' or 'status'

                                if sid not in session_subscriptions:
                                    session_subscriptions[sid] = {"output": [], "status": []}

                                if channel in session_subscriptions[sid]:
                                    session_subscriptions[sid][channel].append(websocket)

                                # Send subscribed confirmation
                                await websocket.send_json({
                                    "type": "SUBSCRIBED",
                                    "destination": destination
                                })
                            except (ValueError, IndexError):
                                pass

                    # /app/session/{id}/input
                    elif destination.startswith("/app/session/"):
                        parts = destination.split("/")
                        if len(parts) >= 4:
                            try:
                                sid = int(parts[2])
                                body = msg.get("body", "{}")
                                if isinstance(body, str):
                                    body = json.loads(body)
                                input_text = body.get("input", "")

                                # Send input to session
                                if sid in running_processes:
                                    proc = running_processes[sid]
                                    proc.stdin.write(input_text + "\n")
                                    proc.stdin.flush()
                                    # Echo input
                                    await broadcast_to_session(sid, "output", {
                                        "type": "chunk",
                                        "content": input_text,
                                        "stream": "stdin",
                                        "timestamp": datetime.now().isoformat(),
                                    })
                            except (ValueError, IndexError, Exception):
                                pass

                # Also support simple message format for non-STOMP clients
                if frame_type == "subscribe" and session_id:
                    channel = msg.get("channel", "output")
                    if session_id not in session_subscriptions:
                        session_subscriptions[session_id] = {"output": [], "status": []}
                    if channel in session_subscriptions[session_id]:
                        session_subscriptions[session_id][channel].append(websocket)
                    await websocket.send_json({
                        "type": "subscribed",
                        "session_id": session_id,
                        "channel": channel
                    })

                elif frame_type == "input" and session_id:
                    input_text = msg.get("input", "")
                    if session_id in running_processes:
                        proc = running_processes[session_id]
                        proc.stdin.write(input_text + "\n")
                        proc.stdin.flush()

            except json.JSONDecodeError:
                # Non-JSON message, ignore
                pass

    except WebSocketDisconnect:
        pass
    finally:
        # Clean up subscriptions for this websocket
        for sid in list(session_subscriptions.keys()):
            for channel in ["output", "status"]:
                if channel in session_subscriptions[sid]:
                    session_subscriptions[sid][channel] = [
                        ws for ws in session_subscriptions[sid][channel]
                        if ws != websocket
                    ]
            # Clean up empty session entries
            if not session_subscriptions[sid]["output"] and not session_subscriptions[sid]["status"]:
                del session_subscriptions[sid]
