# DerLg Driver Bot — Telegram Onboarding Guide

> Version: 1.0 | Last updated: 2026-05-17
> Language: English

---

## Table of Contents

1. [What is the DerLg Driver Bot?](#what-is-the-derlg-driver-bot)
2. [Before You Start](#before-you-start)
3. [Registration](#registration)
4. [Daily Commands](#daily-commands)
5. [Managing Trips](#managing-trips)
6. [Trip History and Earnings](#trip-history-and-earnings)
7. [Emergency and Support](#emergency-and-support)
8. [Location Sharing](#location-sharing)
9. [Troubleshooting](#troubleshooting)
10. [Command Quick Reference](#command-quick-reference)

---

## What is the DerLg Driver Bot?

The DerLg Driver Bot is a Telegram bot that lets you manage your work status and trip assignments directly from your phone. No app installation required — just use Telegram messages and buttons.

**What you can do:**
- Go online/offline to show your availability
- Receive trip assignments with Accept/Reject buttons
- View trip details and customer information
- Start and complete trips
- View your trip history and earnings
- Send emergency alerts
- Contact support
- Share your live location during trips

---

## Before You Start

### What You Need

1. **Telegram app** installed on your phone
2. **Driver ID** provided by your Fleet Manager (e.g., `DRV001`)
3. **4-digit PIN** provided by your Fleet Manager (e.g., `1234`)

### Find the Bot

1. Open Telegram
2. Search for `@DerLgDriverBot`
3. Tap **Start** or send `/start`

---

## Registration

### Step 1: Start Registration

Send `/start` to the bot. If this is your first time, you will see:

```
Welcome to DerLg Driver Bot!

To get started, please provide your credentials:

Format:
driver_id: YOUR_ID
pin: YOUR_PIN

Example:
driver_id: DRV001
pin: 1234
```

### Step 2: Enter Your Credentials

Send your Driver ID and PIN in the exact format shown:

```
driver_id: DRV001
pin: 1234
```

**Important:**
- Use the exact format with `driver_id:` and `pin:`
- The space after the colon is required
- Driver ID is uppercase (e.g., `DRV001`)
- PIN is exactly 4 digits

### Step 3: Registration Success

If your credentials are correct, you will see:

```
Registration Successful!

Name: Sokha Chen
Vehicle: Toyota Hiace
Status: OFFLINE

You can now use the following commands:
/online - Go online
/status - Check your status
/help - View all commands
```

If credentials are wrong:

```
Invalid driver ID or PIN. Please try again.
```

Contact your Fleet Manager if you forgot your Driver ID or PIN.

### Already Registered?

If you send `/start` again after registering, you will see your current status dashboard instead of the registration prompt.

---

## Daily Commands

### Go Online — `/online`

When you are ready to accept trips, send `/online`.

```
You are now ONLINE

You are available for trip assignments.
We'll notify you when a trip is assigned.

[Go Offline] [View Status]
```

Your status changes to **AVAILABLE** in the admin panel instantly.

### Go Offline — `/offline`

When you finish work, send `/offline`.

```
You are now OFFLINE

You won't receive trip assignments.
Tap below when ready to work:

[Go Online]
```

**Important:** You cannot go offline if you have an active trip. Complete the trip first.

```
Cannot go offline. You have an active trip.
Please complete the trip first.

[View Trip Details]
```

### Check Status — `/status`

Send `/status` to see your current information:

```
Your Status

Status: AVAILABLE
Vehicle: Toyota Hiace
Last Update: 5 minutes ago

[Go Online] [Go Offline] [View Trips]
```

Tap the buttons to change status or view trips without typing commands.

---

## Managing Trips

### Receiving a Trip Assignment

When the dispatch team assigns you a trip, you receive a notification:

```
New Trip Assignment!

Pickup: Phnom Penh International Airport
Destination: Grand Hotel, Siem Reap
Pickup Time: May 20, 2026 at 14:00

Customer: John Smith
Passengers: 2 adults, 1 child
Booking Ref: BK20240517001

Please respond within 5 minutes

[Accept Trip] [Reject Trip]
```

**Tap [Accept Trip]** to accept the assignment.

```
Trip Accepted

Customer has been notified.

Pickup: Phnom Penh International Airport
Time: May 20, 2026 at 14:00
Customer: +85512345678

[Start Trip] [View Details] [Contact Support]
```

**Tap [Reject Trip]** if you cannot take the trip.

```
Trip Rejected

Dispatch has been notified.
```

**Timeout:** If you do not respond within 5 minutes, the trip is automatically rejected and assigned to another driver.

### View Active Trip — `/mytrip`

Send `/mytrip` to see your current trip details:

```
Active Trip

Booking Ref: BK20240517001
Customer: John Smith
Pickup: Phnom Penh International Airport
Destination: Grand Hotel, Siem Reap
Time: May 20, 2026 at 14:00
Passengers: 2 adults, 1 child
Special Requests: Vegetarian meals

[Start Trip] [Complete Trip] [Contact Support]
```

If you have no active trip:

```
No active trips.
Status: AVAILABLE

[Go Online]
```

### Start a Trip

When you arrive at the pickup location and the customer is in the vehicle, tap **[Start Trip]**:

```
Trip Started

Drive safely!

Destination: Grand Hotel, Siem Reap
Estimated Duration: 5 hours 30 minutes

Share your live location?
[Share Location] [Skip]

[Complete Trip] [Emergency]
```

### Complete a Trip

When you reach the destination, tap **[Complete Trip]**:

```
Trip Completed!

Duration: 5 hours 45 minutes
Distance: 321 km

You are now available for new assignments.

[View History] [Go Offline]
```

Your status automatically changes back to **AVAILABLE**.

---

## Trip History and Earnings

### View History — `/history`

Send `/history` to see your last 10 completed trips:

```
Trip History

1. May 15, 2026 — BK20240515003
   Phnom Penh → Siem Reap
   Duration: 5h 30m

2. May 12, 2026 — BK20240512001
   Siem Reap → Phnom Penh
   Duration: 5h 15m

...

[Today's Summary] [This Week] [This Month]
```

### Earnings Summary

Tap **[Today's Summary]** to see today's earnings:

```
Today's Summary

Trips: 2
Hours: 11h 45m
Earnings: $125.00
```

Tap **[This Week]** or **[This Month]** for period summaries.

---

## Emergency and Support

### Emergency Alert — `/emergency`

If you have an emergency during a trip, send `/emergency`:

```
Emergency Alert Sent

Dispatch has been notified.
They will contact you immediately.
Stay safe!

Emergency Contacts:
Police: 117
Ambulance: 119
Tourist Police: 012 942 484
```

**Only use this for real emergencies.** False alerts may result in account review.

### Contact Support — `/support`

For non-urgent issues or questions, send `/support`:

```
Please describe your issue or question:
```

Type your message:

```
My vehicle has a flat tire and I need assistance.
```

```
Support Ticket #1234 Created

Our team will respond within 30 minutes.
```

### Help — `/help`

Send `/help` anytime to see all available commands:

```
Available Commands:

/start — Registration and dashboard
/online — Go online (available for trips)
/offline — Go offline (not available)
/status — Check your current status
/mytrip — View active trip details
/history — View trip history and earnings
/emergency — Send emergency alert
/support — Contact support team
/language — Change bot language
/help — Show this help message

Tap any button to use a command.
```

---

## Location Sharing

When you start a trip, the bot asks if you want to share your live location:

```
Share your live location for this trip?
[Share Location] [Skip]
```

### How to Share Location

1. Tap **[Share Location]**
2. Telegram will ask for permission
3. Grant permission for live location sharing
4. Your location updates every 60 seconds

The dispatch team can see your position on the admin map in real-time. Location sharing stops automatically when you complete the trip.

### Privacy

- Your location is only stored for the current trip
- Old locations are automatically deleted
- You can skip location sharing if you prefer

---

## Troubleshooting

### Bot not responding

- Check your internet connection
- Make sure you are messaging `@DerLgDriverBot`
- Try sending `/start` again
- Wait a few minutes and retry

### Registration failed

- Check that your Driver ID and PIN are exactly as provided by your Fleet Manager
- Use the exact format: `driver_id: DRV001` (space after colon)
- Make sure your PIN is 4 digits
- Contact your Fleet Manager to verify your credentials

### Not receiving trip assignments

- Make sure you are **ONLINE** (send `/status` to check)
- Verify your Telegram account is registered (send `/status`)
- Check that you are in an area with internet coverage

### Cannot accept a trip

- You may have timed out (5-minute limit). Contact dispatch.
- You may already have an active trip. Complete it first.

### Cannot go offline

- You have an active trip. Tap **[Complete Trip]** first.
- If the trip was cancelled by dispatch, send `/status` to refresh.

### Location sharing not working

- Make sure Telegram has location permissions in your phone settings
- Try tapping **[Share Location]** again
- Location updates require mobile data or WiFi

### Forgot commands

Send `/help` anytime to see all commands.

---

## Command Quick Reference

| Command | What it does |
|---------|-------------|
| `/start` | Registration or status dashboard |
| `/online` | Set status to AVAILABLE |
| `/offline` | Set status to UNAVAILABLE |
| `/status` | Show current status and vehicle |
| `/mytrip` | View active trip details |
| `/history` | View past trips and earnings |
| `/emergency` | Send emergency alert to dispatch |
| `/support` | Create a support ticket |
| `/language` | Change bot language |
| `/help` | Show all commands |

### Inline Buttons

These buttons appear in messages so you can tap instead of typing:

- **[Go Online]** / **[Go Offline]** — Change availability
- **[Accept Trip]** / **[Reject Trip]** — Respond to assignments
- **[Start Trip]** / **[Complete Trip]** — Manage active trip
- **[View Details]** / **[View History]** — See more information
- **[Contact Support]** — Get help
- **[Share Location]** — Enable live tracking
- **[Today's Summary]** / **[This Week]** / **[This Month]** — View earnings

---

## Tips for Success

1. **Go online early** — Log in 15-30 minutes before your shift starts
2. **Respond quickly** — Accept or reject assignments within 5 minutes
3. **Keep Telegram open** — Enable notifications so you don't miss assignments
4. **Update status accurately** — Go offline when you finish work
5. **Share location** — Helps dispatch track trip progress
6. **Use support** — Report issues early so they can be resolved quickly

---

## Contact

For help with registration or technical issues, contact your Fleet Manager or the DerLg support team.
