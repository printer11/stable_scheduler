# 🐴 Konik Dzieciom — Aplikacja do zarządzania stajnią

PWA (Progressive Web App) do zarządzania harmonogramem jazd konnych, rezerwacjami miejsc i komunikacją między administratorem stajni a właścicielami koni / uczniami.

---

## 🚀 Demo

Hostowane na **Netlify** — deploy automatyczny po każdym `git push` na `main`.

---

## 🛠 Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | Vanilla HTML/CSS + [Alpine.js](https://alpinejs.dev/) 3.x |
| Autoryzacja | [Firebase Authentication](https://firebase.google.com/products/auth) (email + hasło) |
| Baza danych | [Firebase Firestore](https://firebase.google.com/products/firestore) (real-time onSnapshot) |
| Hosting | [Netlify](https://netlify.com) |
| Fonty | Google Fonts — Epilogue + Manrope |
| Kalendarz popup | [Calendly](https://calendly.com) widget (embed) |

**Brak bundlera, brak Node.js, brak npm** — całość to jeden plik `index.html` + dwa pliki prawne. Firebase SDK i Alpine.js ładowane przez CDN.

---

## 📁 Struktura plików

```
/
├── index.html                     # Cała aplikacja (HTML + CSS + JS)
├── terms.html                     # Regulamin
├── privacy.html                   # Polityka prywatności (RODO)
├── manifest.json                  # PWA manifest
├── sw.js                          # Service Worker (offline support)
├── netlify.toml                   # Konfiguracja Netlify
├── L-white_Konikdzieciom_text.png # Logo (białe tło, używane w app)
└── L-transparent_Konikdzieciom.png # Logo (transparent, zapas)
```

---

## 🔥 Firebase — kolekcje Firestore

```
reservations/{id}
  - date, startTime, duration, location
  - type: pensjonat | lekcja | blokada
  - horse, userEmail, userName
  - status: pending | confirmed | rejected
  - rejectMessage?, createdAt

users/{uid}
  - email, name, surname, initials
  - role: admin | owner | student
  - horse, photo (base64), createdAt

notifications/{id}
  - userEmail, type: accepted | rejected | moved
  - bookingDate, bookingTime, bookingLoc, horse
  - message, read, createdAt

config/horses
  - list: string[]   ← lista koni w stajni
```

**Region Firebase:** `europe-central2` (Warszawa) — dane przechowywane w Polsce zgodnie z RODO.

---

## 👤 Role użytkowników

| Rola | Możliwości |
|---|---|
| `admin` | Pełny dostęp — zatwierdza/odrzuca/przesuwa rezerwacje, zarządza użytkownikami i końmi, tworzy konta |
| `owner` | Właściciel konia — składa prośby o rezerwacje pensjonatu |
| `student` | Uczeń — składa prośby o lekcje |

---

## ⚙️ Konfiguracja Firebase

W pliku `index.html` znajdź sekcję `FIREBASE CONFIG` i wklej dane ze swojego projektu Firebase:

```js
const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...'
};
```

### Pierwsze uruchomienie

1. Utwórz projekt na [console.firebase.google.com](https://console.firebase.google.com)
2. Włącz **Authentication → Email/Password**
3. Utwórz **Firestore Database** (region: `europe-central2`)
4. Wklej `firebaseConfig` do `index.html`
5. W Firebase Auth — dodaj ręcznie konto admina
6. W Firestore — utwórz kolekcję `users`, dokument z UID admina, pola: `email`, `name`, `surname`, `initials`, `role: "admin"`, `horse: ""`, `photo: ""`
7. Dodaj domenę Netlify do **Authentication → Settings → Authorized domains**

### Zapraszanie użytkowników

Admin z poziomu panelu wpisuje imię, nazwisko, email i rolę. Aplikacja:
- Tworzy konto Firebase Auth (przez Secondary App — bez wylogowania admina)
- Zapisuje profil w Firestore `/users/{uid}`
- Wysyła email z linkiem do ustawienia hasła

---

## 🔄 Real-time sync

Aplikacja używa `onSnapshot` — kalendarz i powiadomienia aktualizują się **na żywo** bez odświeżania strony. Idealne gdy tablet stajenny i telefony właścicieli koni są jednocześnie otwarte.

---

## 📱 PWA

Aplikacja działa jako PWA — można ją zainstalować na telefonie/tablecie „jak natywną aplikację":
- `manifest.json` — ikona, nazwa, kolory
- `sw.js` — Service Worker dla trybu offline

---

## 🔐 Firestore Security Rules

Obecne reguły (tryb testowy — **wygasają 23 kwietnia 2026**):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2026, 4, 23);
    }
  }
}
```

**⚠️ Przed produkcją** należy zabezpieczyć reguły — np.:
```
allow read, write: if request.auth != null;
```

---

## 🏗 Deploy

```bash
git add -A
git commit -m "opis zmian"
git push
```

Netlify automatycznie deployuje po pushu na `main`. Czas deployu ~30 sekund.

---

## 🎨 Design

- **Kolory:** głęboka zieleń `#006d4a` jako primary
- **Fonty:** Epilogue 900 (nagłówki) + Manrope (body)
- **Tryb:** Light mode
- **Mobile-first:** zoptymalizowane pod telefon / tablet
- **Animacje:** cubic-bezier spring animations, reveal on scroll

---

## 📜 Prawne

- [Regulamin](/terms.html)
- [Polityka Prywatności](/privacy.html)

Dane przechowywane w Firebase (Warszawa, PL). Nie wykorzystywane do celów marketingowych.

---

## ✨ Wykonanie

Aplikacja wykonana przez **[ZenAutomations](https://zenautomations.cloud)** — automatyzacje i aplikacje webowe dla małych firm.
