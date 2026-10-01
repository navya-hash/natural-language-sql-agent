

from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy import text


class DatabaseManager:

    def __init__(self):
        self.engine = None


    def connect(self, database_url):

       self.engine = create_engine(database_url)

    # Verify the connection immediately
       with self.engine.connect() as conn:
         conn.execute(text("SELECT 1"))
 
    def is_connected(self):

        return self.engine is not None

    def get_schema(self):

        if self.engine is None:
            raise Exception("Database not connected.")

        inspector = inspect(self.engine)

        schema = ""

        for table in inspector.get_table_names():

            schema += f"\nTable : {table}\n"

            for column in inspector.get_columns(table):

                schema += f"{column['name']} ({column['type']})\n"

        return schema


    def run_sql(self, query):

        if self.engine is None:
            raise Exception("Database not connected.")

        with self.engine.connect() as conn:

            result = conn.execute(text(query))

            return [
                dict(row._mapping)
                for row in result
            ]

    def connect_sqlite(self, filepath):

       url = f"sqlite:///{filepath}"

       self.connect(url)

    def connect_mysql(self, host, port, username, password, database):

        url = (
            f"mysql+pymysql://{username}:{password}"
            f"@{host}:{port}/{database}"
        )

        self.connect(url)

    def connect_postgres(self, host, port, username, password, database):

        url = (
            f"postgresql+psycopg2://{username}:{password}"
            f"@{host}:{port}/{database}"
        )

        self.connect(url)

    
    def get_tables(self):

        if self.engine is None:
            raise Exception("Database not connected.")

        inspector = inspect(self.engine)

        return inspector.get_table_names()


    def get_table_preview(self, table_name, limit=10):

        if self.engine is None:
            raise Exception("Database not connected.")

        # Prevent invalid table names from being injected
        tables = self.get_tables()

        if table_name not in tables:
            raise Exception(f"Table '{table_name}' does not exist.")

        with self.engine.connect() as conn:

            result = conn.execute(
                text(f'SELECT * FROM "{table_name}" LIMIT {limit}')
            )

            return [
                dict(row._mapping)
                for row in result
            ]

    def get_schema_dict(self):

        if self.engine is None:
            raise Exception("Database not connected.")

        inspector = inspect(self.engine)

        schema = {}

        for table in inspector.get_table_names():

            schema[table] = []

            for column in inspector.get_columns(table):

                schema[table].append({
                    "name": column["name"],
                    "type": str(column["type"])
                })

        return schema


db = DatabaseManager()