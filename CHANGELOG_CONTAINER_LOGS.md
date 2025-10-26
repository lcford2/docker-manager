# Container Logs Streaming Feature - Technical Documentation

## Overview

This document explains the implementation of real-time container log streaming functionality added to the Docker Manager application. The feature enables users to view and stream container logs in real-time through WebSocket connections, providing a terminal-like experience directly in the web interface.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Changes](#backend-changes)
3. [Frontend Changes](#frontend-changes)
4. [Communication Flow](#communication-flow)
5. [Design Decisions](#design-decisions)
6. [Performance Considerations](#performance-considerations)
7. [Error Handling](#error-handling)

---

## Architecture Overview

The container logs feature uses a bidirectional WebSocket communication pattern where:

- **Frontend** sends log requests with specific parameters (tail count, follow mode, timestamps, etc.)
- **Backend** streams logs from Docker daemon using the Bollard library
- **Real-time updates** are batched and sent to clients efficiently
- **Stream lifecycle** is managed with proper cleanup and cancellation

```mermaid
graph TB
    subgraph Frontend
        A[LogsViewer Component] -->|Sends Request| B[WebSocketContext]
        B -->|Receives Updates| A
    end

    subgraph Backend
        C[WebSocket Handler] -->|Parses Request| D[Broadcaster]
        D -->|Spawns Task| E[Log Stream Worker]
        E -->|Fetches Logs| F[Docker API/Bollard]
        F -->|Returns Logs| E
        E -->|Batches & Sends| D
        D -->|WebSocket Messages| C
    end

    B <-->|WebSocket Connection| C

    style A fill:#e1f5ff
    style E fill:#fff4e1
    style F fill:#f0f0f0
```

---

## Backend Changes

### 1. WebSocket Message Types (`backend/src/api/websocket/messages.rs`)

**New Message Structures:**

```rust
pub enum WebSocketMessage {
    // ... existing messages
    ContainerLogsRequest(ContainerLogsRequestData),
    ContainerLogs(ContainerLogsData),
    ContainerLogsEnd(ContainerLogsEndData),
    ContainerLogsError(ContainerLogsErrorData),
}
```

**Key Additions:**

- **`LogLine`**: Represents a single log line with stream type (stdout/stderr) and optional timestamp
- **`ContainerLogsRequestData`**: Client request with configurable parameters (tail, follow, timestamps, stdout/stderr filtering)
- **`ContainerLogsData`**: Batched log lines with `is_initial` flag to distinguish historical from streaming logs
- **`ContainerLogsEndData`**: Signals stream completion
- **`ContainerLogsErrorData`**: Communicates errors during log streaming

**Design Decision - Serde Defaults:**

```rust
fn default_tail() -> usize { 100 }
fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerLogsRequestData {
    #[serde(default = "default_tail")]
    pub tail: usize,
    #[serde(default)]
    pub follow: bool,
    #[serde(default = "default_true")]
    pub stdout: bool,
    // ...
}
```

**Rationale:** Default values ensure backward compatibility and sensible defaults when clients don't specify all parameters.

---

### 2. Broadcaster Enhancements (`backend/src/api/websocket/broadcaster.rs`)

**Active Stream Management:**

```rust
pub struct ActiveLogStream {
    pub container_id: String,
    pub cancel_tx: tokio::sync::oneshot::Sender<()>,
}

pub struct Broadcaster {
    clients: Arc<RwLock<HashMap<ClientId, mpsc::UnboundedSender<Message>>>>,
    next_client_id: Arc<RwLock<ClientId>>,
    active_log_streams: Arc<RwLock<HashMap<ClientId, ActiveLogStream>>>, // NEW
}
```

**Why Track Active Streams?**

1. **Resource Cleanup**: When a client disconnects, we need to cancel their log streaming task
2. **Single Stream Per Client**: Prevents resource leaks when clients request new logs before previous stream completes
3. **Graceful Cancellation**: Uses oneshot channels for cooperative task cancellation

**Stream Lifecycle:**

```mermaid
sequenceDiagram
    participant Client
    participant Broadcaster
    participant LogWorker
    participant Docker

    Client->>Broadcaster: start_log_stream()
    Broadcaster->>Broadcaster: Cancel existing stream (if any)
    Broadcaster->>Broadcaster: Create cancellation channel
    Broadcaster->>Broadcaster: Store ActiveLogStream
    Broadcaster->>LogWorker: Spawn async task

    LogWorker->>Docker: Request logs stream
    loop Streaming
        Docker->>LogWorker: Log chunk
        LogWorker->>LogWorker: Buffer logs (100ms/100 lines)
        LogWorker->>Client: Send batched logs
    end

    alt Stream Complete
        Docker->>LogWorker: Stream end
        LogWorker->>Client: ContainerLogsEnd
        LogWorker->>Broadcaster: Remove from active_log_streams
    else Client Disconnect
        Client->>Broadcaster: unsubscribe()
        Broadcaster->>LogWorker: Send cancellation signal
        LogWorker->>Broadcaster: Remove from active_log_streams
    end
```

**Core Streaming Logic:**

The `stream_logs` function implements a sophisticated state machine with three phases:

1. **Initial Load Phase**: Collects historical logs
2. **Timeout Detection**: Detects when historical logs are fully loaded (200ms silence)
3. **Streaming Phase**: Buffers and sends new logs as they arrive

**Constants & Their Rationale:**

```rust
const MAX_TAIL_LINES: usize = 5000;          // Prevent memory exhaustion
const STREAMING_BUFFER_MS: u64 = 100;        // Balance latency vs message overhead
const STREAMING_MAX_BATCH: usize = 100;      // Prevent single messages from being too large
```

**Dual-Mode Batching:**

```rust
// Time-based batching (every 100ms)
_ = interval.tick(), if !is_initial && request.follow && !buffer.is_empty() => {
    broadcaster.send_to_client(
        client_id,
        WebSocketMessage::ContainerLogs(ContainerLogsData {
            container_id: request.container_id.clone(),
            lines: buffer.drain(..).collect(),
            is_initial: false,
        }),
    ).await;
}

// Size-based batching (when buffer reaches 100 lines)
if buffer.len() >= STREAMING_MAX_BATCH {
    broadcaster.send_to_client(...).await;
}
```

**Why Both?**
- **Time-based**: Ensures low latency even with slow-logging containers
- **Size-based**: Prevents message size explosion during log bursts

**Timestamp Parsing:**

```rust
let (timestamp, clean_line) = if request.timestamps && line.len() > 30 {
    if let Some(space_idx) = line.find(' ') {
        let ts = line[..space_idx].to_string();
        let rest = line[space_idx + 1..].to_string();
        (Some(ts), rest)
    } else {
        (None, line)
    }
} else {
    (None, line)
};
```

Docker timestamp format: `2024-01-01T12:00:00.000000000Z message`

**Impact:** Separating timestamps from log content allows frontend to style them differently and enables cleaner log exports.

---

### 3. Handler Updates (`backend/src/api/websocket/handlers.rs`)

**State Change:**

```rust
// BEFORE
pub async fn ws_handler(
    State(broadcaster): State<Arc<Broadcaster>>,
) -> impl IntoResponse { ... }

// AFTER
pub async fn ws_handler(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse { ... }
```

**Why the Change?**

Log streaming requires access to `docker_client` (for fetching logs), which is only available in `AppState`. Previously, the WebSocket handler only needed the `Broadcaster`, but now it needs the full state.

**Message Handling:**

```rust
async fn handle_client_message(
    msg: axum::extract::ws::Message,
    client_id: usize,
    broadcaster: &Broadcaster,
    state: &Arc<AppState>,  // NEW parameter
) -> Result<(), String> {
    match msg {
        axum::extract::ws::Message::Text(text) => {
            let ws_msg: WebSocketMessage = serde_json::from_str(&text)?;
            match ws_msg {
                WebSocketMessage::Ping(_) => { /* ... */ }
                WebSocketMessage::ContainerLogsRequest(request) => {
                    // NEW handler
                    broadcaster.start_log_stream(client_id, request, state.clone()).await?;
                }
                _ => { /* ... */ }
            }
        }
        // ...
    }
}
```

---

### 4. Router State Change (`backend/src/api/websocket/mod.rs` & `backend/src/api.rs`)

```rust
// mod.rs - BEFORE
pub fn router() -> (Router<Arc<Broadcaster>>, Vec<RouteSpec>) { ... }

// mod.rs - AFTER
pub fn router() -> (Router<Arc<AppState>>, Vec<RouteSpec>) { ... }
```

```rust
// api.rs - BEFORE
let ws_router = ws_router.with_state(state.broadcaster.clone());

// api.rs - AFTER
let ws_router = ws_router.with_state(state.clone());
```

**Impact:** The WebSocket router now has access to the full `AppState`, enabling log streaming while maintaining access to the broadcaster for stats broadcasting.

---

## Frontend Changes

### 1. Type Definitions (`frontend/src/types/websocket.ts`)

**New Types:**

```typescript
export interface LogLine {
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp?: string;
}

export interface ContainerLogsRequestData {
  container_id: string;
  tail: number;
  follow: boolean;
  timestamps: boolean;
  stdout: boolean;
  stderr: boolean;
}

export interface ContainerLogsMessage extends WebSocketMessage {
  type: "container_logs";
  data: {
    container_id: string;
    lines: LogLine[];
    is_initial: boolean;
  };
}
```

**Type Safety:** These mirror the Rust backend types exactly, ensuring type safety across the full stack.

---

### 2. LogsViewer Component (`frontend/src/components/containers/LogsViewer.tsx`)

**Component Architecture:**

```mermaid
graph TD
    A[LogsViewer] --> B[Controls Sheet]
    A --> C[Error Alert]
    A --> D[Logs Display Sheet]

    B --> B1[Tail Selector]
    B --> B2[Follow Checkbox]
    B --> B3[Timestamps Checkbox]
    B --> B4[Stream Filter Buttons]
    B --> B5[Action Buttons]

    D --> D1[Loading Spinner]
    D --> D2[Empty State]
    D --> D3[Log Lines]
    D --> D4[Auto-scroll Anchor]

    style A fill:#e1f5ff
    style B fill:#f0f0f0
    style D fill:#1e1e1e,color:#fff
```

**Key Features:**

1. **Auto-scroll with User Override**

```typescript
// Detect if user has scrolled up
const handleScroll = useCallback(() => {
  if (logsContainerRef.current) {
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserScrolledUp(!isAtBottom);
  }
}, []);

// Auto-scroll to bottom when new logs arrive (if not scrolled up)
useEffect(() => {
  if (!userScrolledUp && logsEndRef.current) {
    logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }
}, [logs, userScrolledUp]);
```

**Why?** Users need the ability to scroll back through logs without being constantly jumped to the bottom, but new logs should auto-scroll when the user is already at the bottom (similar to `tail -f` behavior).

2. **Memory Management**

```typescript
const MAX_STORED_LOGS = 10000;

const addLogs = useCallback((newLines: LogLine[], isInitial: boolean) => {
  setLogs((prev) => {
    let updated = isInitial ? newLines : [...prev, ...newLines];

    // Trim to max size (keep most recent)
    if (updated.length > MAX_STORED_LOGS) {
      updated = updated.slice(updated.length - MAX_STORED_LOGS);
    }

    return updated;
  });
}, []);
```

**Impact:** Prevents browser memory exhaustion during long-running follow sessions.

3. **Stream Filtering**

```typescript
const filteredLogs = logs.filter((log) => {
  if (streamFilter === 'all') return true;
  return log.stream === streamFilter;
});
```

**Client-side vs Server-side Filtering:**

The implementation uses a hybrid approach:
- **Server-side**: Filters stdout/stderr at request time (reduces bandwidth)
- **Client-side**: Allows switching between all/stdout/stderr without re-requesting (better UX)

4. **WebSocket Subscription Management**

```typescript
useEffect(() => {
  const handleLogsMessage = (data: ContainerLogsMessage['data']) => {
    if (data.container_id === containerId) {
      addLogs(data.lines, data.is_initial);
      setLoading(false);
    }
  };

  const logsSubscription = subscribe('container_logs', handleLogsMessage);
  const endSubscription = subscribe('container_logs_end', handleLogsEnd);
  const errorSubscription = subscribe('container_logs_error', handleLogsError);

  return () => {
    unsubscribe(logsSubscription);
    unsubscribe(endSubscription);
    unsubscribe(errorSubscription);
  };
}, [containerId, subscribe, unsubscribe, addLogs]);
```

**Pattern:** Multiple subscriptions for different message types with proper cleanup to prevent memory leaks.

5. **Log Export**

```typescript
const handleDownload = () => {
  const logText = logs
    .map((log) => {
      const ts = log.timestamp ? `${log.timestamp} ` : '';
      return `${ts}${log.line}`;
    })
    .join('\n');

  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${containerId.substring(0, 12)}_logs.txt`;
  // ... trigger download and cleanup
};
```

**UX Enhancement:** Allows users to export logs for offline analysis or sharing.

---

### 3. UI Integration (`frontend/src/components/containers/ContainerMetricsModal.tsx`)

**Tab Structure Change:**

```typescript
// BEFORE
<TabList>
  <Tab>Overview</Tab>
  <Tab>Metrics History</Tab>
</TabList>

// AFTER
<TabList>
  <Tab>Overview</Tab>
  <Tab>Logs</Tab>
</TabList>
```

```typescript
// NEW Logs Tab
<TabPanel value={1} sx={{ height: '500px', overflow: 'hidden' }}>
  <LogsViewer
    containerId={container.id}
    containerState={container.state}
  />
</TabPanel>
```

**Design Decision:** Replace unused "Metrics History" tab with functional "Logs" tab, providing immediate value to users.

---

## Communication Flow

### Request Flow

```mermaid
sequenceDiagram
    participant User
    participant LogsViewer
    participant WebSocketContext
    participant Backend
    participant Docker

    User->>LogsViewer: Opens container modal
    LogsViewer->>WebSocketContext: send(ContainerLogsRequest)
    WebSocketContext->>Backend: WebSocket message
    Backend->>Backend: Parse request
    Backend->>Backend: Cancel old stream (if exists)
    Backend->>Docker: Start logs stream

    rect rgb(240, 240, 240)
        Note over Backend,Docker: Initial Load Phase
        loop Collect historical logs
            Docker->>Backend: Log chunk
            Backend->>Backend: Buffer in initial_lines
        end
        Backend->>Backend: 200ms timeout (no new logs)
        Backend->>WebSocketContext: ContainerLogs (is_initial: true)
        WebSocketContext->>LogsViewer: Update logs state
        LogsViewer->>User: Display logs
    end

    rect rgb(230, 255, 230)
        Note over Backend,Docker: Streaming Phase (if follow=true)
        loop While container running
            Docker->>Backend: New log line
            Backend->>Backend: Buffer (100ms or 100 lines)
            Backend->>WebSocketContext: ContainerLogs (is_initial: false)
            WebSocketContext->>LogsViewer: Append logs
            LogsViewer->>User: Auto-scroll (if at bottom)
        end
    end

    Docker->>Backend: Stream end
    Backend->>WebSocketContext: ContainerLogsEnd
    WebSocketContext->>LogsViewer: Set streaming inactive
```

### Error Scenarios

```mermaid
flowchart TD
    A[Log Stream Request] --> B{Container exists?}
    B -->|No| C[ContainerLogsError]
    B -->|Yes| D{Stream established?}
    D -->|No| C
    D -->|Yes| E[Streaming logs]
    E --> F{Error occurs?}
    F -->|Docker API error| C
    F -->|Client disconnect| G[Cancel stream]
    F -->|No| E

    C --> H[Display error to user]
    G --> I[Cleanup resources]

    style C fill:#ffcccc
    style H fill:#ffcccc
    style G fill:#ffffcc
    style I fill:#ffffcc
    style E fill:#ccffcc
```

---

## Design Decisions

### 1. Why WebSocket Instead of REST Polling?

**WebSocket Advantages:**
- ✅ Real-time updates with minimal latency
- ✅ Efficient bidirectional communication
- ✅ Lower bandwidth overhead (no HTTP headers on every message)
- ✅ Server can push updates without client requests

**REST Polling Disadvantages:**
- ❌ Increased latency (poll interval)
- ❌ Higher server load (repeated HTTP requests)
- ❌ Inefficient for live following

### 2. Batching Strategy

**Time-based (100ms) + Size-based (100 lines):**

| Strategy | Pros | Cons |
|----------|------|------|
| **No batching** | Lowest latency | High message overhead, poor performance during log bursts |
| **Time-only** | Predictable load | May send very large messages during bursts |
| **Size-only** | Bounded message size | High latency for slow-logging containers |
| **Hybrid (chosen)** | Best of both worlds | Slightly more complex logic |

### 3. Initial vs Streaming Separation

The `is_initial` flag enables:
- **Frontend optimization**: Can replace entire log buffer vs appending
- **Loading states**: Show spinner only during initial load
- **User feedback**: Different behavior for historical vs live logs

### 4. Client-Side vs Server-Side State

**Server-side (per-client):**
- Active stream tracking
- Cancellation channels
- Buffer management

**Client-side:**
- Log storage (up to 10k lines)
- Display filtering (stdout/stderr)
- Scroll position

**Rationale:** Server manages streaming lifecycle, client manages presentation.

### 5. Cancellation Pattern

```rust
let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel();

tokio::select! {
    _ = &mut cancel_rx => {
        info!("Log stream cancelled");
        break;
    }
    log_result = logs_stream.next() => { /* ... */ }
}
```

**Why oneshot channels?**
- ✅ Zero-cost when not triggered
- ✅ Cooperative cancellation (clean shutdown)
- ✅ Type-safe (channel consumed after one send)

Alternative (rejected): `tokio::task::JoinHandle::abort()`
- ❌ Abrupt termination (may leave resources in inconsistent state)
- ❌ No cleanup opportunity

---

## Performance Considerations

### Backend

1. **Memory**: Max 5000 tail lines per stream prevents unbounded growth
2. **CPU**: Minimal parsing (only timestamp extraction if requested)
3. **Network**: Batching reduces WebSocket frame overhead
4. **Concurrency**: Each stream runs in isolated async task

### Frontend

1. **Memory**: 10k line limit with FIFO eviction
2. **Rendering**: Virtual scrolling could be added for >1k lines (future optimization)
3. **Re-renders**: `useCallback` and `useMemo` prevent unnecessary re-renders
4. **Network**: Client-side filtering reduces re-request needs

### Scalability

| Metric | Current Limit | Notes |
|--------|--------------|-------|
| **Concurrent streams per client** | 1 | Old stream auto-cancelled |
| **Max tail lines** | 5000 | Server-enforced |
| **Client buffer** | 10000 lines | Frontend limit |
| **Batch size** | 100 lines or 100ms | Whichever comes first |
| **Message overhead** | ~200 bytes per batch | JSON + WebSocket frame |

**Estimated Bandwidth:**

- Average log line: 200 bytes
- Batch size: 100 lines × 200 bytes = 20 KB
- Batch frequency: 100ms (worst case)
- Max throughput: ~200 KB/s per stream

---

## Error Handling

### Backend Error Cases

| Error | Detection | Handling |
|-------|-----------|----------|
| **Container not found** | Docker API error | Send `ContainerLogsError` |
| **Permission denied** | Docker API error | Send `ContainerLogsError` |
| **Client disconnect** | Send task error | Cancel stream task |
| **Stream interrupted** | Bollard stream error | Log error, send `ContainerLogsError` |

### Frontend Error Cases

| Error | Detection | Handling |
|-------|-----------|----------|
| **WebSocket disconnected** | Context state | Disable controls, show reconnecting status |
| **Backend error message** | `container_logs_error` | Display error alert |
| **Request send failure** | `send()` returns false | Display error, suggest refresh |
| **Invalid container ID** | Backend error response | Display error in modal |

---

## Future Enhancements

### Potential Improvements

1. **Search/Filter**: Add text search within logs
2. **Syntax Highlighting**: Detect and highlight JSON, XML, or stack traces
3. **Virtual Scrolling**: Improve performance with 10k+ lines
4. **Log Persistence**: Option to save logs to database
5. **Multi-container View**: View logs from multiple containers simultaneously
6. **Regex Filtering**: Server-side regex filtering to reduce bandwidth
7. **Compression**: gzip compress log batches before sending
8. **Reconnection**: Auto-resume streaming after WebSocket reconnection

### Code Quality

- ✅ **Type Safety**: Full type coverage (Rust + TypeScript)
- ✅ **Error Handling**: Comprehensive error paths
- ✅ **Resource Cleanup**: Proper task cancellation and unsubscription
- ✅ **Logging**: Detailed logging for debugging
- ⚠️ **Testing**: Unit tests needed for stream logic
- ⚠️ **Documentation**: API docs for WebSocket messages

---

## Summary

This implementation adds production-ready container log streaming to Docker Manager with:

- **Real-time WebSocket streaming** with efficient batching
- **Robust lifecycle management** with proper cleanup
- **Memory-bounded** operation on both frontend and backend
- **User-friendly controls** (follow mode, filtering, export)
- **Graceful error handling** with clear user feedback

The architecture is scalable, type-safe, and maintains separation of concerns between presentation (frontend) and business logic (backend).
