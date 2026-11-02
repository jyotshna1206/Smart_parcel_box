#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>

// ==================================================
// SMART PACKAGE LOCKER - ESP32 FIRMWARE v2.5.0
// ==================================================

// ================= WIFI SETTINGS =================

// Enter your actual Wi-Fi credentials locally.
// Do not share your Wi-Fi password.
const char *WIFI_SSID = "Karthika Selvaraj";
const char *WIFI_PASSWORD = "kutty@1821";

// Laptop backend IP address
const char *SERVER_BASE_URL = "http://192.168.146.102:5000";

// Enter the device token configured in backend .env
const char* DEVICE_TOKEN = "esp32_smart_locker_secure_token_982341";

    const char *FIRMWARE_VERSION = "v2.5.0";

// ================= PIN CONFIGURATION =================

const int PIN_SERVO = 18;
const int PIN_IR_SENSOR = 19;
const int PIN_VIBRATION = 21;
const int PIN_BUZZER = 22;

// ================= SENSOR SETTINGS =================

const bool VIBRATION_ACTIVE_HIGH = true;

// ================= SERVO SETTINGS =================

const int SERVO_LOCKED_ANGLE = 0;
const int SERVO_UNLOCKED_ANGLE = 90;

const unsigned long UNLOCK_DURATION_MS = 180000UL;

// ================= TIMING SETTINGS =================

const unsigned long HEARTBEAT_INTERVAL_MS = 10000UL;
const unsigned long SENSOR_INTERVAL_MS = 2000UL;
const unsigned long COMMAND_INTERVAL_MS = 2000UL;

const unsigned long WIFI_RETRY_INTERVAL_MS = 15000UL;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 30000UL;

const unsigned int BUZZER_FREQUENCY_HZ = 2000;
const unsigned long DEFAULT_BUZZER_DURATION_MS = 2000UL;

// ================= OBJECTS =================

Servo lockerServo;

// ================= VARIABLES =================

bool lockerUnlocked = false;

// Hardware configuration (synchronized with backend)
bool irActiveHigh = false;        // false = active_low (0: detected, 1: empty), true = active_high
bool vibrationEnabled = true;     // true = ON (monitor SW-420), false = OFF (ignore vibration)

bool sensorAlarmActive = false;
bool commandBuzzerActive = false;

bool wifiConnecting = false;

unsigned long unlockStartedAt = 0;

unsigned long buzzerStartedAt = 0;
unsigned long buzzerDuration = 0;

unsigned long lastHeartbeat = 0;
unsigned long lastSensorUpdate = 0;
unsigned long lastCommandCheck = 0;

unsigned long lastWiFiRetry = 0;
unsigned long wifiConnectStartedAt = 0;

int previousIR = -1;
int previousVibration = -1;

// ==================================================
// SENSOR FUNCTIONS
// ==================================================

int readIRSensor() { return digitalRead(PIN_IR_SENSOR); }

int readVibrationSensor() { return digitalRead(PIN_VIBRATION); }

bool isParcelDetected(int rawIr) {
  if (irActiveHigh) {
    return rawIr == HIGH;
  }
  return rawIr == LOW;
}

bool isVibrationDetected() {
  if (!vibrationEnabled) {
    return false;
  }

  int value = readVibrationSensor();

  if (VIBRATION_ACTIVE_HIGH) {
    return value == HIGH;
  }

  return value == LOW;
}

// ==================================================
// BUZZER CONTROL
// ==================================================

void updateBuzzerOutput() {
  static bool previousBuzzerState = false;

  bool currentBuzzerState = sensorAlarmActive || commandBuzzerActive;

  if (currentBuzzerState == previousBuzzerState) {
    return;
  }

  previousBuzzerState = currentBuzzerState;

  if (currentBuzzerState) {
    tone(PIN_BUZZER, BUZZER_FREQUENCY_HZ);
  } else {
    noTone(PIN_BUZZER);
  }
}

void startBuzzer(unsigned long duration) {
  if (duration == 0) {
    duration = DEFAULT_BUZZER_DURATION_MS;
  }

  if (duration > 15000UL) {
    duration = 15000UL;
  }

  buzzerDuration = duration;
  buzzerStartedAt = millis();

  commandBuzzerActive = true;

  updateBuzzerOutput();

  Serial.printf("[BUZZER] Command ON for %lu ms\n", duration);
}

void stopCommandBuzzer() {
  commandBuzzerActive = false;

  updateBuzzerOutput();

  Serial.println("[BUZZER] Command OFF");
}

void checkBuzzer() {
  if (commandBuzzerActive && millis() - buzzerStartedAt >= buzzerDuration) {
    stopCommandBuzzer();
  }
}

// ==================================================
// AUTOMATIC SENSOR ALARM
// ==================================================

// Forward declarations
void sendAutoLockUpdate();
void applyConfig(JsonObject cfg);

void checkSensorAlarm(int irValue, int vibrationValue) {
  // If vibration detection is turned OFF by owner, ignore and silence alarm
  if (!vibrationEnabled) {
    if (sensorAlarmActive) {
      sensorAlarmActive = false;
      updateBuzzerOutput();
    }
    return;
  }

  // Detect vibration tamper condition
  bool alarmCondition = (vibrationValue == 1);

  if (alarmCondition && !sensorAlarmActive) {
    sensorAlarmActive = true;

    Serial.println("[ALERT] Vibration sensor triggered!");
    Serial.println("[BUZZER] SENSOR ALARM ON");
  } else if (!alarmCondition && sensorAlarmActive) {
    sensorAlarmActive = false;

    Serial.println("[BUZZER] SENSOR ALARM OFF");
  }

  updateBuzzerOutput();
}

// ==================================================
// SERVO FUNCTIONS
// ==================================================

void lockLocker() {
  lockerServo.write(SERVO_LOCKED_ANGLE);

  lockerUnlocked = false;

  Serial.println("[LOCKER] Locked (0 degrees)");
}

void unlockLocker() {
  lockerServo.write(SERVO_UNLOCKED_ANGLE);

  lockerUnlocked = true;

  unlockStartedAt = millis();

  Serial.println("[LOCKER] Unlocked (90 degrees)");
  Serial.println("[LOCKER] Actuator holding open for exactly 180 seconds");
}

void checkAutoLock() {
  if (lockerUnlocked && millis() - unlockStartedAt >= UNLOCK_DURATION_MS) {
    Serial.println("[LOCKER] 180 seconds completed - Auto-locking servo to 0 degrees");

    lockLocker();

    sendAutoLockUpdate();
  }
}

// ==================================================
// TCP CONNECTION TEST
// ==================================================

bool testBackendConnection() {
  Serial.println();
  Serial.println("========== TCP CONNECTION TEST ==========");

  Serial.print("[TCP] WiFi Status: ");
  Serial.println(WiFi.status());

  Serial.print("[TCP] ESP32 IP: ");
  Serial.println(WiFi.localIP());

  Serial.print("[TCP] Gateway: ");
  Serial.println(WiFi.gatewayIP());

  Serial.print("[TCP] Subnet: ");
  Serial.println(WiFi.subnetMask());

  Serial.print("[TCP] Signal Strength: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");

  Serial.println("[TCP] Laptop IP: 192.168.146.102");
  Serial.println("[TCP] Port: 5000");
  Serial.println("[TCP] Connecting...");

  WiFiClient testClient;
  testClient.setTimeout(5000);

  IPAddress serverIP(192, 168, 146, 102);

  if (testClient.connect(serverIP, 5000)) {
    Serial.println("[TCP] SUCCESS!");
    Serial.println("[TCP] ESP32 successfully reached laptop!");

    testClient.stop();

    Serial.println("==========================================");
    return true;
  }

  Serial.println("[TCP] FAILED!");
  Serial.println("[TCP] ESP32 cannot reach laptop backend!");
  Serial.println("==========================================");

  return false;
}

// ==================================================
// WIFI CONNECTION
// ==================================================

void startWiFiConnection() {
  Serial.println("[WIFI] Starting connection...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  wifiConnecting = true;
  wifiConnectStartedAt = millis();
  lastWiFiRetry = millis();
}

void connectWiFi() {
  Serial.println();
  Serial.println("========== WIFI CONNECTION ==========");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  // Reconnection is managed manually below.
  WiFi.setAutoReconnect(false);

  Serial.print("[WIFI] SSID: ");
  Serial.println(WIFI_SSID);

  startWiFiConnection();

  while (wifiConnecting &&
         millis() - wifiConnectStartedAt < WIFI_CONNECT_TIMEOUT_MS) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnecting = false;
      break;
    }

    delay(500);

    Serial.print("[WIFI] Status: ");
    Serial.println(WiFi.status());
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnecting = false;

    Serial.println();
    Serial.println("[WIFI] CONNECTED!");

    Serial.print("[WIFI] ESP32 IP: ");
    Serial.println(WiFi.localIP());

    Serial.print("[WIFI] Gateway: ");
    Serial.println(WiFi.gatewayIP());

    Serial.print("[WIFI] Subnet: ");
    Serial.println(WiFi.subnetMask());

    Serial.print("[WIFI] Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    testBackendConnection();
  } else {
    wifiConnecting = false;
    lastWiFiRetry = millis();

    Serial.println();
    Serial.println("[WIFI] CONNECTION FAILED!");

    Serial.print("[WIFI] Final status: ");
    Serial.println(WiFi.status());

    Serial.println("[WIFI] Will retry after 15 seconds.");
  }

  Serial.println("=====================================");
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (wifiConnecting) {
      wifiConnecting = false;

      Serial.println("[WIFI] Connected!");

      Serial.print("[WIFI] ESP32 IP: ");
      Serial.println(WiFi.localIP());

      Serial.print("[WIFI] Signal: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");

      testBackendConnection();
    }

    return;
  }

  // If a connection attempt is already running, wait for it.
  if (wifiConnecting) {
    if (millis() - wifiConnectStartedAt < WIFI_CONNECT_TIMEOUT_MS) {
      return;
    }

    Serial.println("[WIFI] Connection attempt timed out.");

    WiFi.disconnect();

    wifiConnecting = false;
    lastWiFiRetry = millis();

    Serial.println("[WIFI] Waiting 15 seconds before retry.");
    return;
  }

  // Do not start another attempt before the retry interval.
  if (millis() - lastWiFiRetry < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  Serial.println("[WIFI] Disconnected. Starting a new connection attempt...");

  startWiFiConnection();
}

// ==================================================
// HTTP POST FUNCTION
// ==================================================

int postJson(const char *endpoint, const String &payload, String *responseOut = nullptr) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Wi-Fi disconnected");
    return -1;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String(SERVER_BASE_URL) + endpoint;

  client.setTimeout(5000);

  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  Serial.println();
  Serial.println("[HTTP] Connecting to: " + url);
  Serial.println("[HTTP] Payload: " + payload);

  if (!http.begin(client, url)) {
    Serial.println("[HTTP] Initialization failed");
    return -1;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  int httpCode = http.POST(payload);

  Serial.printf("[HTTP] POST %s : %d\n", endpoint, httpCode);

  if (httpCode > 0) {
    String response = http.getString();

    Serial.println("[HTTP] Server response:");
    Serial.println(response);

    if (responseOut != nullptr) {
      *responseOut = response;
    }
  } else {
    Serial.print("[HTTP] Error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();

  return httpCode;
}

// ==================================================
// HARDWARE CONFIGURATION SYNC
// ==================================================

void applyConfig(JsonObject cfg) {
  if (cfg.containsKey("irPolarity")) {
    String pol = cfg["irPolarity"].as<String>();
    irActiveHigh = (pol == "active_high");
    Serial.printf("[CONFIG] IR sensor polarity set: %s (%s)\n",
                  pol.c_str(), irActiveHigh ? "Active HIGH" : "Active LOW");
  }

  if (cfg.containsKey("vibrationEnabled")) {
    vibrationEnabled = cfg["vibrationEnabled"].as<bool>();
    Serial.printf("[CONFIG] Vibration detection switch set: %s\n",
                  vibrationEnabled ? "ON" : "OFF");

    if (!vibrationEnabled && sensorAlarmActive) {
      sensorAlarmActive = false;
      updateBuzzerOutput();
    }
  }
}

// ==================================================
// HEARTBEAT
// ==================================================

void sendHeartbeat() {
  StaticJsonDocument<256> doc;

  doc["firmware"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = millis();
  doc["ip"] = WiFi.localIP().toString();

  String payload;
  serializeJson(doc, payload);

  String responseBody;
  int code = postJson("/api/device/heartbeat", payload, &responseBody);

  if (code == 200 && responseBody.length() > 0) {
    StaticJsonDocument<512> respDoc;
    if (!deserializeJson(respDoc, responseBody)) {
      if (respDoc.containsKey("config")) {
        applyConfig(respDoc["config"].as<JsonObject>());
      }
    }
  }
}

// ==================================================
// SENSOR UPDATE
// ==================================================

void sendSensorUpdate() {
  StaticJsonDocument<256> doc;

  int rawIr = readIRSensor();
  bool vibDetected = isVibrationDetected();
  int rawVib = readVibrationSensor();

  doc["ir_raw"] = rawIr;
  doc["parcel_detected"] = isParcelDetected(rawIr);
  doc["vibration"] = vibDetected ? 1 : 0;
  doc["vibration_raw"] = rawVib;

  String payload;
  serializeJson(doc, payload);

  String responseBody;
  int code = postJson("/api/device/sensor-update", payload, &responseBody);

  if (code == 200 && responseBody.length() > 0) {
    StaticJsonDocument<512> respDoc;
    if (!deserializeJson(respDoc, responseBody)) {
      if (respDoc.containsKey("config")) {
        applyConfig(respDoc["config"].as<JsonObject>());
      }
    }
  }
}

// ==================================================
// SENSOR MONITORING
// ==================================================

void monitorSensors() {
  int currentIR = readIRSensor();
  int currentVibration = isVibrationDetected() ? 1 : 0;

  checkSensorAlarm(currentIR, currentVibration);

  bool sensorChanged =
      currentIR != previousIR || currentVibration != previousVibration;

  if (sensorChanged || millis() - lastSensorUpdate >= SENSOR_INTERVAL_MS) {
    previousIR = currentIR;
    previousVibration = currentVibration;

    lastSensorUpdate = millis();

    Serial.printf("[SENSOR] IR Raw: %d (Detected: %s) | Vibration Raw: %d (Active: %s | Monitored: %s)\n",
                  currentIR,
                  isParcelDetected(currentIR) ? "YES" : "NO",
                  readVibrationSensor(),
                  currentVibration ? "YES" : "NO",
                  vibrationEnabled ? "ON" : "OFF");

    if (WiFi.status() == WL_CONNECTED) {
      sendSensorUpdate();
    }
  }
}

// ==================================================
// COMMAND RESULT
// ==================================================

void sendCommandResult(const String &commandId, const String &status,
                       const String &error, int angle) {
  StaticJsonDocument<256> doc;

  doc["commandId"] = commandId;
  doc["status"] = status;
  doc["error"] = error;
  doc["angle"] = angle;

  String payload;
  serializeJson(doc, payload);

  postJson("/api/device/command-result", payload);
}

// Notify backend when 180s timer automatically closes the locker
void sendAutoLockUpdate() {
  StaticJsonDocument<128> doc;

  doc["commandId"] = "auto_lock";
  doc["status"] = "executed";
  doc["angle"] = SERVO_LOCKED_ANGLE;

  String payload;
  serializeJson(doc, payload);

  postJson("/api/device/command-result", payload);
}

// ==================================================
// COMMAND ID & TYPE HELPERS
// ==================================================

String getCommandId(JsonObject obj) {
  if (obj.containsKey("commandId")) {
    return obj["commandId"].as<String>();
  }

  if (obj.containsKey("id")) {
    return obj["id"].as<String>();
  }

  return "";
}

String getCommandType(JsonObject obj) {
  if (obj.containsKey("command")) {
    return obj["command"].as<String>();
  }

  if (obj.containsKey("type")) {
    return obj["type"].as<String>();
  }

  if (obj.containsKey("action")) {
    return obj["action"].as<String>();
  }

  return "";
}

// ==================================================
// PROCESS COMMAND
// ==================================================

void processCommand(JsonObject command) {
  String commandId = getCommandId(command);
  String commandType = getCommandType(command);
  commandType.toUpperCase();

  Serial.println("[COMMAND] Received: " + commandType + " (ID: " + commandId + ")");

  if (commandType == "UNLOCK") {
    // Rotate servo to 90 degrees and hold for 180 seconds
    unlockLocker();

    // Confirm execution to backend so dashboard updates to UNLOCKED
    sendCommandResult(commandId, "executed", "", SERVO_UNLOCKED_ANGLE);
  } else if (commandType == "LOCK") {
    // Rotate servo to 0 degrees
    lockLocker();

    sendCommandResult(commandId, "executed", "", SERVO_LOCKED_ANGLE);
  } else if (commandType == "CONFIG") {
    // Hardware configuration settings from owner dashboard
    if (command.containsKey("parameters")) {
      JsonObject params = command["parameters"].as<JsonObject>();
      applyConfig(params);
    }

    sendCommandResult(commandId, "executed", "",
                      lockerUnlocked ? SERVO_UNLOCKED_ANGLE : SERVO_LOCKED_ANGLE);
  } else if (commandType == "BUZZER") {
    unsigned long duration = DEFAULT_BUZZER_DURATION_MS;

    if (command.containsKey("durationMs")) {
      duration = command["durationMs"].as<unsigned long>();
    } else if (command.containsKey("duration")) {
      duration = command["duration"].as<unsigned long>();
    } else if (command.containsKey("parameters") && command["parameters"].containsKey("durationMs")) {
      duration = command["parameters"]["durationMs"].as<unsigned long>();
    }

    startBuzzer(duration);

    sendCommandResult(commandId, "executed", "",
                      lockerUnlocked ? SERVO_UNLOCKED_ANGLE : SERVO_LOCKED_ANGLE);
  } else {
    Serial.println("[COMMAND] Unknown command: " + commandType);

    sendCommandResult(commandId, "failed", "Unknown command",
                      lockerUnlocked ? SERVO_UNLOCKED_ANGLE : SERVO_LOCKED_ANGLE);
  }
}

// ==================================================
// COMMAND POLLING
// ==================================================

void checkCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String(SERVER_BASE_URL) + "/api/device/commands";

  client.setTimeout(5000);
  http.setConnectTimeout(5000);
  http.setTimeout(5000);

  if (!http.begin(client, url)) {
    Serial.println("[COMMAND] Initialization failed");
    return;
  }

  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();

    Serial.println("[COMMAND] Server response:");
    Serial.println(response);

    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      // Synchronize latest configuration if returned
      if (doc.containsKey("config")) {
        applyConfig(doc["config"].as<JsonObject>());
      }

      if (doc["commands"].is<JsonArray>()) {
        JsonArray commands = doc["commands"].as<JsonArray>();

        for (JsonObject command : commands) {
          processCommand(command);
        }
      } else if (doc["command"].is<JsonObject>()) {
        JsonObject command = doc["command"].as<JsonObject>();

        processCommand(command);
      } else if (doc["type"].is<const char *>() ||
                 doc["action"].is<const char *>()) {
        processCommand(doc.as<JsonObject>());
      }
    } else {
      Serial.print("[COMMAND] JSON error: ");
      Serial.println(error.c_str());
    }
  } else if (httpCode < 0) {
    Serial.printf("[COMMAND] HTTP error: %d - %s\n", httpCode,
                  http.errorToString(httpCode).c_str());
  } else {
    Serial.printf("[COMMAND] Server HTTP status: %d\n", httpCode);
    Serial.println(http.getString());
  }

  http.end();
}

// ==================================================
// SETUP
// ==================================================

void setup() {
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("======================================");
  Serial.println("       SMART PACKAGE LOCKER ESP32");
  Serial.println("             FIRMWARE v2.5.0");
  Serial.println("======================================");

  pinMode(PIN_IR_SENSOR, INPUT);
  pinMode(PIN_VIBRATION, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  noTone(PIN_BUZZER);

  lockerServo.setPeriodHertz(50);

  lockerServo.attach(PIN_SERVO, 500, 2400);

  lockLocker();

  connectWiFi();

  previousIR = readIRSensor();

  previousVibration = isVibrationDetected() ? 1 : 0;

  if (WiFi.status() == WL_CONNECTED) {
    sendHeartbeat();
    sendSensorUpdate();
  }

  Serial.println();
  Serial.println("[SYSTEM] Ready");
  Serial.println("[SYSTEM] Monitoring sensors...");
}

// ==================================================
// MAIN LOOP
// ==================================================

void loop() {
  maintainWiFi();

  checkAutoLock();

  checkBuzzer();

  monitorSensors();

  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = millis();
      sendHeartbeat();
    }

    if (millis() - lastCommandCheck >= COMMAND_INTERVAL_MS) {
      lastCommandCheck = millis();
      checkCommands();
    }
  }
}
