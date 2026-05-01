import logging
import traceback
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request, UploadFile, File as FastAPIFile

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta
import os
import shutil
import aiofiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel

from database import engine, Base, get_db
from models import User, Directory, File, AuditLog
from auth import verify_pin, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user, get_current_admin, get_pin_hash

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="SendFile API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class UserCreate(BaseModel):
    username: str
    pin: str
    is_admin: bool = False

class UserPinUpdate(BaseModel):
    pin: str

class DirectoryCreate(BaseModel):
    name: str
    owner_id: int

@app.on_event("startup")
async def startup():
    # W celach deweloperskich, tworzymy tabele przy starcie.
    # Na produkcji należy użyć Alembic.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # form_data.username bedzie zawierał login, a form_data.password kod PIN
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_pin(form_data.password, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Niepoprawny login lub kod PIN",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Audit log for login
    audit_log = AuditLog(
        user_id=user.id,
        action="LOGIN",
        resource="System"
    )
    db.add(audit_log)
    await db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "is_admin": current_user.is_admin}

# --- ADMIN ENDPOINTS ---

@app.post("/api/admin/users")
async def create_user(user: UserCreate, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Użytkownik o takim loginie już istnieje")
    
    new_user = User(username=user.username, pin_hash=get_pin_hash(user.pin), is_admin=user.is_admin)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return {"id": new_user.id, "username": new_user.username, "is_admin": new_user.is_admin}

@app.get("/api/admin/users")
async def list_users(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "is_admin": u.is_admin} for u in users]

@app.get("/api/admin/users/{user_id}/directories")
async def get_user_directories(user_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Directory).where(Directory.owner_id == user_id))
    dirs = result.scalars().all()
    return [{"id": d.id, "name": d.name} for d in dirs]

@app.post("/api/admin/directories")
async def create_directory(dir_data: DirectoryCreate, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    base_media_path = "/protected_media" if os.path.exists("/protected_media") else "./protected_media"
    user_dir_path = os.path.join(base_media_path, f"user_{dir_data.owner_id}")
    os.makedirs(user_dir_path, exist_ok=True)
    
    new_dir = Directory(name=dir_data.name, path_on_disk=user_dir_path, owner_id=dir_data.owner_id)
    db.add(new_dir)
    await db.commit()
    await db.refresh(new_dir)
    return {"id": new_dir.id, "name": new_dir.name}

@app.post("/api/admin/directories/{dir_id}/files")
async def upload_file(dir_id: int, file: UploadFile = FastAPIFile(...), admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    logger.info(f"Otrzymano żądanie wgrania pliku '{file.filename}' do katalogu ID={dir_id} od administratora '{admin.username}'")
    try:
        # Zabezpieczenie przed Path Traversal
        safe_filename = os.path.basename(file.filename)
        if not safe_filename:
            raise HTTPException(status_code=400, detail="Nieprawidłowa nazwa pliku")

        result = await db.execute(select(Directory).where(Directory.id == dir_id))
        directory = result.scalars().first()
        if not directory:
            logger.warning(f"Katalog ID={dir_id} nie istnieje w bazie")
            raise HTTPException(status_code=404, detail="Katalog nie istnieje")
            
        file_path = os.path.join(directory.path_on_disk, safe_filename)
        logger.info(f"Zapisywanie pliku na dysku (strumieniowanie asynchroniczne): {file_path}")
        
        async with aiofiles.open(file_path, "wb") as buffer:
            while content := await file.read(1024 * 1024):  # Czytamy fragmenty po 1 MB
                await buffer.write(content)
            
        size_bytes = os.path.getsize(file_path)
        logger.info(f"Plik zapisany pomyślnie. Rozmiar: {size_bytes} bajtów")
        
        new_file = File(name=safe_filename, size_bytes=size_bytes, directory_id=dir_id)
        db.add(new_file)
        await db.commit()
        await db.refresh(new_file)
        
        logger.info(f"Metadane pliku zapisane w bazie: File ID={new_file.id}")
        return {"id": new_file.id, "name": new_file.name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Krytyczny błąd podczas wgrywania pliku: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Wystąpił wewnętrzny błąd serwera: {str(e)}")

@app.get("/api/admin/directories/{dir_id}/files")
async def admin_get_files(dir_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Directory).where(Directory.id == dir_id))
    directory = result.scalars().first()
    if not directory:
        raise HTTPException(status_code=404, detail="Katalog nie istnieje")
        
    result = await db.execute(select(File).where(File.directory_id == dir_id))
    files = result.scalars().all()
    return [{"id": f.id, "name": f.name, "size_bytes": f.size_bytes, "created_at": f.created_at} for f in files]

@app.put("/api/admin/users/{user_id}/pin")
async def update_user_pin(user_id: int, pin_data: UserPinUpdate, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    user.pin_hash = get_pin_hash(pin_data.pin)
    await db.commit()
    return {"status": "ok"}

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Nie możesz usunąć samego siebie")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")

    # Kaskadowe usunięcie fizyczne katalogów i plików
    dirs_result = await db.execute(select(Directory).where(Directory.owner_id == user_id))
    for directory in dirs_result.scalars().all():
        if os.path.exists(directory.path_on_disk):
            shutil.rmtree(directory.path_on_disk, ignore_errors=True)
            
    # SQLAlchemy nie usunie automatycznie w asyncpg/sqlite kaskadowo jeśli nie skonfigurujemy cascade="all, delete" w relacji i nie pobierzemy poprawnie danych.
    # Usuniemy to ręcznie, by zapewnić, że wszystkie powiązane rekordy w DB znikną (pliki, logi, katalogi).
    files_result = await db.execute(select(File).join(Directory).where(Directory.owner_id == user_id))
    for f in files_result.scalars().all():
        await db.delete(f)
        
    for d in dirs_result.scalars().all():
        await db.delete(d)
        
    # Uwaga: Celowo NIE usuwamy logów audytowych użytkownika (AuditLog), 
    # aby zachować historię zdarzeń w celach bezpieczeństwa.
        
    await db.delete(user)
    await db.commit()
    return {"status": "ok"}

@app.delete("/api/admin/directories/{dir_id}")
async def delete_directory(dir_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Directory).where(Directory.id == dir_id))
    directory = result.scalars().first()
    if not directory:
        raise HTTPException(status_code=404, detail="Katalog nie istnieje")
        
    if os.path.exists(directory.path_on_disk):
        shutil.rmtree(directory.path_on_disk, ignore_errors=True)
        
    files_result = await db.execute(select(File).where(File.directory_id == dir_id))
    for f in files_result.scalars().all():
        await db.delete(f)
        
    await db.delete(directory)
    await db.commit()
    return {"status": "ok"}

@app.delete("/api/admin/files/{file_id}")
async def delete_file(file_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(File).where(File.id == file_id))
    db_file = result.scalars().first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Plik nie istnieje")
        
    dir_result = await db.execute(select(Directory).where(Directory.id == db_file.directory_id))
    directory = dir_result.scalars().first()
    
    if directory:
        file_path = os.path.join(directory.path_on_disk, db_file.name)
        if os.path.exists(file_path):
            os.remove(file_path)
            
    await db.delete(db_file)
    await db.commit()
    return {"status": "ok"}

@app.get("/api/admin/audit_logs")
async def get_audit_logs(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AuditLog, User.username)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
    )
    logs = []
    for log, username in result.all():
        logs.append({
            "id": log.id,
            "username": username or f"Usunięty (ID: {log.user_id})",
            "action": log.action,
            "resource": log.resource,
            "timestamp": log.timestamp
        })
    return logs

# --- USER ENDPOINTS ---

@app.get("/api/directories")
async def get_directories(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Directory).where(Directory.owner_id == current_user.id))
    directories = result.scalars().all()
    return [{"id": d.id, "name": d.name} for d in directories]

@app.get("/api/directories/{dir_id}/files")
async def get_files(dir_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify directory ownership
    dir_result = await db.execute(select(Directory).where(Directory.id == dir_id, Directory.owner_id == current_user.id))
    directory = dir_result.scalars().first()
    if not directory:
        raise HTTPException(status_code=404, detail="Katalog nie istnieje lub brak dostępu")
        
    result = await db.execute(select(File).where(File.directory_id == dir_id))
    files = result.scalars().all()
    return [{"id": f.id, "name": f.name, "size_bytes": f.size_bytes, "created_at": f.created_at} for f in files]

@app.get("/api/download/{file_id}")
async def download_file(file_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 1. Fetch file
    file_result = await db.execute(select(File).where(File.id == file_id))
    db_file = file_result.scalars().first()
    if not db_file:
        raise HTTPException(status_code=404, detail="Plik nie istnieje")
        
    # 2. Verify directory ownership
    if current_user.is_admin:
        dir_result = await db.execute(select(Directory).where(Directory.id == db_file.directory_id))
    else:
        dir_result = await db.execute(select(Directory).where(Directory.id == db_file.directory_id, Directory.owner_id == current_user.id))
        
    directory = dir_result.scalars().first()
    if not directory:
        raise HTTPException(status_code=403, detail="Brak dostępu do pliku")
        
    # 3. Log the download action
    audit_log = AuditLog(
        user_id=current_user.id,
        action="DOWNLOAD",
        resource=f"File ID: {file_id}, Name: {db_file.name}"
    )
    db.add(audit_log)
    await db.commit()

    # 4. Construct URI for X-Accel-Redirect
    nginx_path = os.path.join(directory.path_on_disk, db_file.name)
    
    # 5. Zwracamy odpowiedź z nagłówkiem X-Accel-Redirect
    response = Response()
    response.headers["X-Accel-Redirect"] = nginx_path
    response.headers["Content-Disposition"] = f'attachment; filename="{db_file.name}"'
    return response
