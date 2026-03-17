from pydantic import BaseModel
from typing import Optional, Any


class ApiResponse(BaseModel):
    """Unified API response format"""

    success: bool = True
    message: str = "Success"
    data: Optional[Any] = None
    error: Optional[str] = None

    @classmethod
    def ok(cls, data: Any = None, message: str = "Success"):
        """Create a success response"""
        return cls(success=True, message=message, data=data)

    @classmethod
    def fail(cls, message: str, error: str = None):
        """Create an error response"""
        return cls(success=False, message=message, error=error)
