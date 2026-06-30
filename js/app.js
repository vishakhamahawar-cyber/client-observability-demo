/* global OT APPLICATION_ID TOKEN SESSION_ID SAMPLE_SERVER_BASE_URL */

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let applicationId;
let sessionId;
let token;
let publisher;
let intervalIds = {};

// ─────────────────────────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────────────────────────

const publishVideoTrueBtn = document.querySelector('#publish-video-true');
const publishVideoFalseBtn = document.querySelector('#publish-video-false');

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely formats a value with an optional unit suffix.
 * Returns a greyed-out "—" if the value is null or undefined.
 */
function fmt(val, unit = '') {
  if (val === undefined || val === null) {
    return '<span style="color:#475569">—</span>';
  }
  return `${val}${unit}`;
}

/**
 * Formats a bits-per-second value into a human-readable string.
 * Returns "—" for negative values (e.g. -1 means not yet available).
 */
function fmtBps(val) {
  if (val === undefined || val === null || val < 0) {
    return '<span style="color:#475569">—</span>';
  }
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mbps`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} Kbps`;
  return `${val} bps`;
}

/**
 * Formats a duration in milliseconds into a readable string.
 * SDK returns totalFreezesDuration and totalPausesDuration in milliseconds.
 */
function fmtMs(val) {
  if (val === undefined || val === null) {
    return '<span style="color:#475569">—</span>';
  }
  if (val >= 1000) return `${(val / 1000).toFixed(2)} s`;
  return `${val} ms`;
}

/**
 * Returns a styled badge for network condition or degradation source values.
 * SDK returns all values in lowercase e.g. 'excellent', 'good', 'none'.
 * Capitalises the label for display.
 */
function badge(val) {
  if (!val) return '<span style="color:#475569">—</span>';
  const key = val.toLowerCase().replace(/[\s_]+/g, '-');
  const label = val.charAt(0).toUpperCase() + val.slice(1);
  return `<span class="badge badge-${key}">${label}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Builders
// ─────────────────────────────────────────────────────────────────────────────

/** Renders a single label → value row. */
function row(label, valueHtml) {
  return `<div class="stat-row">
  <span class="stat-label">${label}</span>
  <span class="stat-value">${valueHtml}</span>
  </div>`;
}

/** Renders a sub-section heading inside a stats column. */
function subHeading(text) {
  return `<div class="sub-heading">${text}</div>`;
}

/** Writes HTML into a DOM element by ID. */
function render(id, html) {
  const el = document.querySelector(`#${id}`);
  if (el) el.innerHTML = html;
}

/** Renders a "no data" placeholder into a DOM element by ID. */
function renderEmpty(id, msg = 'Waiting...') {
  render(id, `<p class="no-stats">${msg}</p>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition Banner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows or hides the alert banner above the stats panel.
 * Only visible when network condition is Warning or Critical.
 * SDK returns condition in lowercase — compare in lowercase.
 *
 * @param {string} bannerId - DOM id of the banner element
 * @param {string} condition - e.g. 'excellent', 'warning', 'critical'
 * @param {string} reason - e.g. 'bandwidth', 'packet loss', 'none'
 * @param {string} side - 'Publisher' or 'Subscriber'
 */
function updateConditionBanner(bannerId, condition, reason, side) {
  const banner = document.querySelector(`#${bannerId}`);
  if (!banner) return;

  const level = (condition || '').toLowerCase();

  if (level === 'warning' || level === 'critical') {
    const label = condition.charAt(0).toUpperCase() + condition.slice(1);
    const reasonText = reason && reason !== 'none' ? ` — ${reason}` : '';
    banner.textContent = `${side} network condition: ${label}${reasonText}`;
    banner.className = `condition-banner ${level}`;
  } else {
    banner.className = 'condition-banner';
    banner.textContent = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Publisher Stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a 1-second polling interval on publisher.getStats().
 * Dispatches results to the three publisher stat sections.
 */
function startPublisherStats(pub) {
  setInterval(() => {
    pub.getStats((error, statsArray) => {
      if (error) {
        console.error('[Publisher Stats]', error.message);
        return;
      }
      if (!statsArray || statsArray.length === 0) return;

      const stats = statsArray[0].stats;
      console.debug('[Publisher Raw Stats]', stats);

      renderPublisherAudio(stats.audio);
      renderPublisherVideo(stats.video);
      renderPublisherNetwork(stats.mediaLink);
    });
  }, 1000);
}

/**
 * Renders publisher audio stats into #pub-audio-stats.
 * Note: audioLevel is not available on publisher audio in the JS SDK.
 */
function renderPublisherAudio(audio) {
  if (!audio) { renderEmpty('pub-audio-stats', 'No audio stats'); return; }

  render('pub-audio-stats',
    row('Packets Sent', fmt(audio.packetsSent)) +
    row('Packets Lost', fmt(audio.packetsLost)) +
    row('Bytes Sent', fmt(audio.bytesSent))
  );
}

/**
 * Renders publisher video stats into #pub-video-stats.
 * SDK uses video.frameRate on the publisher side (not decodedFrameRate).
 */
function renderPublisherVideo(video) {
  if (!video) { renderEmpty('pub-video-stats', 'No video stats'); return; }

  render('pub-video-stats',
    row('Packets Sent', fmt(video.packetsSent)) +
    row('Packets Lost', fmt(video.packetsLost)) +
    row('Bytes Sent', fmt(video.bytesSent)) +
    row('Frame Rate', fmt(video.frameRate))
  );
}

/**
 * Renders publisher transport and network condition into #pub-network-stats.
 * Also updates the publisher condition banner.
 *
 * Confirmed SDK property names:
 * mediaLink.transport.connectionEstimatedBandwidth
 * mediaLink.transport.networkCondition → lowercase e.g. 'good'
 * mediaLink.transport.networkConditionReason → lowercase e.g. 'none'
 */
function renderPublisherNetwork(mediaLink) {
  if (!mediaLink || !mediaLink.transport) {
    renderEmpty('pub-network-stats', 'No transport stats');
    return;
  }

  const t = mediaLink.transport;

  render('pub-network-stats',
    row('Est. Bandwidth', fmtBps(t.connectionEstimatedBandwidth)) +
    row('Network Condition', badge(t.networkCondition)) +
    row('Condition Reason', fmt(t.networkConditionReason))
  );

  updateConditionBanner(
    'pub-condition-banner',
    t.networkCondition,
    t.networkConditionReason,
    'Publisher'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriber Stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a 1-second polling interval on subscriber.getStats().
 * Dispatches results to the four subscriber stat sections.
 * Stores the interval ID so it can be cleared when the stream ends.
 */
function startSubscriberStats(subscriber) {
  const intervalId = setInterval(() => {
    subscriber.getStats((error, stats) => {
      if (error) {
        console.error('[Subscriber Stats]', error.message);
        return;
      }

      console.debug('[Subscriber Raw Stats]', stats);

      renderSubscriberAudio(stats.audio);
      renderSubscriberVideo(stats.video);
      renderSubscriberSenderSide(stats.mediaLink);
      renderSubscriberNetwork(stats.mediaLink);
    });
  }, 1000);

  intervalIds[subscriber.streamId] = intervalId;
}

/**
 * Renders subscriber audio stats into #sub-audio-stats.
 * Note: audioLevel is not available on subscriber audio in the JS SDK.
 */
function renderSubscriberAudio(audio) {
  if (!audio) { renderEmpty('sub-audio-stats', 'No audio stats'); return; }

  render('sub-audio-stats',
    row('Packets Received', fmt(audio.packetsReceived)) +
    row('Packets Lost', fmt(audio.packetsLost)) +
    row('Bytes Received', fmt(audio.bytesReceived))
  );
}

/**
 * Renders subscriber video stats into #sub-video-stats.
 *
 * Confirmed correct SDK property names from console log:
 * video.width / video.height → decoded resolution (NOT decodedWidth/decodedHeight)
 * video.decodedFrameRate → decoded FPS
 * video.frameRate → received FPS
 * video.totalFreezesDuration → freeze duration in ms (NOT totalFreezesDurationMs)
 * video.totalPausesDuration → pause duration in ms (NOT totalPausesDurationMs)
 */
function renderSubscriberVideo(video) {
  if (!video) { renderEmpty('sub-video-stats', 'No video stats'); return; }

  render('sub-video-stats',
    row('Packets Received', fmt(video.packetsReceived)) +
    row('Packets Lost', fmt(video.packetsLost)) +
    row('Bytes Received', fmt(video.bytesReceived)) +
    row('Decoded Resolution', `${fmt(video.width)} × ${fmt(video.height)}`) +
    row('Decoded FPS', fmt(video.decodedFrameRate)) +
    row('Frame Rate', fmt(video.frameRate)) +
    row('Bitrate', fmtBps(video.bitrate)) +
    row('Total Bitrate', fmtBps(video.totalBitrate)) +
    row('Codec', fmt(video.codec)) +
    row('Freeze Count', fmt(video.freezeCount)) +
    row('Freeze Duration', fmtMs(video.totalFreezesDuration)) +
    row('Pause Count', fmt(video.pauseCount)) +
    row('Pause Duration', fmtMs(video.totalPausesDuration))
  );
}

/**
 * Renders sender-side (remote publisher transport) stats into #sub-sender-stats.
 * These reflect the publisher's uplink as estimated from the subscriber side.
 * Requires publishSenderStats: true on the publisher.
 *
 * Note: stats.senderStats is deprecated — using mediaLink.remotePublisherTransport instead.
 */
function renderSubscriberSenderSide(mediaLink) {
  if (!mediaLink || !mediaLink.remotePublisherTransport) {
    renderEmpty('sub-sender-stats', 'Enable publishSenderStats on publisher');
    return;
  }

  const rt = mediaLink.remotePublisherTransport;

  render('sub-sender-stats',
    row('Est. Bandwidth', fmtBps(rt.connectionEstimatedBandwidth)) +
    row('Network Condition', badge(rt.networkCondition)) +
    row('Condition Reason', fmt(rt.networkConditionReason))
  );
}

/**
 * Renders subscriber local transport and degradation source into #sub-network-stats.
 * Also updates the subscriber condition banner.
 *
 * Confirmed correct SDK property names:
 * mediaLink.transport.connectionEstimatedBandwidth
 * mediaLink.transport.networkCondition → lowercase
 * mediaLink.transport.networkConditionReason → lowercase
 * mediaLink.networkDegradationSource → lowercase e.g. 'none', 'local', 'remote'
 */
function renderSubscriberNetwork(mediaLink) {
  if (!mediaLink || !mediaLink.transport) {
    renderEmpty('sub-network-stats', 'No network stats');
    return;
  }

  const lt = mediaLink.transport;
  let html =
    row('Est. Bandwidth', fmtBps(lt.connectionEstimatedBandwidth)) +
    row('Network Condition', badge(lt.networkCondition)) +
    row('Condition Reason', fmt(lt.networkConditionReason));

  if (mediaLink.networkDegradationSource !== undefined) {
    html +=
      subHeading('Degradation Source') +
      row('Source', badge(mediaLink.networkDegradationSource || 'none'));
  }

  render('sub-network-stats', html);

  updateConditionBanner(
    'sub-condition-banner',
    lt.networkCondition,
    lt.networkConditionReason,
    'Subscriber'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Condition Changed Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches networkConditionChanged to the publisher.
 * Fires immediately on a significant condition change — complements polling.
 * Re-renders the publisher network section without waiting for the next poll.
 *
 * Note: statsContainer contains mediaLink directly, NOT statsContainer.stats.mediaLink.
 */
function attachPublisherNetworkEvents(pub) {
  pub.on('networkConditionChanged', ({ reason, statsContainer }) => {
    const mediaLink = statsContainer?.mediaLink;
    const transport = mediaLink?.transport;

    console.group('[Publisher] networkConditionChanged');
    console.log('Change Reason: ', reason);
    console.log('Network Condition: ', transport?.networkCondition);
    console.log('Condition Reason: ', transport?.networkConditionReason);
    console.groupEnd();

    renderPublisherNetwork(mediaLink);
  });
}

/**
 * Attaches networkConditionChanged to the subscriber.
 * Fires immediately on a significant condition change — complements polling.
 * Re-renders both sender-side and network sections without waiting for the next poll.
 *
 * Note: statsContainer contains mediaLink directly, NOT statsContainer.stats.mediaLink.
 */
function attachSubscriberNetworkEvents(subscriber) {
  // Docs confirm subscriber networkConditionChanged passes { reason, stats }
  // (NOT statsContainer). mediaLink is accessed via stats.mediaLink.
  // Ref: https://developer.vonage.com/en/video/guides/client-observability/javascript#receiving-network-condition-events-on-the-subscribers
  subscriber.on('networkConditionChanged', ({ reason, stats }) => {
    const ml = stats?.mediaLink;

    console.group('[Subscriber] networkConditionChanged');
    console.log('Change Reason: ', reason);
    console.log('Local Condition: ', ml?.transport?.networkCondition);
    console.log('Remote Condition: ', ml?.remotePublisherTransport?.networkCondition);
    console.log('Degradation Source: ', ml?.networkDegradationSource);
    console.groupEnd();

    renderSubscriberSenderSide(ml);
    renderSubscriberNetwork(ml);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CPU Performance Changed Event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches cpuPerformanceChanged to the Session object.
 *
 * Fired when the CPU performance state changes. Only dispatched on
 * Chromium-based browsers (Chrome 125+, Edge 125+, Opera 111+).
 * Events pause after session disconnect and resume on reconnect.
 *
 * Possible cpuPerformanceState values (W3C Compute Pressure spec):
 *   "nominal"  — CPU is operating normally, no throttling
 *   "fair"     — CPU is under moderate load
 *   "serious"  — CPU is under heavy load; quality may degrade
 *   "critical" — CPU is critically overloaded; immediate action recommended
 *
 * Renders the current state into #cpu-stats and updates the CPU banner.
 *
 * @param {OT.Session} session - The active Vonage Video session
 */
function attachCpuPerformanceEvent(session) {
  // Event is dispatched by the Session object.
  // Callback receives the full event object — access state via event.cpuPerformanceState.
  // Only fires on Chromium browsers (Chrome 125+, Edge 125+, Opera 111+).
  // Ref: https://tokbox.com/developer/sdks/js/reference/CpuPerformanceChangedEvent.html
  session.on('cpuPerformanceChanged', (event) => {
    const state = event.cpuPerformanceState;

    console.group('[Session] cpuPerformanceChanged');
    console.log('CPU Performance State:', state);
    console.groupEnd();

    renderCpuPerformance(state);
    updateCpuBanner(state);
  });
}

/**
 * Renders the current CPU performance state into #cpu-stats.
 * Uses the shared badge() formatter — CSS classes badge-nominal,
 * badge-fair, badge-serious, badge-critical should be defined in your stylesheet.
 *
 * @param {string} state - e.g. 'nominal', 'fair', 'serious', 'critical'
 */
function renderCpuPerformance(state) {
  render('cpu-stats',
    row('CPU Performance State', badge(state))
  );
}

/**
 * Shows or hides the CPU alert banner.
 * Only visible when state is 'serious' or 'critical'.
 *
 * @param {string} state - e.g. 'nominal', 'fair', 'serious', 'critical'
 */
function updateCpuBanner(state) {
  const banner = document.querySelector('#cpu-condition-banner');
  if (!banner) return;

  const level = (state || '').toLowerCase();

  if (level === 'serious' || level === 'critical') {
    const label = state.charAt(0).toUpperCase() + state.slice(1);
    banner.textContent = `CPU performance: ${label} — video quality may be affected`;
    banner.className = `condition-banner ${level}`;
  } else {
    banner.className = 'condition-banner';
    banner.textContent = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Initialisation
// ─────────────────────────────────────────────────────────────────────────────

function initializeSession() {
  const session = OT.initSession(applicationId, sessionId);

  // ── CPU Performance ──
  // Must be attached before session.connect() so no early events are missed.
  // Only fires on Chromium browsers (Chrome 125+, Edge 125+, Opera 111+).
  attachCpuPerformanceEvent(session);

  // ── Stream created ──
  session.on('streamCreated', (event) => {
    const subscriber = session.subscribe(
      event.stream,
      'subscriber',
      {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        audioFallbackEnabled: true, // SAF — improves network condition score accuracy
      },
      handleError
    );

    startSubscriberStats(subscriber);
    attachSubscriberNetworkEvents(subscriber);

    // Mark subscriber status dot as active
    const dot = document.querySelector('#sub-status-dot');
    if (dot) dot.classList.add('active');
  });

  // ── Stream destroyed ──
  session.on('streamDestroyed', (event) => {
    clearInterval(intervalIds[event.stream.id]);
    delete intervalIds[event.stream.id];

    ['sub-audio-stats', 'sub-video-stats', 'sub-sender-stats', 'sub-network-stats']
      .forEach((id) => renderEmpty(id, 'Stream ended'));

    const banner = document.querySelector('#sub-condition-banner');
    if (banner) { banner.className = 'condition-banner'; banner.textContent = ''; }

    const dot = document.querySelector('#sub-status-dot');
    if (dot) dot.classList.remove('active');
  });

  // ── Session disconnected ──
  session.on('sessionDisconnected', (event) => {
    console.log('[Session] Disconnected:', event.reason);
  });

  // ── Publisher init ──
  const publisherOptions = {
    insertMode: 'append',
    width: '100%',
    height: '100%',
    resolution: '1280x720',
    publishSenderStats: true, // required for mediaLink.remotePublisherTransport on subscriber
    audioFallbackEnabled: true, // PAF — improves network condition score accuracy
  };

  publisher = OT.initPublisher('publisher', publisherOptions, (error) => {
    if (error) { handleError(error); return; }

    // Video is on by default — show Disable button immediately
    publishVideoTrueBtn.style.display = 'none';
    publishVideoFalseBtn.style.display = 'block';

    startPublisherStats(publisher);
    attachPublisherNetworkEvents(publisher);
  });

  publisher.on('accessDenied', (event) => { alert(event?.message); });

  // ── Connect then publish ──
  session.connect(token, (error) => {
    if (error) { handleError(error); }
    else { session.publish(publisher, handleError); }
  });

  // ── Video toggle controls ──
  publishVideoTrueBtn.addEventListener('click', () => {
    publisher.publishVideo(true, (error) => {
      if (error) { handleError(error); return; }
      publishVideoTrueBtn.style.display = 'none';
      publishVideoFalseBtn.style.display = 'block';
    });
  });

  publishVideoFalseBtn.addEventListener('click', () => {
    publisher.publishVideo(false, (error) => {
      if (error) { handleError(error); return; }
      publishVideoFalseBtn.style.display = 'none';
      publishVideoTrueBtn.style.display = 'block';
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function handleError(error) {
  if (error) console.error('[Vonage Error]', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

if (APPLICATION_ID && TOKEN && SESSION_ID) {
  applicationId = APPLICATION_ID;
  sessionId = SESSION_ID;
  token = TOKEN;
  initializeSession();

} else if (SAMPLE_SERVER_BASE_URL) {
  fetch(SAMPLE_SERVER_BASE_URL + '/session')
    .then((r) => r.json())
    .then((json) => {
      applicationId = json.applicationId;
      sessionId = json.sessionId;
      token = json.token;
      initializeSession();
    })
    .catch((error) => {
      handleError(error);
      alert('Failed to get Vonage Video sessionId and token. Make sure you have updated the config.js file.');
    });
}
