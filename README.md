 available from the [Vonage Dashboard](https://dashboard.nexmo.com)
- Node.js installed

---

## Project Structure

```
Client-Observability/
├── index.html
├── js/
│   ├── app.js
│   └── config.js
├── package.json
└── README.md
```

| File | Description |
|---|---|
| `index.html` | Two-column UI — publisher on the left, subscriber on the right. All styles are inline. |
| `js/app.js` | Session initialisation, stats polling, network condition events, DOM rendering |
| `js/config.js` | Credentials — Application ID, Session ID, Token |

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/client-observability-demo.git
cd client-observability-demo
```

**2. Add your credentials**

Open `js/config.js` and fill in your values:

```js
var APPLICATION_ID = 'YOUR_APPLICATION_ID';
var SESSION_ID     = 'YOUR_SESSION_ID';
var TOKEN          = 'YOUR_TOKEN';
```

If you have a backend server, leave the above empty and set `SAMPLE_SERVER_BASE_URL` instead. The app will call `GET /session` to fetch credentials automatically.

**3. Install dependencies**

```bash
npm install
```

**4. Start the app**

```bash
npm start
```


## What It Shows

### Publisher — Audio

| Stat | Description |
|---|---|
| Packets Sent | Total RTP audio packets sent since session start |
| Packets Lost | Total audio packets lost in transit |
| Bytes Sent | Total audio bytes sent |

### Publisher — Video

| Stat | Description |
|---|---|
| Packets Sent | Total RTP video packets sent |
| Packets Lost | Total video packets lost in transit |
| Bytes Sent | Total video bytes sent |
| Frame Rate | Publisher-side encoding frame rate |

### Publisher — Network Condition

| Stat | Description |
|---|---|
| Est. Bandwidth | Estimated uplink bandwidth available (bps) |
| Network Condition | Uplink health: Excellent / Good / Fair / Warning / Critical |
| Condition Reason | Root cause: None / Bandwidth / Packet loss |

---

### Subscriber — Audio

| Stat | Description |
|---|---|
| Packets Received | Total RTP audio packets received |
| Packets Lost | Total audio packets lost on the downlink |
| Bytes Received | Total audio bytes received |

### Subscriber — Video

| Stat | Description |
|---|---|
| Packets Received | Total RTP video packets received |
| Packets Lost | Total video packets lost on the downlink |
| Bytes Received | Total video bytes received |
| Decoded Resolution | Actual rendered frame size (width × height) |
| Decoded FPS | Frame rate produced by the decoder |
| Frame Rate | Received frame rate |
| Bitrate | Current received video bitrate — payload only |
| Total Bitrate | Current received video bitrate including overhead |
| Codec | Active video codec: VP8, VP9, H264, AV1 |
| Freeze Count | Number of video freezes (interruptions under 5 seconds) |
| Freeze Duration | Total cumulative duration of all freezes |
| Pause Count | Number of video pauses (interruptions over 5 seconds) |
| Pause Duration | Total cumulative duration of all pauses |

### Subscriber — Sender-Side Stats

Reflects the publisher's uplink as estimated from the subscriber side. Requires `publishSenderStats: true` on the publisher.

| Stat | Description |
|---|---|
| Est. Bandwidth | Publisher's estimated uplink bandwidth |
| Network Condition | Publisher's uplink health score |
| Condition Reason | Root cause of publisher-side condition |

### Subscriber — Network Condition

| Stat | Description |
|---|---|
| Est. Bandwidth | Subscriber's local downlink bandwidth estimate |
| Network Condition | Subscriber's local downlink health score |
| Condition Reason | Root cause of subscriber-side condition |
| Degradation Source | Which side is causing quality issues: None / Local / Remote / Both |

---

## Network Condition Score

| Score | Meaning | Audio Fallback State |
|---|---|---|
| Excellent | Optimal — bandwidth accommodates max bitrate | None |
| Good | Minor or temporary issues may occur | None |
| Fair | Video quality may be restricted by the sender | None |
| Warning | Poor quality — audio fallback warning triggered | Warning |
| Critical | Severe — SDK disables video if audio fallback is enabled | Critical |

---

## Key Implementation Details

### Enabling the Full Feature Set

```js
// Publisher
const publisherOptions = {
  publishSenderStats:   true,  // enables sender-side stats on all subscribers
  audioFallbackEnabled: true,  // PAF — improves network condition score accuracy
};

// Subscriber
const subscriberOptions = {
  audioFallbackEnabled: true,  // SAF — improves network condition score accuracy
};
```

### Stats Polling — every 1 second

```js
publisher.getStats((error, statsArray) => {
  const stats = statsArray[0].stats;
  // stats.audio / stats.video / stats.mediaLink
});

subscriber.getStats((error, stats) => {
  // stats.audio / stats.video / stats.mediaLink
});
```

### Network Condition Events — fires immediately on change

```js
publisher.on('networkConditionChanged', ({ reason, statsContainer }) => {
  const transport = statsContainer?.mediaLink?.transport;
  // transport.networkCondition / transport.networkConditionReason
});

subscriber.on('networkConditionChanged', ({ reason, statsContainer }) => {
  const ml = statsContainer?.mediaLink;
  // ml.transport / ml.remotePublisherTransport / ml.networkDegradationSource
});
```

---

## SDK Property Name Reference

These are the confirmed correct property names as returned by the JS SDK. Common mistakes are noted.

| Property | Correct Name | Common Mistake |
|---|---|---|
| Subscriber decoded resolution | `video.width` / `video.height` | `video.decodedWidth` / `video.decodedHeight` |
| Freeze duration | `video.totalFreezesDuration` | `video.totalFreezesDurationMs` |
| Pause duration | `video.totalPausesDuration` | `video.totalPausesDurationMs` |
| Transport bandwidth | `transport.connectionEstimatedBandwidth` | `transport.estimatedAvailableBandwidth` |
| Sender-side stats | `mediaLink.remotePublisherTransport` | `stats.senderStats` (deprecated) |
| Network condition event data | `statsContainer.mediaLink` | `statsContainer.stats.mediaLink` |

---

## Resources

- [Client Observability Guide](https://developer.vonage.com/en/video/guides/client-observability/client-observability)
- [Vonage Video API Docs](https://developer.vonage.com/en/video/overview)
- [Video API Web Samples](https://github.com/Vonage-Community/video-api-web-samples)
