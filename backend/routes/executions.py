from fastapi import APIRouter, HTTPException
from repositories.executions import execution_repo
from utils.response import ApiResponse

router = APIRouter(prefix="/executions", tags=["Executions"])


@router.get("", response_model=ApiResponse)
async def get_executions(task_id: int = None, agent_id: int = None):
    """Get all executions, optionally filtered by task or agent"""
    if task_id:
        executions = execution_repo.get_by_task(task_id)
    elif agent_id:
        executions = execution_repo.get_by_agent(agent_id)
    else:
        executions = execution_repo.get_all()
    return ApiResponse.ok(data=executions)


@router.get("/{execution_id}", response_model=ApiResponse)
async def get_execution(execution_id: int):
    """Get an execution by ID"""
    execution = execution_repo.get_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ApiResponse.ok(data=execution)


@router.post("", response_model=ApiResponse)
async def create_execution(execution_in: dict):
    """Create a new execution"""
    execution = execution_repo.create(execution_in)
    return ApiResponse.ok(
        data=execution, message="Execution started"
    )


@router.put("/{execution_id}", response_model=ApiResponse)
async def update_execution(
    execution_id: int,
    execution_in: dict,
):
    """Update an execution"""
    execution = execution_repo.get_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    updated = execution_repo.update(execution_id, execution_in)
    return ApiResponse.ok(
        data=updated, message="Execution updated"
    )


@router.post("/{execution_id}/stop", response_model=ApiResponse)
async def stop_execution(execution_id: int):
    """Stop an execution"""
    execution = execution_repo.get_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    updated = execution_repo.update(execution_id, {"status": "CANCELLED"})
    return ApiResponse.ok(
        data=updated, message="Execution stopped"
    )


@router.delete("/{execution_id}", response_model=ApiResponse)
async def delete_execution(execution_id: int):
    """Delete an execution"""
    execution = execution_repo.get_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    execution_repo.delete(execution_id)
    return ApiResponse.ok(message="Execution deleted")
