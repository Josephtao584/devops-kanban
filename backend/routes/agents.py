from fastapi import APIRouter, HTTPException
from repositories.agents import agent_repo
from utils.response import ApiResponse

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=ApiResponse)
async def get_agents():
    """Get all agents"""
    agents = agent_repo.get_all()
    return ApiResponse.ok(data=agents)


@router.get("/{agent_id}", response_model=ApiResponse)
async def get_agent(agent_id: int):
    """Get an agent by ID"""
    agent = agent_repo.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return ApiResponse.ok(data=agent)


@router.post("", response_model=ApiResponse)
async def create_agent(agent_in: dict):
    """Create a new agent"""
    agent = agent_repo.create(agent_in)
    return ApiResponse.ok(
        data=agent, message="Agent created"
    )


@router.put("/{agent_id}", response_model=ApiResponse)
async def update_agent(
    agent_id: int,
    agent_in: dict,
):
    """Update an agent"""
    agent = agent_repo.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    updated = agent_repo.update(agent_id, agent_in)
    return ApiResponse.ok(
        data=updated, message="Agent updated"
    )


@router.delete("/{agent_id}", response_model=ApiResponse)
async def delete_agent(agent_id: int):
    """Delete an agent"""
    agent = agent_repo.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent_repo.delete(agent_id)
    return ApiResponse.ok(message="Agent deleted")
