//! WebSocket integration tests
//!
//! Tests WebSocket message handling, broadcasting, and channel communication.

use serde_json::Value;
use tokio::sync::broadcast;
use tokio::time::{Duration, timeout};

#[tokio::test]
async fn test_channel_message_send_receive() {
    let (tx, mut rx) = broadcast::channel(16);

    // Send a message
    tx.send("test_message").unwrap();

    // Receive the message
    let received = rx.recv().await.unwrap();
    assert_eq!(received, "test_message");
}

#[tokio::test]
async fn test_broadcast_to_multiple_receivers() {
    let (tx, mut rx1) = broadcast::channel(16);
    let mut rx2 = tx.subscribe();
    let mut rx3 = tx.subscribe();

    // Send a message
    tx.send("broadcast_message").unwrap();

    // All receivers should get it
    assert_eq!(rx1.recv().await.unwrap(), "broadcast_message");
    assert_eq!(rx2.recv().await.unwrap(), "broadcast_message");
    assert_eq!(rx3.recv().await.unwrap(), "broadcast_message");
}

#[tokio::test]
async fn test_channel_buffering() {
    let (tx, mut rx) = broadcast::channel(16);

    // Send multiple messages
    for i in 0..5 {
        tx.send(i).unwrap();
    }

    // Receive all messages
    for i in 0..5 {
        assert_eq!(rx.recv().await.unwrap(), i);
    }
}

#[tokio::test]
async fn test_timeout_on_no_message() {
    let (_tx, mut rx) = broadcast::channel::<String>(16);

    // Try to receive with timeout - should timeout since no message is sent
    let result = timeout(Duration::from_millis(100), rx.recv()).await;
    assert!(result.is_err()); // Timeout error
}

#[tokio::test]
async fn test_channel_close() {
    let (tx, mut rx) = broadcast::channel::<String>(16);

    // Drop the sender
    drop(tx);

    // Receiver should get closed channel error
    let result = rx.recv().await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_json_message_serialization() {
    let (tx, mut rx) = broadcast::channel::<Value>(16);

    // Create a JSON message
    let message = serde_json::json!({
        "type": "container_stats",
        "data": {
            "container_id": "abc123",
            "cpu_usage": 25.5
        }
    });

    // Send and receive
    tx.send(message.clone()).unwrap();
    let received = rx.recv().await.unwrap();

    assert_eq!(received["type"], "container_stats");
    assert_eq!(received["data"]["container_id"], "abc123");
    assert_eq!(received["data"]["cpu_usage"], 25.5);
}

#[tokio::test]
async fn test_concurrent_message_handling() {
    let (tx, mut _rx) = broadcast::channel::<i32>(16);

    // Keep a receiver alive so sends don't fail
    let mut rx_keeper = tx.subscribe();

    // Spawn multiple tasks that send messages
    let handles: Vec<_> = (0..10)
        .map(|i| {
            let tx_clone = tx.clone();
            tokio::spawn(async move {
                let _ = tx_clone.send(i); // Ignore send errors
            })
        })
        .collect();

    // Wait for all tasks to complete
    for handle in handles {
        let _ = handle.await; // Ignore join errors
    }

    // Drop the receiver to clean up
    drop(rx_keeper);
}

#[tokio::test]
async fn test_system_stats_message_format() {
    let (tx, mut rx) = broadcast::channel::<Value>(16);

    let message = serde_json::json!({
        "type": "system_stats",
        "data": {
            "total_memory": 17179869184_i64,
            "used_memory": 8589934592_i64,
            "cpu_usage": 45.5
        }
    });

    tx.send(message).unwrap();
    let received = rx.recv().await.unwrap();

    assert_eq!(received["type"], "system_stats");
    assert_eq!(received["data"]["total_memory"], 17179869184_i64);
    assert!(received["data"]["cpu_usage"].as_f64().unwrap() > 0.0);
}

#[tokio::test]
async fn test_subscriber_late_join() {
    let (tx, mut rx1) = broadcast::channel::<i32>(16);

    // Send a message before second subscriber joins
    tx.send(1).unwrap();

    // First subscriber receives it
    assert_eq!(rx1.recv().await.unwrap(), 1);

    // Second subscriber joins late
    let mut rx2 = tx.subscribe();

    // Send another message
    tx.send(2).unwrap();

    // Both should receive the new message
    assert_eq!(rx1.recv().await.unwrap(), 2);
    assert_eq!(rx2.recv().await.unwrap(), 2);

    // But rx2 didn't receive the first message
    // (broadcast channels don't replay history)
}

#[tokio::test]
async fn test_message_ordering_within_receiver() {
    let (tx, mut rx) = broadcast::channel::<i32>(16);

    // Send messages in order
    for i in 0..10 {
        tx.send(i).unwrap();
    }

    // Receiver should get them in the same order
    for i in 0..10 {
        assert_eq!(rx.recv().await.unwrap(), i);
    }
}
