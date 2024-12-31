try:
    import psycopg2
    import dotenv
    print("Imports successful")
except ImportError as e:
    print(f"Import error: {e}")