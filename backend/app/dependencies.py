from fastapi import HTTPException, Request, status

from app.models.model_loader import ModelBundle


def get_model_bundle(request: Request) -> ModelBundle:
    bundle = getattr(request.app.state, "model_bundle", None)
    if bundle is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model bundle is not loaded.",
        )
    return bundle
