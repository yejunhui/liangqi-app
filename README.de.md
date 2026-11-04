# Liangqi · 两讫

> Klare Konten, beglichene Schulden.

**Sprachen:** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português](README.pt.md) · [Русский](README.ru.md)

**Online-App:** https://arksc.cn:8002/workbook/  
**Quellcode:** [Gitee](https://gitee.com/PharaohMan/liangqi-app) · [GitHub](https://github.com/yejunhui/liangqi-app)  
**Lizenz:** AGPL-3.0-or-later

Liangqi ist eine **Local-First-Web-App für gemeinsame Finanzbücher**, die Barausgaben und Kreditkäufe getrennt verwaltet:

- **Barausgaben** werden sofort vom Ersparten abgezogen.
- **Kreditkäufe** lassen das Ersparte unberührt, zählen bei der Erfassung als Ausgabe und erhöhen die Verbindlichkeiten. Bei der Rückzahlung wird die Ausgabe nicht erneut gezählt; nur Erspartes, Verbindlichkeiten und verfügbare Aktiva sinken.
- Eine **Rückzahlung** verschiebt Geld von Aktiva zu Verbindlichkeiten; die Ausgabe wurde bereits beim Kauf erfasst.

Daten bleiben standardmäßig im Browser. Du kannst mehrere Bücher führen und ein GitHub-, Gitee- oder WebDAV-Repository verbinden, um ein Buch mit mehreren Personen zu teilen.

![Liangqi-Dashboard](docs/screenshots/dashboard.png)

## So funktioniert es

| Vorgang | Aktiva / Erspartes | Verbindlichkeiten | Ausgabe |
| --- | ---: | ---: | ---: |
| Barzahlung | −100 | 0 | +100 |
| Kreditkauf | 0 | +100 | +100 |
| Rückzahlung | −100 | −100 | 0 |
| Kreditaufnahme | +100 | +100 | 0 |

- Ein Kreditkauf zählt bei der Erfassung als Ausgabe und erhöht die Verbindlichkeiten; das Ersparte bleibt unberührt, daher **bleiben die verfügbaren Aktiva unverändert**.
- Bei der Rückzahlung wird die Ausgabe nicht erneut gezählt; nur die verfügbaren Aktiva sinken.
- Nettovermögen = Aktiva − Verbindlichkeiten. Ein Kreditkauf senkt es durch die höhere Verbindlichkeit; die Rückzahlung verändert es nicht.

## Funktionen

- **Mehrere Bücher**: Familie, Reisen, Geschäft usw. mit schnellem Wechsel.
- **Aktiv- und Passivkonten**: Bargeld, Bank, Kreditkarte, Huabei, Darlehen und Anfangssalden.
- **Rechnungen**: Name, Kategorie, Fälligkeit, Teilzahlung und Status.
- **Rückzahlungen**: von einem Aktivkonto zahlen; Verbindlichkeit und Erspartes sinken. Die Ausgabe wurde bereits beim Kauf erfasst.
- **Mitglieder**: Rechnungen und Buchungen Familienmitgliedern zuordnen; gemeinsame Bücher mit Anmeldung pro Mitglied.
- **Tags und zweistufige Kategorien**: Lebenssituation, Zweck, Person; Ober- und Unterkategorien.
- **Budgets und wiederkehrende Buchungen**: monatlich oder jährlich, nach Kategorie, Tag oder Mitglied.
- **CSV-Import**: WeChat, Alipay und Banken mit automatischer Spaltenerkennung.
- **Mehrere Währungen und Anhänge**: Wechselkurse, Originalbetrag und Dateien bis 10 MB.
- **Analyse und Berichte**: Entwicklung, Kategorien, Tags, Mitglieder, 6-Monats-Trend, CSV und PDF.
- **KI-Assistent**: mit einer OpenAI-kompatiblen API Analyse und Budgetvorschläge.
- **PWA und offline**: auf Desktop oder Handy installieren und die Oberfläche offline öffnen.
- **10 Sprachen**: Chinesisch (vereinfacht/traditionell), Englisch, Japanisch, Koreanisch, Spanisch, Französisch, Deutsch, Portugiesisch und Russisch.

## Schnellstart

Nutze die Online-App oder starte sie lokal:

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build:workbook
```

Die ausführliche Anleitung steht in [docs/deployment.md](docs/deployment.md) (auf Chinesisch).

## Daten und Datenschutz

- Das Buch liegt in **IndexedDB** des Browsers, mit `localStorage` als Rückfall.
- Mit einem Remote-Repository liegen die Daten in deinem GitHub-/Gitee-Repository oder WebDAV. Liangqi hat keinen eigenen Datenserver.
- Mitgliedspasswörter werden nur als **PBKDF2-Hash** gespeichert, nie im Klartext.
- Tokens und KI-API-Schlüssel bleiben im `localStorage` des Geräts und laufen nicht über Liangqi-Server.
- Das Löschen der Browserdaten löscht auch das lokale Buch. Exportiere regelmäßig eine Sicherung.

## Projekt unterstützen

Wenn dir Liangqi hilft, kannst du die Entwicklung per Alipay oder WeChat unterstützen:

| Alipay | WeChat |
| --- | --- |
| <img src="public/support/alipay-qr.jpg" alt="Alipay-QR" width="200" /> | <img src="public/support/wechat-qr.jpg" alt="WeChat-QR" width="200" /> |

## Lizenz

Veröffentlicht unter der **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. Der vollständige Text steht in [LICENSE](LICENSE).

- Du darfst das Programm nutzen, ändern und weitergeben.
- Bei einer Weitergabe einer geänderten Version musst du den zugehörigen Quellcode und den Lizenztext bereitstellen.
- Wenn du das Programm änderst und über ein Netzwerk bereitstellst, verlangt Abschnitt 13 der AGPL, den Nutzern den zugehörigen Quellcode anzubieten.
- Frühere Versionen wurden unter GPL-3.0-or-later veröffentlicht. Diese Erlaubnisse bleiben gültig.

Lizenzen Dritter: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Haftungsausschluss

Liangqi ist ein Buchhaltungswerkzeug und keine Finanz-, Steuer- oder Anlageberatung. Exportiere vor der Nutzung eine Sicherung. Die Autoren haften nicht für Datenverlust, Rechenfehler oder Schäden aus der Nutzung dieser Software.
