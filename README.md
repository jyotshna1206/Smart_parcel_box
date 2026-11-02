# Smart Package Locker — Commercial IoT Security Platform

A modern, professional IoT-based Smart Package Locker platform featuring **ESP32 microcontroller integration, physical servo actuator latching, optical IR package presence detection, SW-420 anti-tampering shock alerts, audible piezoelectric buzzer control, and single-use temporary delivery PINs** via shareable links and permanent QR codes.

Built with **React, Vite, Tailwind CSS, Node.js, Express, and native SQLite (WAL mode)**.

---

## 🏛️ System Architecture

```
                                 ┌──────────────────────────────────────┐
                                 │       React + Vite Frontend          │
                                 │  - Navy Blue / White / Light Grey    │
                                 │  - Owner Portal (Protected)          │
                                 │  - Courier Portal (/delivery-access) │
                                 └──────────────────┬───────────────────┘
                                                    │ REST API
                                                    │ (JWT Token / Public)
                                                    ▼
                                 ┌──────────────────────────────────────┐
                                 │      Node.js + Express Backend       │
                                 │  - SQLite Database (Node 24 Native)  │
                                 │  - Bcrypt Password Hashing           │
                                 │  - Single-Use Hash-Verified PINs     │
                                 │  - Actuator Command Pipeline         │
                                 │  - State Transitions & 2h Reminder   │
                                 └──────────────────▲───────────────────┘
                                                    │
                                                    │ HTTP Polling / Heartbeat
                                                    │ X-Device-Token Auth
                                                    │
                                 ┌──────────────────┴───────────────────┐
                                 │       ESP32 Microcontroller          │
                                 │  - DevKit V1 / ESP32-WROOM-32        │
                                 │  - Non-blocking millis() Timers      │
                                 │  - IR Sensor (GPIO 19)               │
                                 │  - Vibration Sensor (GPIO 21)        │
                                 │  - Servo Motor (GPIO 18)             │
                                 │  - Buzzer (GPIO 22)                  │
                                 └──────────────────────────────────────┘
```

---

## 📁 Project Structure

```
Smart Package Locker/
├── backend/
│   ├── database/
│   │   ├── db.js             # SQLite schema, tables, transactions & initialization
│   │   └── init-db.js        # Initial owner account seeding & provisioning
│   ├── middleware/
│   │   ├── auth.js           # JWT verification for protected owner portal APIs
│   │   ├── deviceAuth.js     # ESP32 hardware token authentication
│   │   └── rateLimiter.js    # Brute-force protection & lockout for PIN/login
│   ├── routes/
│   │   ├── accessRoutes.js   # Owner temporary 6-digit PIN management
│   │   ├── authRoutes.js     # Owner login, session me & logout
│   │   ├── dashboardRoutes.js# Real-time hardware telemetry consolidation
│   │   ├── deviceRoutes.js   # ESP32 heartbeat, sensor updates & command execution
│   │   ├── historyRoutes.js  # Filterable, paginated activity audit logs
│   │   ├── lockerRoutes.js   # Physical actuator lock/unlock command dispatcher
│   │   ├── ownerRoutes.js    # Owner profile & bcrypt password updates
│   │   ├── parcelRoutes.js   # IR sensor status, polarity config & history
│   │   ├── publicRoutes.js   # Courier single-use PIN verification endpoint
│   │   ├── reminderRoutes.js # 2-hour pickup reminder tracking
│   │   └── securityRoutes.js # SW-420 tamper alerts & acknowledgement
│   ├── services/
│   │   ├── activityLogger.js # Centralized SQLite audit event logger
│   │   ├── deviceMonitor.js  # Heartbeat offline monitor (30s timeout)
│   │   └── reminderService.js# Background 2-hour uncollected parcel monitor
│   ├── .env.example          # Environment variable template
│   ├── .env                  # Development environment configuration
│   ├── package.json          # Backend dependencies
│   ├── server.js             # Express application entry point
│   └── test-flow.js          # Complete automated end-to-end integration test
├── esp32/
│   └── smart_package_locker.ino # Arduino C++ firmware for ESP32 DevKit V1
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── ConfirmationModal.jsx # Actuator action confirmation dialog
│   │   │   ├── StatCard.jsx          # Telemetry metric cards
│   │   │   ├── StatusBadge.jsx       # Color-coded status pills
│   │   │   └── Toast.jsx             # Notification alerts
│   │   └── layout/
│   │       ├── Layout.jsx            # Protected authenticated portal shell
│   │       ├── Sidebar.jsx           # Navy blue sidebar navigation
│   │       └── TopNavbar.jsx         # Live telemetry bar, reminders & clock
│   ├── context/
│   │   └── LockerContext.jsx         # Real-time state management & polling
│   ├── pages/
│   │   ├── AccountSettings.jsx       # Owner profile & password change
│   │   ├── ActivityHistory.jsx       # Searchable & filterable audit log
│   │   ├── Dashboard.jsx             # Central IoT locker telemetry console
│   │   ├── DeliveryAccess.jsx        # Public courier PIN entry page (no login)
│   │   ├── DeliveryQRLink.jsx        # QR code download/print & shareable link
│   │   ├── GeneratePIN.jsx           # Temporary 6-digit PIN generator
│   │   ├── LockerControl.jsx         # Physical lock/unlock servo actuator console
│   │   ├── Login.jsx                 # Secure owner admin authentication
│   │   ├── ParcelMonitoring.jsx      # IR sensor package presence monitoring
│   │   └── SecurityMonitoring.jsx    # SW-420 tampering & buzzer alarm console
│   ├── services/
│   │   └── api.js                    # REST API client connecting to backend
│   ├── App.jsx                       # React Router configuration
│   ├── index.css                     # Design tokens & styling
│   └── main.jsx                      # React mounting
├── index.html                        # Application HTML shell
├── package.json                      # Frontend scripts and dependencies
└── vite.config.js                    # Vite bundler configuration
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v24 recommended for native `node:sqlite`)
- **npm**: v9 or higher

---

### 2. Configure Backend & Database

The backend uses environment variables defined in `backend/.env`. A pre-configured `.env` is created automatically:

```ini
PORT=5000
JWT_SECRET=super_secret_jwt_key_smart_package_locker_2026_xyz987
DEVICE_AUTH_TOKEN=esp32_smart_locker_secure_token_982341
APP_BASE_URL=http://localhost:5173
INITIAL_OWNER_USERNAME=owner
INITIAL_OWNER_PASSWORD=Owner@Locker2026!
INITIAL_OWNER_NAME=Smart Locker Owner
INITIAL_OWNER_EMAIL=owner@smartlocker.internal
INITIAL_OWNER_PHONE=+91 98450 12345
PICKUP_REMINDER_MINUTES=120
HEARTBEAT_TIMEOUT_SECONDS=30
```

Initialize the SQLite database and seed the owner credentials:
```bash
npm run init-db
```

Output:
```
[DB] Created initial owner account with ID 1:
     Username: owner
     Password: [as configured in .env]
     Email:    owner@smartlocker.internal
[DB] Database setup and owner check complete.
```

---

### 3. Start the Backend Server

From the project root:
```bash
npm run server
```

The backend server starts on port `5000`:
- **Local API**: `http://localhost:5000`
- **Network Access**: Available to ESP32 on LAN at `http://<your-pc-ip>:5000`

---

### 4. Start the Frontend Application

Open a second terminal in the project root:
```bash
npm run dev
```

The Vite development server will start on `http://localhost:5173`.

---

## 🔐 Owner Account & Authentication

| Role | Username | Initial Password | Notes |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `owner` | `Owner@Locker2026!` | Configured in `backend/.env`. Change password anytime via **Account Settings**. |

- **No Guest / Demo Accounts**: Only authorized owners can log in.
- **Passwords Hashed with Bcrypt**: Passwords are never stored in plaintext and never exposed in API responses.
- **Session Management**: Authenticated with JWT tokens. Protected routes redirect unauthorized visitors to `/login`.

---

## 📦 Public Courier Delivery Access

Couriers access the dedicated delivery portal without needing an account or login:

1. **URL**: `http://<server-ip>:5173/delivery-access`
2. **Access Methods**:
   - **QR Code**: Scan the permanent physical QR code affixed to the locker.
   - **Shareable Link**: Click the link shared by the owner via SMS/WhatsApp/Delivery Notes.
3. **Workflow**:
   - Courier enters the single-use 6-digit PIN.
   - Backend atomically verifies the PIN hash, marks it as `used`, and queues an `UNLOCK` command for the ESP32.
   - The ESP32 rotates the servo motor to 90° (Unlocked) and confirms execution.
   - The webpage confirms unlocking and instructs the courier to deposit the parcel and close the door.
   - Single-use enforcement prevents reuse. Rate-limiting protects against brute-force attacks.

---

## 🔌 Hardware Setup & ESP32 Configuration

### Microcontroller
- **Target**: ESP32 DevKit V1 / ESP32-WROOM-32
- **Operating Voltage**: 3.3V Logic (5V VIN for servo)

### Pin Mapping

| Peripheral | ESP32 GPIO | Pin Type | Function |
| :--- | :---: | :--- | :--- |
| **Servo Motor (SG90 / MG996R)** | **GPIO 18** | PWM (50Hz) | Physical latch control: `0°` (Locked) to `90°` (Unlocked) |
| **IR Sensor (TCRT5000 / LM393)** | **GPIO 19** | Digital Input | Optical parcel presence detection in compartment |
| **Vibration Sensor (SW-420)** | **GPIO 21** | Digital Input | Anti-tampering / shock detection with debounce filter |
| **Active Buzzer** | **GPIO 22** | Digital Output | Audible alerts: `2s` delivery chime or `12s` tamper alarm |

### Wiring Diagram
```
ESP32 DevKit V1
  [GPIO 18] ──> Servo Motor Signal (Yellow/Orange)
  [GPIO 19] ──> IR Sensor Digital Out (DO)
  [GPIO 21] ──> SW-420 Vibration Sensor Digital Out (DO)
  [GPIO 22] ──> Active Buzzer Positive (+)
  [5V / VIN]──> Servo VCC (+5V), Buzzer VCC (+5V)
  [3.3V]    ──> IR Sensor VCC (3.3V), Vibration Sensor VCC (3.3V)
  [GND]     ──> Common Ground (All Peripherals)
```

### Arduino IDE Libraries
Install the following libraries via the Arduino Library Manager:
1. `ESP32Servo` by Kevin Harrington
2. `ArduinoJson` (v6.x or v7.x) by Benoit Blanchon

### Flashing the ESP32 Firmware
1. Open `esp32/smart_package_locker.ino` in the Arduino IDE.
2. Edit lines 37–46 to configure your network:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* SERVER_BASE_URL = "http://192.168.1.100:5000"; // Your PC's LAN IP
   const char* DEVICE_TOKEN = "esp32_smart_locker_secure_token_982341";
   ```
3. Select board **ESP32 Dev Module** and the correct COM port.
4. Click **Upload**.
5. Open Serial Monitor at **115200 baud** to view real-time connection status.

---

## 🧪 Automated End-to-End Integration Test

A test script is included to verify the complete backend, database, and hardware flow:

```bash
# Ensure the backend server is running in one terminal:
npm run server

# Run the test suite in a second terminal:
node backend/test-flow.js
```

The test validates:
- [x] Backend health endpoint
- [x] Owner login and JWT token issuance
- [x] Dashboard telemetry retrieval
- [x] ESP32 heartbeat keepalive (transitions status to ONLINE)
- [x] Temporary 6-digit PIN generation
- [x] Public courier PIN verification (without login)
- [x] Atomic single-use protection (duplicate PIN blocked)
- [x] ESP32 actuator command polling
- [x] Actuator execution result confirmation
- [x] IR sensor parcel detection, delivery event logging, and 2-hour reminder initiation
- [x] SW-420 vibration sensor tampering alert and buzzer command queueing
- [x] Owner alert acknowledgement
- [x] Activity history audit log generation

---

## 📱 Testing on Smartphone via Local Wi-Fi

1. Find your computer's local Wi-Fi IP address:
   - On Windows, run: `ipconfig` (Look for `IPv4 Address`, e.g. `192.168.1.100`).
2. Start the Vite frontend with the host flag so it listens on your LAN:
   ```bash
   npx vite --host
   ```
3. In the owner dashboard, navigate to **Delivery Access QR & Link**.
4. Click **Change Base URL** and enter `http://192.168.1.100:5173`.
5. Point your smartphone camera at the generated QR code to open `/delivery-access` directly on your mobile device.
6. Generate a 6-digit PIN in the owner dashboard and verify it on your phone to trigger the locker unlock sequence.
