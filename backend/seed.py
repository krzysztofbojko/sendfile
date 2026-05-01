import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from database import engine, async_session_maker, Base
from models import User
from auth import get_pin_hash

async def seed():
    async with engine.begin() as conn:
        # Re-create tables
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # Create admin
        admin = User(
            username="admin",
            pin_hash=get_pin_hash("1234"),
            is_admin=True
        )
        session.add(admin)
        
        # Create user
        user = User(
            username="user",
            pin_hash=get_pin_hash("1234"),
            is_admin=False
        )
        session.add(user)
        
        await session.commit()

        print(f"Baza danych pomyślnie zainicjowana!")
        print(f"Utworzono admina: admin, PIN: 1234")
        print(f"Utworzono użytkownika: user, PIN: 1234")

if __name__ == "__main__":
    asyncio.run(seed())
