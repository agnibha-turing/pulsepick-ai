#!/usr/bin/env python3
from app.core.config import settings
import sys
import os
from sqlalchemy import text, create_engine
from sqlalchemy.exc import SQLAlchemyError

# Add the current directory to the path so we can import from app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)


def clear_database(db_url=None):
    """
    Clear all data from the database by truncating all tables and resetting identity sequences.
    """
    # Use provided DB URL or get from settings
    db_url = db_url or settings.SQLALCHEMY_DATABASE_URI
    print(f"Connecting to database: {db_url}")

    # Create engine with the appropriate URL
    engine = create_engine(str(db_url))

    try:
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                print("Truncating tables and resetting sequences...")

                # Truncate the main tables with CASCADE to handle foreign key constraints
                # RESTART IDENTITY resets the auto-increment counters
                connection.execute(
                    text("TRUNCATE article, source RESTART IDENTITY CASCADE;"))

                print("Database cleared successfully!")
                return True
    except SQLAlchemyError as e:
        print(f"Error clearing database: {e}")
        return False


if __name__ == "__main__":
    # Check if we need to use a local connection instead of Docker
    db_url = settings.SQLALCHEMY_DATABASE_URI

    # If we're using Docker's "db" hostname and not running in Docker, switch to localhost
    if "db:" in str(db_url) and not os.path.exists("/.dockerenv"):
        # Create a modified connection string that uses localhost instead of the Docker container name
        db_url_str = str(db_url)
        local_db_url = db_url_str.replace("db:", "localhost:")
        print(
            f"Running outside Docker, using local connection: {local_db_url}")
        db_url = local_db_url

    confirmation = input(
        "Are you sure you want to clear ALL data from the database? (yes/no): ")
    if confirmation.lower() == "yes":
        if clear_database(db_url):
            print("Database cleared successfully!")
        else:
            print("Failed to clear the database.")
            sys.exit(1)
    else:
        print("Operation cancelled.")
