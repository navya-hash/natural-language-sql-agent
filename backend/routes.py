from config import MAX_RETRIES


def validate_route(state):

    if state["is_valid"]:
        return "execute"

    if state["retries"] >= MAX_RETRIES:
        return "failed"

    return "retry"