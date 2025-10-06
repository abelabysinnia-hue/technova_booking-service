# Booking Lifecycle Events Documentation

This document describes the booking lifecycle event handling system that manages three key scenarios in the ride-sharing application.

## Overview

The booking lifecycle system handles critical events that occur during the booking process, ensuring proper state management, notifications, and cleanup across the system.

## Key Scenarios

### 1. Passenger Cancellation After Driver Acceptance

When a passenger cancels a booking after a driver has already accepted it:

**Process:**
1. Update booking status to 'canceled' for both passenger and driver
2. Notify the driver about the cancellation
3. Remove booking from driver's active list
4. Clean up booking details from cache
5. Log the cancellation event

**API Endpoint:**
```
POST /v1/bookings/:id/cancel
Authorization: Bearer <passenger_token>
Body: { "canceledReason": "Optional reason" }
```

**Socket Event:**
```javascript
socket.emit('passenger:cancel', { 
  bookingId: 'booking_id', 
  reason: 'Optional reason' 
});
```

### 2. Passenger Disconnection Handling

When a passenger disconnects from the socket after driver acceptance:

**Process:**
1. Set a 60-second timeout for automatic cancellation
2. If passenger doesn't reconnect within timeout:
   - Cancel the booking due to disconnection
   - Notify the driver
   - Remove from driver's active list
   - Clean up cache
3. If passenger reconnects, clear the timeout

**API Endpoints:**
```
POST /v1/bookings/:id/disconnect
Authorization: Bearer <admin_token>

POST /v1/bookings/:id/reconnect  
Authorization: Bearer <passenger_token>
```

**Socket Events:**
```javascript
// Handle disconnection
socket.emit('passenger:disconnect', { bookingId: 'booking_id' });

// Handle reconnection
socket.emit('passenger:reconnect', { bookingId: 'booking_id' });
```

### 3. Driver Acceptance

When a driver accepts a booking:

**Process:**
1. Update booking status to 'accepted' for both parties
2. Remove booking from all other drivers' lists
3. Clean up cache for other drivers
4. Notify both passenger and accepting driver
5. Clean up booking details from general cache

**API Endpoint:**
```
POST /v1/bookings/:id/lifecycle-event
Authorization: Bearer <driver_token>
Body: {
  "driverAccepted": true,
  "driverId": "driver_id",
  "passengerId": "passenger_id",
  "vehicleType": "mini",
  "location": { "latitude": 9.0192, "longitude": 38.7525 },
  "pricing": { "fare": 25.50 }
}
```

**Socket Event:**
```javascript
socket.emit('driver:accept', {
  bookingId: 'booking_id',
  vehicleType: 'mini',
  location: { latitude: 9.0192, longitude: 38.7525 },
  pricing: { fare: 25.50 }
});
```

## Configuration

### Timeout Settings

```javascript
const DISCONNECT_TIMEOUT = 60000; // 60 seconds
```

### Status Values

- `requested` - Initial booking state
- `accepted` - Driver has accepted the booking
- `ongoing` - Trip is in progress
- `completed` - Trip completed successfully
- `canceled` - Booking was canceled

### Cancellation Reasons

- `passenger` - Passenger initiated cancellation
- `driver` - Driver initiated cancellation  
- `system` - System initiated cancellation (e.g., timeout)

## API Reference

### Booking Lifecycle Event Handler

```javascript
POST /v1/bookings/:id/lifecycle-event
```

**Request Body:**
```json
{
  "passengerCancels": boolean,
  "passengerDisconnected": boolean,
  "driverAccepted": boolean,
  "driverId": "string",
  "passengerId": "string", 
  "vehicleType": "string",
  "location": {
    "latitude": number,
    "longitude": number,
    "address": "string"
  },
  "pricing": {
    "fare": number,
    "breakdown": object
  }
}
```

### Cancel Booking

```javascript
POST /v1/bookings/:id/cancel
```

**Request Body:**
```json
{
  "canceledReason": "string (optional)"
}
```

## Socket Events

### Client to Server Events

| Event | Description | Data |
|-------|-------------|------|
| `passenger:cancel` | Passenger cancels booking | `{ bookingId, reason? }` |
| `passenger:disconnect` | Handle passenger disconnection | `{ bookingId }` |
| `passenger:reconnect` | Handle passenger reconnection | `{ bookingId }` |
| `driver:accept` | Driver accepts booking | `{ bookingId, vehicleType?, location?, pricing? }` |
| `driver:cancel` | Driver cancels booking | `{ bookingId, reason? }` |

### Server to Client Events

| Event | Description | Data |
|-------|-------------|------|
| `booking:notification` | Booking status notification | `{ message, status, bookingId, type }` |
| `passenger:cancel:handled` | Cancellation processed | `{ success, bookingId, message }` |
| `passenger:disconnect:handled` | Disconnection processed | `{ success, bookingId, message }` |
| `passenger:reconnect:handled` | Reconnection processed | `{ success, bookingId, message }` |
| `driver:accept:handled` | Acceptance processed | `{ success, bookingId, message }` |
| `driver:cancel:handled` | Cancellation processed | `{ success, bookingId, message }` |

## Error Handling

All lifecycle events include comprehensive error handling:

- Database operation failures are logged and re-thrown
- Socket communication errors are logged but don't break the flow
- Cache cleanup errors are logged but non-critical
- Notification failures are logged but don't affect core functionality

## Logging

The system provides detailed logging for:

- Lifecycle event initiation
- Status updates
- Notification sending
- Cache operations
- Error conditions
- Socket events

Log levels: `info`, `warn`, `error`

## Database Schema Updates

The system uses existing booking models with these additional fields:

```javascript
{
  canceledBy: { type: String, enum: ['driver', 'passenger', 'system'] },
  canceledReason: { type: String },
  acceptedAt: { type: Date }
}
```

## Cache Management

The system broadcasts cache cleanup events for real-time systems:

- `booking:cache_cleanup` - General booking cache cleanup
- `booking:cache_cleanup_other_drivers` - Cleanup for other drivers

## Security Considerations

- All endpoints require proper authentication
- Users can only cancel their own bookings
- Drivers can only cancel bookings assigned to them
- Admin endpoints are restricted to admin users
- Socket events are authenticated via JWT middleware

## Performance Considerations

- Timeout tracking uses in-memory Map for fast lookups
- Database operations are optimized with proper indexing
- Socket events are non-blocking
- Cache cleanup is asynchronous
- Error handling prevents cascading failures

## Testing

The system can be tested using:

1. **API Testing**: Use the provided endpoints with proper authentication
2. **Socket Testing**: Connect to socket and emit events
3. **Integration Testing**: Test full lifecycle scenarios
4. **Timeout Testing**: Test disconnection timeout behavior

## Monitoring

Key metrics to monitor:

- Lifecycle event success rates
- Timeout cancellation rates
- Socket connection/disconnection patterns
- Database operation performance
- Cache cleanup effectiveness
- Error rates by event type