def generate_chart(result, analysis):

    # Analyzer decided no chart is needed
    if not analysis.get("generate_chart", False):
        return {}

    chart_type = analysis.get("chart_type", "bar")

    if len(result) == 0:
        return {}

    first_row = result[0]

    columns = list(first_row.keys())

    if len(columns) < 2:
        return {}

    x_column = columns[0]
    y_column = columns[1]

    x = []
    y = []

    for row in result:

        x.append(row[x_column])
        y.append(row[y_column])

    return {

        "type": chart_type,

        "title": f"{y_column} by {x_column}",

        "x_label": x_column,

        "y_label": y_column,

        "x": x,

        "y": y

    }