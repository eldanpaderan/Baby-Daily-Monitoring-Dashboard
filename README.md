# 🍼 BabyLog — Baby Daily Monitoring Dashboard

> A beautiful, fully offline Progressive Web App for tracking your newborn's daily activities. Built with pure HTML, CSS, and JavaScript — no backend, no build tools, deploys instantly to GitHub Pages.

![BabyLog Dashboard](assets/screenshot-dashboard.png)

---

## ✨ Features

### 📊 10 Tracking Modules
| Module | What It Tracks |
|--------|---------------|
| 🍼 **Feeding** | Type, amount, duration, burping, spit-up, medicine |
| 😴 **Sleep** | Start/end, duration, quality rating |
| 🧷 **Diaper** | Wet/dirty/both, stool color & consistency |
| 📏 **Growth** | Weight, height, head circumference with charts |
| 🌡️ **Temperature** | Readings with fever alerts (≥38°C) |
| 💊 **Medicine & Vitamins** | Dose tracking with compliance stats |
| 💉 **Vaccination** | Schedule, completion status, progress bar |
| 🏥 **Doctor Visits** | Diagnoses, prescriptions, follow-ups |
| 📖 **Baby Journal** | Daily notes, mood, milestones, photos |
| ⭐ **Milestones** | First smile, first steps, first word & more |

### 📈 Analytics & Intelligence
- Live dashboard with 12 summary cards
- Chart.js charts: daily/weekly feeding, sleep hours, diaper counts, growth trends, temperature history, medicine compliance, vaccination progress
- Next feeding time estimate
- Fever detection alerts
- Upcoming vaccine & vitamin reminders
- Doctor follow-up alerts
- Global search across all records

### 💾 Export & Import
- **Excel (.xlsx)** — Full workbook with 11 sheets (Dashboard Summary, all modules, Statistics)
- **CSV** — Individual file per module
- **PDF** — Today / Weekly / Monthly printable reports
- **JSON Backup** — Complete data backup & restore
- **Print** — Browser print dialog with formatted layout
- **Import** — JSON, Excel, or CSV with duplicate prevention

### 📱 Progressive Web App
- ✅ Installable on iOS, Android, and desktop
- ✅ Works 100% offline after first load
- ✅ Service worker with cache-first strategy
- ✅ App shortcuts for quick feeding/diaper logging
- ✅ Mobile-first responsive design
- ✅ One-handed operation with FAB quick-add

### ♿ Accessibility
- ARIA roles, labels, and live regions throughout
- Keyboard navigation (Alt+N = new record, Alt+D = dashboard, Escape = close)
- Skip-to-content link
- Focus management in modals
- Screen reader compatible

---

## 🚀 Quick Start

### Option 1 — Open Locally
```bash
git clone https://github.com/YOUR_USERNAME/babylog.git
cd babylog
# Open index.html in any modern browser
open index.html
```
No npm, no build step, no server required.

### Option 2 — GitHub Pages (Recommended)
See [Deployment](#-deployment) section below.

---

## 📁 Folder Structure

```
babylog/
│
├── index.html              # Single-page app shell + all modals
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline support)
├── LICENSE                 # MIT License
├── README.md               # This file
│
├── css/
│   └── style.css           # Complete stylesheet (dark/light mode)
│
├── js/
│   ├── utils.js            # Pure utility functions (dates, formatting)
│   ├── storage.js          # LocalStorage CRUD layer
│   ├── statistics.js       # Stats engine — all calculations
│   ├── charts.js           # Chart.js renderers (10 chart types)
│   ├── reminders.js        # Reminder engine + bell UI
│   ├── sample-data.js      # Realistic sample records for all modules
│   ├── export.js           # CSV, Excel, PDF, JSON, Print export
│   ├── import.js           # CSV, Excel, JSON import with validation
│   └── app.js              # Master controller — routing, CRUD, UI
│
├── icons/                  # PWA icons (generate with realfavicongenerator.net)
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
│
└── assets/
    └── screenshot-dashboard.png   # Screenshot placeholder
```

---

## 🌐 Deployment

### GitHub Pages (Free Hosting)

1. **Fork or create** a new GitHub repository

2. **Upload all files** maintaining the folder structure above

3. **Enable GitHub Pages:**
   - Go to your repo → **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` (or `master`) → `/ (root)`
   - Click **Save**

4. **Access your app** at:
   ```
   https://YOUR_USERNAME.github.io/REPO_NAME/
   ```

5. **Install as PWA** by opening in Chrome/Safari on mobile and tapping "Add to Home Screen"

> ⚠️ **Important:** GitHub Pages requires HTTPS, which is needed for the Service Worker to function. GitHub Pages provides HTTPS automatically.

### Custom Domain (Optional)
Add a `CNAME` file to your repo root containing your domain:
```
babylog.yourdomain.com
```

---

## 📖 How to Use

### First Launch
1. Go to **Settings** and enter your baby's name and birthday
2. Set the default feeding interval (typically 2–3 hours for newborns)
3. Optionally tap **Load Sample Data** to explore all features with demo records

### Daily Use
- **FAB button** (bottom-right `+`) → Quick add feeding, sleep, diaper, or temperature
- **Dashboard** shows today's summary and next feeding estimate
- **Bell icon** shows active reminders
- **Search bar** searches across all records instantly

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Alt + N` | New record (current section) |
| `Alt + D` | Go to Dashboard |
| `Escape` | Close modals / search / panels |

### Exporting Data
1. Go to **Export & Import** section
2. Choose format: Excel (full workbook), CSV (per module), PDF (report), or JSON (backup)
3. File downloads to your device automatically

### Restoring from Backup
1. Go to **Export & Import**
2. Under **Import Data** → Choose JSON File
3. Select your `.json` backup file — records merge without duplicating

---

## 🔒 Privacy

**All data is stored locally on your device.** BabyLog:
- ❌ Does NOT collect any data
- ❌ Does NOT send data to any server
- ❌ Does NOT require an account or login
- ❌ Does NOT use cookies or tracking
- ✅ Works 100% offline
- ✅ Your data never leaves your device (unless you export it yourself)

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| HTML5 | — | App structure |
| CSS3 | — | Styling, dark/light mode, animations |
| Vanilla JavaScript (ES6+) | — | All logic, no framework |
| Bootstrap | 5.3.2 | Grid, modals, utilities |
| Font Awesome | 6.5.0 | Icons |
| Chart.js | 4.4.0 | All analytics charts |
| SheetJS (XLSX) | 0.18.5 | Excel export & import |
| jsPDF | 2.5.1 | PDF report generation |
| LocalStorage | — | All data persistence |
| Service Worker | — | Offline support |

---

## 🗺️ Future Roadmap

### v1.1 — Cloud Sync
- [ ] Optional Firebase Realtime Database sync
- [ ] Multi-device support
- [ ] Family sharing (view-only link for grandparents)

### v1.2 — Enhanced Analytics
- [ ] WHO growth percentile charts
- [ ] Custom date range filters
- [ ] Email weekly summary report
- [ ] Feeding heatmap calendar

### v1.3 — Smart Features
- [ ] Push notifications for feeding reminders
- [ ] AI-powered pattern detection ("Baby usually sleeps 3h after 2pm feed")
- [ ] Integration with Apple Health / Google Fit

### v1.4 — Collaboration
- [ ] Caregiver mode (nanny/partner logging)
- [ ] Notes shared between caregivers
- [ ] Handoff log ("I last fed at 2pm, next due 4pm")

### v2.0 — Multi-Child
- [ ] Multiple baby profiles
- [ ] Quick switch between profiles
- [ ] Comparison charts

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Guidelines
- Keep it vanilla JS — no frameworks
- Maintain offline-first capability
- Test on mobile (iOS Safari + Android Chrome)
- Ensure accessibility (ARIA, keyboard nav)

---

## ⚠️ Medical Disclaimer

BabyLog is for **personal monitoring only** and is **NOT a medical tool**.

- Always consult your pediatrician for health concerns
- Fever alerts are informational only, not medical diagnoses
- Never delay seeking medical care based on app data

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for full text.

---

## 💜 Acknowledgements

Made with love for parents navigating the beautiful chaos of newborn life. Every feeding logged at 3am, every diaper counted, every milestone celebrated — you're doing amazing.

---

*BabyLog v1.0.0 — Deployable to GitHub Pages without any build process.*
