# Architektura Systemu i Plan Implementacji

## 1. Architektura Systemu

### 1.1 Backend (Python)
- **Framework**: FastAPI. Wybór podyktowany asynchronicznością (ASGI), wysoką wydajnością oraz natywnym wsparciem dla walidacji danych (Pydantic).
- **Zadania**: Autoryzacja użytkowników, zarządzanie uprawnieniami do plików, serwowanie metadanych (struktura katalogów), autoryzacja żądań pobierania.

### 1.2 Frontend (JS/TS)
- **Stos technologiczny**: React (Vite) + TypeScript + Tailwind CSS.
- **Zadania**: Renderowanie minimalistycznego interfejsu logowania (Login + PIN), wyświetlanie struktury plików/katalogów (np. tabela lub drzewo), inicjowanie pobierania.

### 1.3 Storage i Serwowanie Plików
- **Serwer WWW / Proxy**: Nginx.
- **Mechanizm**: FastAPI weryfikuje uprawnienia użytkownika do pliku. Zamiast wczytywać plik (10-50GB) do pamięci Pythona, FastAPI zwraca odpowiedź z nagłówkiem `X-Accel-Redirect` (lub `X-Sendfile`). Nginx przechwytuje ten nagłówek i samodzielnie, bezpośrednio z systemu plików serwuje plik do klienta.
- **Wydajność**: Odciąża aplikację w Pythonie, pozwala Nginxowi na zarządzanie streamingiem, chunkingiem oraz obsługą nagłówków `Range` (wznawianie pobierania).

---

## 2. Struktura Bazy Danych

Sugerowana baza: PostgreSQL (produkcyjnie) lub SQLite (prototyp). ORM: SQLAlchemy.

### Tabela: `users`
- `id` (UUID/Integer, PK)
- `username` (String, Unique)
- `pin_hash` (String) - przechowywany jako hash (np. bcrypt), mimo że to PIN.
- `created_at` (DateTime)

### Tabela: `directories`
- `id` (UUID/Integer, PK)
- `name` (String)
- `path_on_disk` (String) - fizyczna ścieżka na serwerze.
- `owner_id` (FK -> users.id) - powiązanie zasobu z konkretnym użytkownikiem.

### Tabela: `files`
- `id` (UUID/Integer, PK)
- `name` (String)
- `size_bytes` (BigInteger)
- `directory_id` (FK -> directories.id)
- `created_at` (DateTime)

---

## 3. Plan Implementacji (Etapy)

### Etap 1: Setup i Środowisko
- [x] Utworzenie struktury repozytorium (katalogi `backend`, `frontend`, `infra`).
- [x] Konfiguracja `docker-compose.yml` zawierającego usługi: FastAPI, PostgreSQL, Nginx.
- [x] Inicjalizacja projektu React (Vite) oraz konfiguracja Tailwind CSS.
- [x] Inicjalizacja projektu FastAPI, konfiguracja SQLAlchemy i skryptów migracyjnych (Alembic).

### Etap 2: Autoryzacja i Baza Danych
- [x] Implementacja modeli bazy danych (`User`, `Directory`, `File`).
- [x] Endpoint `/auth/login` przyjmujący `username` i `pin`, zwracający token JWT lub ustawiający ciasteczko HttpOnly.
- [x] Middleware w FastAPI do weryfikacji tokenu przy dostępie do zasobów.
- [x] Utworzenie skryptu seedującego bazę przykładowymi danymi i plikami testowymi.

### Etap 3: API do Zarządzania Zasobami
- [x] Endpoint `/api/directories` - zwraca listę katalogów przypisanych do zalogowanego użytkownika.
- [x] Endpoint `/api/directories/{dir_id}/files` - zwraca listę plików w danym katalogu.

### Etap 4: File Handling i Infrastruktura (Wyzwanie Techniczne)
- [x] Konfiguracja Nginx: dodanie bloku `internal;` dla fizycznego katalogu z plikami (ochrona przed bezpośrednim dostępem z pominięciem FastAPI).
- [x] Endpoint `/api/download/{file_id}` w FastAPI. Algorytm:
  1. Weryfikacja tożsamości użytkownika.
  2. Weryfikacja, czy plik należy do użytkownika.
  3. Zwrócenie pustej odpowiedzi z nagłówkiem: `X-Accel-Redirect: /protected_media/scans/plik.dcm`.
- [x] **Pojęcia kluczowe do weryfikacji w Nginx**:
  - `Chunked Transfer Encoding`: Mechanizm przesyłania danych w fragmentach (chunks), co zapobiega zrywaniu połączeń przy długotrwałym transferze.
  - Nagłówek `Accept-Ranges: bytes`: Należy upewnić się, że Nginx obsługuje żądania z nagłówkiem `Range` (np. `Range: bytes=5000000-`), co jest niezbędne dla wznawiania przerwanych pobierań w przeglądarkach.

### Etap 5: Interfejs Użytkownika (UI/UX)
- [x] Implementacja ekranu logowania.
- [x] Implementacja głównego widoku po zalogowaniu: boczny panel (lista pacjentów/katalogów), główny panel (lista plików).
- [x] Mechanizm pobierania na frontendzie: zastosowanie standardowych tagów `<a>` z atrybutem `download` wskazujących na endpoint API. Zapewnia to natywną obsługę wznawiania i postępu w przeglądarce bez obciążania pamięci RAM przeglądarki (w odróżnieniu od pobierania przez Fetch API/Blob).
- [x] Obsługa błędów autoryzacji (np. automatyczne wylogowanie po wygaśnięciu sesji).

### Etap 6: Security i Optymalizacja
- [x] Konfiguracja SSL/TLS (HTTPS) - kluczowe przy przesyłaniu danych medycznych. (Przygotowane pod proxy w produkcji, Nginx proxy gotowe)
- [x] Rate limiting na endpoint logowania (ochrona przed atakiem brute-force na PIN).
- [x] Dodanie logowania audytowego (zapisywanie informacji o tym, kto i kiedy pobrał dany skan).
- [x] Weryfikacja timeoutów Nginx i Gunicorn/Uvicorn, aby zapobiec ubijaniu długich połączeń przez proxy.