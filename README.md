# Instrukcja Wdrożeniowa (Deployment Manual) - System Wymiany Skanów

Niniejszy dokument opisuje krok po kroku, jak poprawnie uruchomić kompletną aplikację na całkowicie nowej maszynie (np. na serwerze produkcyjnym VPS w firmie lub u innego dostawcy).

Aplikacja została w całości skonteneryzowana i jest w pełni niezależna od systemu operacyjnego (działa na Linuksie, macOS, Windowsie), o ile spełnione są minimalne wymagania.

## 1. Wymagania Wstępne (Prerequisites)
Przed przystąpieniem do instalacji upewnij się, że nowa maszyna posiada:
1. Zainstalowany system **Docker** (środowisko uruchomieniowe dla kontenerów).
2. Zainstalowane narzędzie **Docker Compose** (zwykle dostarczane razem z Dockerem).
3. Otwarty port **80** w zaporze sieciowej (Firewall) serwera – dla dostępu do aplikacji (Nginx).
4. Wolną przestrzeń dyskową, adekwatną do ilości skanów (np. setki gigabajtów / terabajty).

## 2. Krok po Kroku: Instalacja i Uruchomienie

### Krok 1: Przeniesienie plików aplikacji
Skopiuj cały katalog z kodem źródłowym aplikacji (zawierający foldery `backend`, `frontend`, `infra` oraz plik `docker-compose.yml`) na nową maszynę. Możesz to zrobić poprzez:
- Klonowanie repozytorium z systemu Git (np. GitHub/GitLab).
- Bezpośrednie skopiowanie plików przez SCP/SFTP z maszyny deweloperskiej.

### Krok 2: Uruchomienie środowiska (Budowanie kontenerów)
Będąc w terminalu na nowej maszynie, przejdź do głównego katalogu aplikacji (tam, gdzie znajduje się plik `docker-compose.yml`) i wykonaj komendę:

```bash
docker compose up -d --build
```
> **Co to robi?** Komenda pobiera wymagane obrazy bazowe, buduje obraz środowiska Pythonowego, instaluje wszystkie biblioteki i uruchamia w tle demony serwera backendowego (FastAPI) oraz reverse-proxy (Nginx).

### Krok 3: Inicjalizacja bazy danych (Seed)
Aplikacja została uruchomiona, ale nowa baza danych jest całkowicie pusta. Musisz utworzyć pierwszego użytkownika administracyjnego, by móc zarządzać systemem. W tym samym katalogu wykonaj komendę:

```bash
docker compose exec backend python seed.py
```
> **Co to robi?** Polecenie wchodzi w interakcję z działającym kontenerem backendu i uruchamia skrypt `seed.py`. Skrypt ten natychmiast utworzy plik bazy SQLite i załaduje do niego dwa początkowe konta:
> - **Administrator**: login `admin`, PIN `1234`
> - **Przykładowy Lekarz**: login `user`, PIN `1234`
> 
> *Uwaga: Zaleca się zalogowanie od razu po instalacji do panelu i zmianę powyższych domyślnych kodów PIN na mocniejsze!*

### Krok 4: Dostęp do Systemu
Aplikacja jest gotowa! Możesz do niej przejść z poziomu przeglądarki, wpisując adres IP maszyny w sieci:
```
http://<ADRES_IP_SERWERA>/
```
> *Uwaga: W przypadku środowisk docelowych należy wdrożyć protokół HTTPS, wystawiając certyfikaty (np. Let's Encrypt / Certbot) z poziomu serwera proxy Nginx, aby zabezpieczyć logowanie i przesył.*

---

## 3. Utrzymanie i Zarządzanie (Gdzie są dane?)

Ważne jest, aby wiedzieć, gdzie fizycznie na nowej maszynie Docker przetrzymuje dane. System opiera się na **Docker Volumes** (zewnętrznych wolumenach zmapowanych do kontenera), dzięki czemu przy restarcie serwera lub aktualizacji kontenerów, nie tracisz wgranych skanów i bazy pacjentów.

- **Baza danych (SQLite):** Zapisywana na wolumenie `sendfile_db_data` (montowana wewnątrz na `/app/data/sendfile.db`).
- **Pliki ze Skanami (DICOM):** Zapisywane na głównym dysku w wolumenie nazwanym `sendfile_media` (montowanym wewnątrz na `/protected_media/`).

Aby odnaleźć fizyczną ścieżkę do plików skanów na Twoim linuksowym dysku-matce, możesz wywołać:
```bash
docker volume inspect sendfile_sendfile_media
```
(Spójrz na wartość w polu `Mountpoint`).

## 4. Przydatne komendy do obsługi

- **Podgląd logów backendu na żywo** (np. by zdiagnozować wgrywanie pliku):
  ```bash
  docker compose logs backend -f
  ```
- **Zatrzymanie całego systemu:**
  ```bash
  docker compose down
  ```
- **Aktualizacja aplikacji:**
  Jeśli wdrożyłeś zmiany w kodzie i skopiowałeś je na serwer, musisz przebudować i zrestartować aplikację komendą z Kroku 2:
  ```bash
  docker compose up -d --build
  ```

## 5. Licencja
Ten projekt jest udostępniony na licencji Creative Commons Attribution-NonCommercial-NoDerivs 4.0. Możesz go używać na własne potrzeby, ale nie możesz go modyfikować ani używać w celach komercyjnych.