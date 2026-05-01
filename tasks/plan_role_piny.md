# Plan Naprawy Krytycznych Błędów Uploadu

Analiza wykazała słuszność zgłoszonych uwag. Aplikacja posiada błąd w kodzie uniemożliwiający działanie uploadu (brakujący import) oraz lukę bezpieczeństwa (Path Traversal).

## 1. Brakujący import `aiofiles`
- **Diagnoza:** Przy refaktoryzacji z `shutil` na `aiofiles` zapomniano dodać deklarację importu w pliku `backend/main.py`. Skutkuje to rzuceniem wyjątku `NameError` w momencie próby wywołania `aiofiles.open()`, przez co upload zawsze kończy się błędem 500.
- **Działanie:** Dodanie `import aiofiles` na początku pliku `backend/main.py`.

## 2. Luka Path Traversal
- **Diagnoza:** Aplikacja naiwnie ufa nazwie pliku przesyłanej przez użytkownika w parametrze `file.filename` (linia 133 w `main.py`):
  `file_path = os.path.join(directory.path_on_disk, file.filename)`
  Jeśli złośliwy użytkownik prześle plik o nazwie np. `../../../etc/passwd`, Nginx lub FastAPI zapisze go poza wydzielonym, bezpiecznym wolumenem `protected_media`, nadpisując potencjalnie krytyczne pliki systemowe serwera.
- **Działanie:**
  - Wymuszenie czyszczenia nazwy pliku za pomocą `os.path.basename(file.filename)`. Spowoduje to wycięcie wszelkich ścieżek złośliwego użytkownika (np. z `../../../tajne.txt` zostanie tylko `tajne.txt`).
  - Dodanie walidacji odrzucającej puste nazwy plików lub pliki zawierające wyłącznie znaki niedrukowalne.

## 3. Restart i Weryfikacja
- **Działanie:** Po zaaplikowaniu zmian w pliku `backend/main.py`, konieczne będzie wykonanie przeładowania kontenera backendu (`docker compose restart backend`) w celu zaczytania nowego, załatanego kodu.
