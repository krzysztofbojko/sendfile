# Audyt Techniczny – SendFile (System Wymiany Danych Medycznych)

**Data audytu:** 2026-04-29 (aktualizacja po poprawkach)
**Wersja kodu:** main

---

## 1. Stan poprawek po poprzednim audycie

| # | Problem z poprzedniego audytu | Status |
|---|---|---|
| 3.1 | Synchroniczny zapis uploadu | ✅ Poprawione (ale z błędem – patrz 4.1) |
| 3.2 | Deweloperski SECRET_KEY | ❌ Niepoprawione |
| 3.3 | Brak CORS | ❌ Niepoprawione |
| 3.4 | Nginx proxy do Vite | ❌ Niepoprawione |
| 3.5 | Niespójność apiFetch | ❌ Niepoprawione (App.tsx:47) |
| 3.6 | Ręczne cascade w modelach | ❌ Niepoprawione |
| 3.7 | Potencjalny problem X-Accel-Redirect | ❌ Niepoprawione |
| 3.8 | Brak walidacji PIN | ❌ Niepoprawione |
| 3.9 | Obsługa błędów makedirs | ❌ Niepoprawione |
| 3.10 | Paginacja logów audytowych | ❌ Niepoprawione |

---

## 2. Nowe problemy wykryte w tej wersji

### KRYTYCZNE

#### 2.1 Brak importu `aiofiles` – błąd `NameError` przy uploadzie

**Plik:** `backend/main.py:136`

```python
async with aiofiles.open(file_path, "wb") as buffer:
```

Kod używa `aiofiles.open()` ale nigdzie nie ma `import aiofiles`. Każda próba uploadu zakończy się błędem:
```
NameError: name 'aiofiles' is not defined
```
→ HTTP 500 przy każdym uploadzie.

**Rozwiązanie:** Dodać na górze `main.py`:
```python
import aiofiles
```

---

#### 2.2 Path Traversal przy uploadzie plików

**Plik:** `backend/main.py:133`

```python
file_path = os.path.join(directory.path_on_disk, file.filename)
```

`file.filename` pochodzi bezpośrednio od użytkownika. Jeśli atakujący wyśle plik o nazwie `../../../etc/cron.d/backdoor`, ścieżka wyjdzie poza katalog docelowy. Admin ma zaufanie, ale atak przejęcia sesji admina + ten błąd = zapis pliku w dowolnym miejscu w kontenerze.

**Rozwiązanie:** Użyć `werkzeug.utils.secure_filename()` lub ręcznie odrzucić nazwy zawierające `..` / `/`:
```python
import os
safe_name = os.path.basename(file.filename)
if safe_name != file.filename or ".." in file.filename:
    raise HTTPException(status_code=400, detail="Nieprawidłowa nazwa pliku")
```

---

### WAŻNE

#### 2.3 Token JWT w query stringu

**Plik:** `frontend/src/components/Dashboard.tsx:60-63`

```typescript
const getDownloadUrl = (fileId: number) => {
    const token = localStorage.getItem('token');
    return `/api/download/${fileId}?token=${token}`;
};
```

Tokeny w URL lądują w:
- logach serwera Nginx
- logach backendu
- historii przeglądarki
- nagłówku `Referer` przy nawigacji na zewnątrz

**Rozwiązanie:** Backend już wspiera token przez query param (`auth.py:40`), ale lepiej używać `apiFetch` z nagłówkiem `Authorization: Bearer` i pobierać plik przez `fetch` z utworzeniem linku do pobrania w JS (`blob` + `URL.createObjectURL`).

---

#### 2.4 PIN widoczny w formularzu tworzenia użytkownika

**Plik:** `frontend/src/components/AdminDashboard.tsx:387`

```tsx
<input type="text" ... />
```

Pole PIN ma `type="text"`, więc PIN jest widoczny na ekranie podczas wpisywania. Dla admina tworzącego konto użytkownika to naruszenie prywatności.

**Rozwiązanie:** Zmienić na `type="password"`.

---

#### 2.5 Użycie surowego `fetch` zamiast `apiFetch` w `handleLogin` (utrzymujący się bug)

**Plik:** `frontend/src/App.tsx:47`

```typescript
const res = await fetch('/api/me', {
    headers: { 'Authorization': `Bearer ${newToken}` }
});
```

Poprzedni audyt wskazał to w `verifyToken` (linia 21), co zostało poprawione na `apiFetch`. Ale `handleLogin` (linia 47) nadal używa surowego `fetch`. W razie przyszłych zmian w `apiFetch` (np. refresh tokena) to miejsce zostanie pominięte.

**Rozwiązanie:** Zamienić na `apiFetch('/api/me')`.

---

### ŚREDNIE

#### 2.6 `seed.py` niszczy wszystkie dane

**Plik:** `backend/seed.py:10`

```python
await conn.run_sync(Base.metadata.drop_all)
```

Uruchomienie seederki w środowisku produkcyjnym bezpowrotnie kasuje wszystkie dane.

**Rozwiązanie:** Dodać potwierdzenie (`input("Czy na pewno? (tak/nie): ")`) lub zmienną środowiskową `ALLOW_SEED=true`.

---

#### 2.7 Brak limitu rozmiaru uploadu na poziomie FastAPI

**Plik:** `backend/main.py:124`

Upload przyjmuje pliki bez limitu rozmiaru. Nginx ma `client_max_body_size 0` (bez limitu), co przy plikach 50GB+ jest celowe, ale brak jakiegokolwiek górnego limitu w aplikacji naraża na DoS.

**Rozwiązanie:** Rozważyć limit w FastAPI (np. 100GB) lub przynajmniej walidację po stronie serwera:
```python
MAX_UPLOAD_SIZE = 100 * 1024 * 1024 * 1024  # 100 GB
if file.size and file.size > MAX_UPLOAD_SIZE:
    raise HTTPException(413, "Plik przekracza maksymalny rozmiar")
```

---

### DROBNE

#### 2.8 Literówka w Content-Type

**Plik:** `frontend/src/components/Login.tsx:27`

```typescript
'Content-Type': 'application/x-www-form-urlencoded',
```

Poprawna wartość to `application/x-www-form-urlencoded` (brakuje myślnika: `form-urlencoded` → `x-www-form-urlencoded`). Większość serwerów i tak to akceptuje, ale technicznie niepoprawne.

**Rozwiązanie:** Zmienić na `application/x-www-form-urlencoded`.

---

#### 2.9 Brak nagłówków bezpieczeństwa

Backend nie ustawia:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (jeśli HTTPS w produkcji)

**Rozwiązanie:** Dodać middleware lub ustawić w Nginx:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

---

## 3. Problemy z poprzedniego audytu (nadal nierozwiązane)

Pełny opis w poprzedniej wersji raportu. W skrócie:

| Priorytet | Problem | Plik |
|---|---|---|
| **KRYTYCZNY** | Deweloperski SECRET_KEY | `auth.py:14` |
| **WAŻNY** | Brak CORS | `main.py` |
| **WAŻNY** | Nginx proxy do Vite dev-server | `nginx.conf:31` |
| **WAŻNY** | Ręczne cascade zamiast SQLAlchemy | `main.py:188-206` |
| **ŚREDNI** | Ścieżki X-Accel-Redirect | `main.py:311` |
| **NISKI** | Walidacja długości PIN | `main.py:30-32` |
| **NISKI** | Obsługa błędów makedirs | `main.py:113-115` |
| **NISKI** | Paginacja logów audytowych | `main.py:248-264` |

---

## 4. Podsumowanie

### Liczby

| Kategoria | Poprzedni audyt | Stan obecny |
|---|---|---|
| Problemy zgłoszone | 10 | — |
| Poprawione | — | 1 |
| Nierozwiązane | — | 9 |
| Nowo wykryte | — | 9 |
| **Otwarte łącznie** | **10** | **18** |

### Ryzyka wdrożeniowe – co MUSI być naprawione przed produkcją

1. **Import aiofiles (4.1)** – obecnie upload nie działa wcale (NameError).
2. **Path Traversal (4.2)** – umożliwia zapis pliku poza katalogiem docelowym.
3. **SECRET_KEY (3.2)** – tokeny JWT możliwe do podrobienia przy domyślnym kluczu.
4. **Nginx proxy do Vite (3.4)** – dev-server nie jest stabilny w produkcji.

Pozostałe 14 problemów można adresować przyrostowo.

---

## 5. Rekomendacje dodatkowe

1. **Testy automatyczne** – projekt nie ma żadnych testów (backend ani frontend). Przy 18 otwartych problemach i rozwoju kodu, testy są niezbędne. Minimum: testy integracyjne endpointów API z bazą SQLite w pamięci.

2. **CI/CD pipeline** – dodać GitHub Actions / GitLab CI z lintowaniem (flake8/ruff dla backendu, eslint dla frontendu), testami i skanowaniem bezpieczeństwa (bandit, npm audit).

3. **Monitoring** – rozważyć dodanie Sentry do zbierania wyjątków produkcyjnych z backendu.
