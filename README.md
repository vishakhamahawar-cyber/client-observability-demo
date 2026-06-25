
# Client Observability — Vonage Video API Web Sample

A web application that demonstrates the full **Client Observability** feature of the Vonage Video API. Two participants join a routed video session and the app displays live telemetry for both — audio and video transport stats, network condition scoring, sender-side downlink estimation, and degradation source attribution.

| | |
|---|---|
| **SDK** | Vonage Video API JS SDK 2.33+ |
| **Platform** | Web — Vanilla JavaScript |
| **Session Type** | Routed (Vonage Media Router required) |

---

## Prerequisites

- A [Vonage Video API](https://developer.vonage.com/en/video/overview) account
- An **Application ID**, **Session ID**, and **Token** from the [Vonage Dashboard](https://dashboard.nexmo.com)
- Node.js installed

---

## Project Structure

```
Client-Observability/
├── index.html        — Two-column UI, all styles inline
├── js/
│   ├── app.js        — Session logic, stats polling, event handlers, DOM rendering
│   └── config.js     — Credentials (Application ID, Session ID, Token)
├── package.json
└── README.md
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/vishakhamahawar-cyber/client-observability-demo.git
cd client-observability-demo
```

### 2. Add your credentials

Open `js/config.js` and fill in your values:

```js
var APPLICATION_ID = 'YOUR_APPLICATION_ID';
var SESSION_ID     = 'YOUR_SESSION_ID';
var TOKEN          = 'YOUR_TOKEN';
```

Get these from the [Vonage Dashboard](https://dashboard.nexmo.com).

If you have a backend server, leave the above empty and set `SAMPLE_SERVER_BASE_URL` to your server URL instead. The app will call `GET /session` to fetch credentials automatically.

### 3. Install dependencies

```bash
npm install
```

### 4. Run

```bash
npm start
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Testing

1. Open the app in **two browser tabs** or two different browsers
2. Both tabs connect to the same session
3. Stats start populating within 1–2 seconds of both clients joining
4. To simulate a degraded network — Chrome DevTools → Network tab → set throttling to **Slow 3G** and watch the Network Condition score update in real time

---

## What It Shows

### Publisher

| Section | Stat | Description |
|---|---|---|
| Audio | Packets Sent | Total RTP audio packets sent since session start |
| Audio | Packets Lost | Total audio packets lost in transit |
| Audio | Bytes Sent | Total audio bytes sent |
| Video | Packets Sent | Total RTP video packets sent |
| Video | Packets Lost | Total video packets lost in transit |
| Video | Bytes Sent | Total video bytes sent |
| Video | Frame Rate | Publisher-side encoding frame rate |
| Network Condition | Est. Bandwidth | Estimated uplink bandwidth (bps) |
| Network Condition | Network Condition | Uplink health: Excellent / Good / Fair / Warning / Critical |
| Network Condition | Condition Reason | Root cause: None / Bandwidth / Packet loss |

### Subscriber

| Section | Stat | Description |
|---|---|---|
| Audio | Packets Received | Total RTP audio packets received |
| Audio | Packets Lost | Total audio packets lost on the downlink |
| Audio | Bytes Received | Total audio bytes received |
| Video | Packets Received | Total RTP video packets received |
| Video | Packets Lost | Total video packets lost on the downlink |
| Video | Bytes Received | Total video bytes received |
| Video | Decoded Resolution | Actual rendered frame size (width × height) |
| Video | Decoded FPS | Frame rate produced by the decoder |
| Video | Frame Rate | Received frame rate |
| Video | Bitrate | Current received video bitrate — payload only |
| Video | Total Bitrate | Current received video bitrate including overhead |
| Video | Codec | Active codec: VP8, VP9, H264, AV1 |
| Video | Freeze Count | Number of video freezes (interruptions under 5 seconds) |
| Video | Freeze Duration | Total cumulative duration of all freezes |
| Video | Pause Count | Number of video pauses (interruptions over 5 seconds) |
| Video | Pause Duration | Total cumulative duration of all pauses |
| Sender-Side | Est. Bandwidth | Publisher's estimated uplink bandwidth |
| Sender-Side | Network Condition | Publisher's uplink health as seen from the subscriber |
| Sender-Side | Condition Reason | Root cause of publisher-side condition |
| Network Condition | Est. Bandwidth | Subscriber's local downlink bandwidth estimate |
| Network Condition | Network Condition | Subscriber's local downlink health score |
| Network Condition | Condition Reason | Root cause of subscriber-side condition |
| Network Condition | Degradation Source | Which side is causing quality issues: None / Local / Remote / Both |

---

## Network Condition Score

| Score | Description | Audio Fallback |
|---|---|---|
| Excellent | Optimal — bandwidth accommodates max bitrate | None |
| Good | Minor or temporary issues may occur | None |
| Fair | Video quality may be restricted by the sender | None |
| Warning | Poor — audio fallback warning triggered | Warning |
| Critical | Severe — SDK disables video if audio fallback is enabled | Critical |

---

## How It Works

### Publisher initialisation — required flags

```js
const publisherOptions = {
  publishSenderStats:   true,  // enables sender-side stats on all subscribers
  audioFallbackEnabled: true,  // PAF — improves network condition score accuracy
};
```

### Subscriber initialisation — required flags

```js
const subscriberOptions = {
  audioFallbackEnabled: true,  // SAF — improves network condition score accuracy
};
```

### Stats polling — every 1 second

```js
publisher.getStats((error, statsArray) => {
  const stats = statsArray[0].stats;
  // stats.audio / stats.video / stats.mediaLink
});

subscriber.getStats((error, stats) => {
  // stats.audio / stats.video / stats.mediaLink
});
```

### Network condition events — fire immediately on change

```js
publisher.on('networkConditionChanged', ({ reason, statsContainer }) => {
  const transport = statsContainer?.mediaLink?.transport;
  // transport.networkCondition
  // transport.networkConditionReason
});

subscriber.on('networkConditionChanged', ({ reason, statsContainer }) => {
  const ml = statsContainer?.mediaLink;
  // ml.transport.networkCondition
  // ml.remotePublisherTransport.networkCondition
  // ml.networkDegradationSource
});
```

---

## SDK Property Reference

Confirmed correct property names as returned by the JS SDK. These differ from what the documentation sometimes suggests.

| Property | Correct | Do Not Use |
|---|---|---|
| Subscriber decoded resolution | `video.width` / `video.height` | `video.decodedWidth` / `video.decodedHeight` |
| Freeze duration | `video.totalFreezesDuration` | `video.totalFreezesDurationMs` |
| Pause duration | `video.totalPausesDuration` | `video.totalPausesDurationMs` |
| Transport bandwidth | `transport.connectionEstimatedBandwidth` | `transport.estimatedAvailableBandwidth` |
| Sender-side stats | `mediaLink.remotePublisherTransport` | `stats.senderStats` — deprecated |
| Network condition event payload | `statsContainer.mediaLink` | `statsContainer.stats.mediaLink` |

---

## Notes

- Sender-side stats require a **routed session**. Not available in P2P or relayed sessions.
- `stats.senderStats` on the subscriber is deprecated — this demo uses `mediaLink.remotePublisherTransport` instead.
- Network condition values are returned in **lowercase** by the SDK — `'excellent'`, `'good'`, `'fair'`, `'warning'`, `'critical'`.
- Audio level is not exposed in the JS SDK for publisher or subscriber stats.
- Stats take a few seconds to populate after both clients join.

---

## Resources

- [Client Observability Guide](https://developer.vonage.com/en/video/guides/client-observability/client-observability)
- [Vonage Video API Docs](https://developer.vonage.com/en/video/overview)
- [Video API Web Samples](https://github.com/Vonage-Community/video-api-web-samples)
