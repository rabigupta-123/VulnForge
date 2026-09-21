from app.core.database import SessionLocal
from app.models.user import User, Organization
from app.core.security import get_password_hash, verify_password

db = SessionLocal()
users = db.query(User).all()
print(f"Total users in DB: {len(users)}")
for u in users:
    is_valid = verify_password("password123", u.password_hash or "") if u.password_hash else False
    print(f"Email: {u.email} | Valid password123: {is_valid}")

# Seed/Reset admin@example.com
user = db.query(User).filter(User.email == "admin@example.com").first()
if not user:
    org = Organization(name="Default Org")
    db.add(org)
    db.commit()
    db.refresh(org)
    user = User(
        email="admin@example.com",
        password_hash=get_password_hash("password123"),
        role="owner",
        org_id=org.id
    )
    db.add(user)
    db.commit()
    print("Created user: admin@example.com / password123")
else:
    user.password_hash = get_password_hash("password123")
    db.commit()
    print("Reset password for admin@example.com to password123")

# Also seed admin@cyberguardian.ai
user2 = db.query(User).filter(User.email == "admin@cyberguardian.ai").first()
if not user2:
    user2 = User(
        email="admin@cyberguardian.ai",
        password_hash=get_password_hash("password123"),
        role="owner",
        org_id=user.org_id
    )
    db.add(user2)
    db.commit()
    print("Created user: admin@cyberguardian.ai / password123")
else:
    user2.password_hash = get_password_hash("password123")
    db.commit()
    print("Reset password for admin@cyberguardian.ai to password123")

db.close()
