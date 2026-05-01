# Plan uzupełnienia funkcjonalności systemu wymiany skanów (Zgodnie ze specyfikacją)

Ten plan zawiera listę kroków niezbędnych do pełnego zrównania obecnej aplikacji ze szczegółową specyfikacją z pliku `@specyfikacja_aplikacji_wymiany_danych.md`.

## Etap 1: Migracja bazy danych do SQLite (Dostosowanie do specyfikacji)
Obecnie system korzysta z PostgreSQL w osobnym kontenerze. Specyfikacja wymusza użycie lekkiego SQLite.
- [x] Usunięcie usługi `db` (PostgreSQL) z pliku `docker-compose.yml`.
- [x] Zmiana zmiennej środowiskowej `DATABASE_URL` w `docker-compose.yml` (lub bezpośrednio w kodzie) na `sqlite+aiosqlite:///./data/sendfile.db`.
- [x] Modyfikacja pliku `backend/requirements.txt`: usunięcie `asyncpg` i dodanie `aiosqlite`.
- [x] Zaktualizowanie pliku `backend/database.py` do obsługi połączenia z SQLite (np. wyłączenie niektórych flag specyficznych dla PostgreSQL).
- [x] Dodanie wolumenu dla SQLite w `docker-compose.yml`, aby plik bazy danych (`sendfile.db`) przetrwał restarty kontenera.

## Etap 2: Rozbudowa API Administratora (Zarządzanie i Audyt)
Rozbudowa backendu o brakujące operacje CRUD dla zasobów i logów.
- [x] **Endpoint: Usuwanie użytkowników** (`DELETE /api/admin/users/{user_id}`). Endpoint musi kaskadowo usuwać pliki, katalogi (z bazy i dysku) oraz logi audytowe powiązane z użytkownikiem.
- [x] **Endpoint: Zmiana PIN-u** (`PUT /api/admin/users/{user_id}/pin`).
- [x] **Endpoint: Usuwanie katalogu** (`DELETE /api/admin/directories/{dir_id}`). Usuwa rekordy z bazy oraz fizycznie kasuje folder z zawartością z dysku za pomocą `shutil.rmtree`.
- [x] **Endpoint: Usuwanie pojedynczego pliku** (`DELETE /api/admin/files/{file_id}`). Usuwa z bazy i fizycznie z dysku `os.remove`.
- [x] **Endpoint: Pobieranie logów audytowych** (`GET /api/admin/audit_logs`). Lista akcji w systemie z danymi kto, co i kiedy zrobił.

## Etap 3: Uzupełnienie logiki Audytowej (Logowanie systemowe)
Zgodnie ze specyfikacją system musi rejestrować więcej zdarzeń.
- [x] **Logowanie sesji:** Aktualizacja endpointu `/auth/login` w `backend/main.py`. W przypadku pomyślnego zalogowania, należy dodać wpis do tabeli `AuditLog` z akcją `LOGIN`.

## Etap 4: Modernizacja Interfejsu Administratora (React UI/UX)
Dostosowanie panelu administratora do nowych endpointów i wymagań UX.
- [x] **Zarządzanie Użytkownikami:** Dodanie w UI (np. po rozwinięciu opcji przy danym użytkowniku) przycisków "Zmień PIN" (wyświetla modal/prompt) oraz "Usuń użytkownika".
- [x] **Zarządzanie Plikami/Katalogami:** Dodanie obok katalogu i pliku czerwonego przycisku kosza z potwierdzeniem akcji przed usunięciem.
- [x] **Drag & Drop:** Stworzenie wyznaczonej strefy (Dropzone) nad listą plików wybranego katalogu. Złapanie i upuszczenie plików w tej strefie powinno inicjować proces uploadu identyczny z kliknięciem w przycisk systemowy.
- [x] **Zaawansowany Progress Bar:** Przebudowanie funkcji w `handleUpload`. Zamiast wyłącznie procentów, `xhr.upload.onprogress` powinno obliczać:
  - Prędkość przesyłania (bajtów/sekundę) na podstawie czasu trwania eventów.
  - Ilość przesłanych danych w formacie GB/MB (np. "Przesłano 2.1 GB / 25.0 GB").
- [x] **Widok Audytu (Logi):** Utworzenie nowej zakładki (np. "Logi systemowe" w bocznym menu admina), renderującej tabelę z wynikami z endpointu `/api/admin/audit_logs` (Data, Użytkownik, Akcja, Zasób).

## Etap 5: Testy i finalizacja
- [x] Odbudowanie i weryfikacja kontenerów z SQLite (`docker compose up --build -d`).
- [x] Weryfikacja usunięcia fizycznych plików z dysku po wywołaniu odpowiednich akcji przez Admina.
- [x] Przetestowanie prędkości i wydajności w przeglądarce przy użyciu symulowanych dużych plików.