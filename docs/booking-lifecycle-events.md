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
DELETE /v1/bookings/:id
Authorization: Bearer <passenger_token>
Body: { "canceledReason": "Optional reason" }
```

**Socket Event:**
```javascript
socket.emit('booking:cancel', { 
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

**API Endpoint:**
```
POST /v1/bookings/:id/lifecycle
Authorization: Bearer <passenger_token>
Body: { "passengerDisconnected": true }
```

**Socket Events:**
```javascript
// Handle disconnection
socket.emit('booking:disconnect', { bookingId: 'booking_id' });

// Handle reconnection
socket.emit('booking:reconnect', { bookingId: 'booking_id' });
```

### 3. Driver Acceptance

When a driver accepts a booking:

**Process:**
1. Update booking status to 'accepted' for both parties
2. Remove booking from all other drivers' lists
3. Clean up cache for other drivers
4. Notify both passenger and accepting driver
5. Clean up booking details from general cache

**API Endpoints:**
```
POST /v1/bookings/:id/assign
Authorization: Bearer <admin_token>
Body: {
  "driverId": "driver_id",
  "dispatcherId": "dispatcher_id",
  "passengerId": "passenger_id",
  "vehicleType": "mini",
  "location": { "latitude": 9.0192, "longitude": 38.7525 },
  "pricing": { "fare": 25.50 }
}

POST /v1/bookings/:id/lifecycle
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
socket.emit('booking:accept', {
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

### Existing Endpoints Enhanced

#### 1. Cancel Booking (Enhanced)
```javascript
DELETE /v1/bookings/:id
```

**Request Body:**
```json
{
  "canceledReason": "string (optional)"
}
```

#### 2. Booking Lifecycle (Enhanced)
```javascript
POST /v1/bookings/:id/lifecycle
```

**Request Body:**
```json
{
  "status": "string",
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
  },
  "canceledReason": "string (optional)"
}
```

#### 3. Driver Assignment (Enhanced)
```javascript
POST /v1/bookings/:id/assign
```

**Request Body:**
```json
{
  "driverId": "string",
  "dispatcherId": "string",
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

## Socket Events

### Client to Server Events

| Event | Description | Data |
|-------|-------------|------|
| `booking:cancel` | Passenger cancels booking | `{ bookingId, reason? }` |
| `booking:disconnect` | Handle passenger disconnection | `{ bookingId }` |
| `booking:reconnect` | Handle passenger reconnection | `{ bookingId }` |
| `booking:accept` | Driver accepts booking | `{ bookingId, vehicleType?, location?, pricing? }` |

### Server to Client Events

| Event | Description | Data |
|-------|-------------|------|
| `booking:notification` | Booking status notification | `{ message, status, bookingId, type }` |
| `booking:canceled` | Cancellation processed | `{ success, bookingId, message }` |
| `booking:disconnect_handled` | Disconnection processed | `{ success, bookingId, message }` |
| `booking:reconnect_handled` | Reconnection processed | `{ success, bookingId, message }` |
| `booking:accepted` | Acceptance processed | `{ success, bookingId, message }` |

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