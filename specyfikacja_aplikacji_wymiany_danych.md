# Dokumentacja Techniczna i Specyfikacja Projektowa: System Wymiany Danych Medycznych (DICOM/CT)

## 1. Wstęp
Niniejszy dokument stanowi szczegółową specyfikację funkcjonalną i techniczną aplikacji służącej do bezpiecznego udostępniania i wymiany dużych zbiorów danych medycznych (skanów z tomografu komputerowego). System ma umożliwić pracownikom wewnętrznym (Administratorom) zarządzanie plikami i dostępem, a podmiotom zewnętrznym (Użytkownikom) bezpieczne pobieranie przypisanych im materiałów.

## 2. Architektura i Technologie
Aplikacja zostanie zbudowana w oparciu o nowoczesny stos technologiczny, zapewniający wydajność przy obsłudze bardzo dużych plików (25 GB – 50 GB+).

* **Backend:** Python z wykorzystaniem frameworka **FastAPI**. Wybór uzasadniony natywną obsługą asynchroniczności i wydajnym strumieniowaniem dużych obiektów.
* **Baza Danych:** **SQLite**. Lekkie rozwiązanie oparte na pliku, wystarczające do przechowywania metadanych, struktury folderów oraz logów.
* **Konteneryzacja:** **Docker**. Całe środowisko musi być spakowane w obraz Docker, zapewniając przenośność.
* **Przechowywanie danych:** Wykorzystanie **Docker Volumes**. Dane plików muszą znajdować się na dedykowanym wolumenie, aby zapobiec ich utracie po restarcie kontenera.
* **Interfejs:** Nowoczesny, minimalistyczny UI (zalecane Vue.js lub React), zorientowany na przejrzystość i prostotę obsługi.

## 3. Bezpieczeństwo
* **Sieć:** Aplikacja nie będzie dostępna w publicznym internecie. Dostęp jest możliwy wyłącznie po zestawieniu połączenia **VPN** do sieci zaufanej.
* **Autoryzacja:** Dostęp chroniony unikalnym identyfikatorem (Login) oraz kodem **PIN**.
* **Izolacja danych:** Użytkownik zewnętrzny widzi tylko i wyłącznie te projekty (foldery), które zostały mu bezpośrednio przypisane przez Administratora.

## 4. Role i Uprawnienia

### 4.1. Administrator (Pracownik Wewnętrzny)
* Pełny dostęp do panelu zarządzania.
* Zarządzanie użytkownikami (dodawanie, usuwanie, blokowanie, zmiana PIN).
* Zarządzanie strukturą plików (tworzenie folderów projektowych, usuwanie folderów).
* Wgrywanie plików (Upload) do konkretnych folderów.
* Przypisywanie konkretnych folderów (skanów) do wybranych użytkowników zewnętrznych.
* Podgląd logów systemowych i historii aktywności.

### 4.2. Użytkownik Zewnętrzny
* Dostęp tylko do dedykowanego panelu pobierania.
* Widok listy przypisanych folderów (projektów).
* Możliwość wejścia w folder i pobrania poszczególnych plików składowych skanu.

## 5. Funkcjonalności Szczegółowe

### 5.1. Zarządzanie Plikami i Uploadem
* **Struktura:** Jeden skan to jeden folder zawierający od kilku do kilkunastu dużych plików.
* **Multi-upload:** Administrator musi mieć możliwość zaznaczenia wielu plików naraz i dodania ich do kolejki przesyłania.
* **Metadane:** System musi automatycznie pobierać i wyświetlać rozmiar pliku oraz datę jego wgrania.
* **Wskaźnik Postępu (Progress Bar):** Dynamiczny pasek postępu informujący o procentowym zaawansowaniu wysyłki, prędkości i ilości przesłanych danych w czasie rzeczywistym.
* **Drag & Drop:** Wsparcie dla przeciągania plików bezpośrednio do okna przeglądarki w celu rozpoczęcia wgrywania.
* **Zarządzanie błędami:** Możliwość usunięcia błędnie wgranego pliku lub całego folderu.

### 5.2. Panel Użytkownika Zewnętrznego
* **Dashboard:** Lista dostępnych projektów przedstawiona w formie folderów z nazwami skanów.
* **Szczegóły projektu:** Po kliknięciu w folder użytkownik widzi listę plików wraz z ich rozmiarem (np. w GB) oraz datą udostępnienia.
* **Pobieranie:** Bezpośredni odnośnik do pobrania każdego pliku. System musi obsługiwać stabilne pobieranie bardzo dużych zbiorów danych bez przerywania sesji.

### 5.3. Logowanie i Audyt (Raportowanie)
System musi rejestrować każdą istotną akcję w celu późniejszej weryfikacji:
* **Logowania:** Kto i kiedy zalogował się do systemu.
* **Aktywność plików:** Informacja, czy użytkownik kliknął w link pobierania i czy plik został pobrany.
* **Czas zdarzenia:** Precyzyjna data i godzina każdego zdarzenia.

## 6. Wymagania Techniczne Kontenera Docker
* **Docker Compose:** Zalecane użycie docker-compose do definicji usług.
* **Persistent Storage:** Konfiguracja wolumenu (np. `/data/storage`), w którym fizycznie będą składowane pliki.
* **Limit wielkości:** Brak sztywnego limitu w aplikacji, obsługa plików >50GB poprzez odpowiednią konfigurację serwera (np. `client_max_body_size` w Nginx, jeśli będzie użyty jako Reverse Proxy).

## 7. Plan Działania (Roadmap)

### Faza 1: Przygotowanie środowiska i Backend
1. Konfiguracja projektu FastAPI i bazy SQLite.
2. Implementacja modeli danych (Użytkownik, Folder, Plik, Logi).
3. Stworzenie kontenera Docker i konfiguracja wolumenów do zapisu danych.
4. Implementacja mechanizmów autoryzacji (Login/PIN) i middleware dla ról.

### Faza 2: Obsługa plików (Core)
5. Opracowanie silnika do asynchronicznego wgrywania dużych plików (Streaming Upload).
6. Implementacja logiki zarządzania folderami (tworzenie/usuwanie) na poziomie systemu plików i bazy danych.
7. Stworzenie endpointów do bezpiecznego pobierania danych (Streaming Download).

### Faza 3: Frontend i UI
8. Budowa minimalistycznego interfejsu panelu Administratora.
9. Implementacja modułu Uploadu z obsługą Drag & Drop, Multi-select oraz Progress Bar.
10. Budowa panelu dla Użytkownika Zewnętrznego.
11. Integracja frontendu z API.

### Faza 4: Logowanie i Testy
12. Implementacja systemu rejestrowania zdarzeń (Logi).
13. Testy wydajnościowe przesyłania plików 50GB+ w sieci lokalnej/VPN.
14. Testy bezpieczeństwa (izolacja użytkowników, błędne PINy).
15. Finalna optymalizacja i przygotowanie dokumentacji wdrożeniowej.
