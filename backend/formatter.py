
def format_result(result):

    if not result:
        return []

    if isinstance(result[0], dict):
        return result

    return [
        dict(row._mapping)
        for row in result
    ]