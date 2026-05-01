# Raport audytu bezpieczeństwa aplikacji SendFile

## Przegląd
Ten raport podsumowuje audyt bezpieczeństwa przeprowadzony w aplikacji SendFile, systemie udostępniania plików z uwierzytelnianiem użytkowników, kontrolami administracyjnymi i możliwościami zarządzania plikami.

## Zakres audytu
- Backend: Aplikacja Python/FastAPI
- Frontend: Aplikacja React/Vite
- Konfiguracja: Docker-compose, Nginx, zmienne środowiskowe
- Baza danych: SQLAlchemy ORM z obsługą SQLite/PostgreSQL

## Wyniki

### 1. Uwierzytelnianie i autoryzacja
**Mocne strony:**
- Hasła/PIN-y są hashowane za pomocą bcrypt poprzez kontekst passlib
- Tokeny JWT są używane do zarządzania sesjami z odpowiednim wygaszaniem
- Endpointy administracyjne odpowiednio sprawdzają uprawnienia administratora
- Endpoint logowania ma ograniczenie częstotliwości (5 prób/minuta)

**Słabości:**
- Domyślna wartość SECRET_KEY ("super-secret-dev-key") jest używana, jeśli zmienna środowiskowa nie jest ustawiona
- Skrypt inicjalizujący ujawnia jawne PIN-y w wyjściu konsoli (admin:1234, user:1234)
- Brak mechanizmu blokady konta po nieudanych próbach logowania
- Tokeny są długo żywotne (24 godziny) bez mechanizmu odświeżania tokenów

### 2. Walidacja i oczyszczanie danych wejściowych
**Mocne strony:**
- Użycie ORM SQLAlchemy zapobiega atakom typu SQL injection
- Wykorzystywane są zaparametryzowane zapytania w całej bazie kodu
- Walidacja typu pliku nie jest zaimplementowana (akceptuje dowolny typ pliku)

**Słabości:**
- Brak oczyszczania nazw plików: nazwy przesyłanych plików są używane bezpośrednio w ścieżkach plików
  - Ryzyko: Jeśli nazwa pliku zawiera sekwencje przejścia ścieżki (np. "../../../etc/passwd"), może ona zapisywać poza zamierzonym katalogiem
  - Łagodzenie: Katalog bazowy jest kontrolowany przez aplikację, ale nazwa pliku nadal powinna być oczyszczona
- Brak walidacji typu zawartości pliku lub złośliwego przesyłania plików
- Endpoint pobierania używa nazwy pliku z bazy danych w nagłówku Content-Disposition bez oczyszczania

### 3. Ograniczenie częstotliwości i ochrona przed DoS
**Mocne strony:**
- Endpoint logowania chroniony przez ograniczenie częstotliwości (5/minuta)
- Nginx skonfigurowany z limitami czasów i połączeniami dla dużych transferów plików

**Słabości:**
- Tylko endpoint logowania ma ograniczenie częstotliwości; inne endpointy (przesyłanie plików, akcje administracyjne) są niezabezpieczone
- Brak ograniczenia częstotliwości na przesyłanie plików może umożliwić ataki wyczerpania dysku
- client_max_body_size ustawione na 0 w Nginx (nieograniczony rozmiar pliku) - choć zamierzone dla dużych plików, może być nadużywane
- Brak limitów przesyłania plików na użytkownika lub limitów magazynowania

### 4. Zarządzanie konfiguracją i sekretami
**Mocne strony:**
- Zmienne środowiskowe używane do konfiguracji (DATABASE_URL, SECRET_KEY)
- Separacja odpowiedzialności przez docker-compose i montowanie woluminów

**Słabości:**
- Zakodowana na stałe domyślna SECRET_KEY tworzy podatność, jeśli nie zostanie nadpisana w produkcji
- Skrypt inicjalizujący zawiera zakodowane na stałe poświadczenia i wyświetla je w konsoli
- Brak różnic konfiguracji między środowiskami deweloperskim i produkcyjnym
- Poufne dane (PIN-y) przechowywane jako hasze, ale słabe domyślne PIN-y (1234) w danych inicjalizujących

### 5. Infrastruktura i wdrożenie
**Mocne strony:**
- Nginx skonfigurowany jako odwrotny proxy z wewnętrzną lokalizacją dla chronionych mediów (X-Accel-Redirect)
- Docker-compose oddziela usługi z montowaniem woluminów
- Lokalizacja mediów chronionych jest wewnętrzna-only, zapobiegając bezpośredniemu dostępowi

**Słabości:**
- Brak konfiguracji HTTPS/TLS pokazanej w konfiguracji nginx (kończenie prawdopodobnie na balancerze obciążenia)
- Brak skonfigurowanych nagłówków bezpieczeństwa w Nginx (CSP, HSTS, X-Frame-Options, etc.)
- Plik bazy danych przechowywany w woluminie, który może nie być szyfrowany w stanie spoczynku

## Rekomendacje

### Krytyczne problemy
1. **Usuń domyślny SECRET_KEY**: Wymagaj ustawienia zmiennej środowiskowej SECRET_KEY w produkcji
2. **Oczyszczaj nazwy plików**: Usuń lub uciekaj od separatorów ścieżek w przesyłanych nazwach plików przed użyciem
3. **Usuń wyjście poświadczeń ze skryptu inicjalizującego**: Nie wyświetlaj PIN-ów lub haseł w logach konsoli

### Wysoki priorytet
1. **Zaimplementuj ograniczenie częstotliwości na wszystkich endpointach**: Szczególnie przesyłanie plików i akcje administracyjne
2. **Dodaj walidację przesyłania plików**: Ogranicz typy plików, skanuj pod kątem złośliwego oprogramowania, wprowadź limity rozmiaru na użytkownika
3. **Użyj silnych domyślnych PIN-ów**: Wymagaj zmiany PIN-u przy pierwszym logowaniu lub generuj bezpieczne losowe PIN-y

### Średni priorytet
1. **Zaimplementuj blokadę konta**: Po N nieudanych próbach logowania, tymczasowo zablokuj konto
2. **Dodaj nagłówki bezpieczeństwa**: Skonfiguruj Nginx aby dodawał CSP, HSTS, X-Frame-Options, etc.
3. **Zaimplementuj odświeżanie tokenów**: Zmniejsz czas życia tokenu dostępu i zaimplementuj rotację tokenów odświeżania
4. **Dodaj rejestrowanie audytu dla działań poufnych**: Śledź przesyłanie plików, usuwanie, zmiany uprawnień

### Niski priorytet
1. **Szyfruj bazę danych w stanie spoczynku**: Szczególnie jeśli używasz SQLite w produkcji
2. **Zaimplementuj walidację zawartości pliku**: Sprawdzaj pod kątem złośliwej zawartości w przesyłanych plikach
3. **Dodaj Web Application Firewall (WAF)**: Warstwowa ochrona 7 dla typowych luk webowych
4. **Regularne aktualizacje zależności**: Utrzymuj wszystkie pakiety w najnowszych bezpiecznych wersjach

## Wnioski
Aplikacja SendFile ma solidne podstawy bezpieczeństwa z odpowiednimi mechanizmami uwierzytelniania, użyciem ORM zapobiegającym SQL injection i przemyślaną architekturą do dużych transferów plików. Jednakże potrzebne są różne usprawnienia, aby zahartować aplikację przed powszechnymi lukami webowymi, szczególnie w obszarach walidacji danych wejściowych, ograniczania częstotliwości i zarządzania konfiguracją.

Rozwiązanie rekomendacji o krytycznym i wysokim priorytecie znacząco poprawiłoby stan bezpieczeństwa aplikacji.