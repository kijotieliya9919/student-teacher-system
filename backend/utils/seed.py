from backend.database import AsyncSessionLocal
from backend.models import User, UserRole
from backend.utils import get_password_hash
import os
import logging

logger = logging.getLogger(__name__)

async def seed_default_admin():
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, func
            result = await session.execute(select(func.count()).select_from(User).where(User.role == UserRole.ADMIN))
            admin_count = result.scalar()
            
            if admin_count == 0:
                admin_email = os.getenv('ADMIN_EMAIL', 'admin@system.com')
                admin_password = os.getenv('ADMIN_PASSWORD', 'Admin123!')
                
                admin = User(
                    email=admin_email,
                    full_name="System Administrator",
                    hashed_password=get_password_hash(admin_password),
                    role=UserRole.ADMIN,
                    is_active=True,
                    must_change_password=True
                )
                session.add(admin)
                await session.commit()
                logger.info(f"Default admin created: {admin_email}")
            else:
                logger.info("Admin account already exists")
    except Exception as e:
        logger.error(f"Error seeding admin: {e}")
