# Email Service Documentation

## Overview
The Ticketing Metrix system includes a comprehensive email service built with Nodemailer for sending notifications and communications.

## Setup

### 1. Install Dependencies
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and configure your email credentials:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Important Security Notes:**
- Never use your regular email password
- For Gmail, generate an App Password from Google Account settings
- Keep credentials in environment variables, never in code

## API Endpoints

### 1. Send Email - `/api/send-email`
General-purpose email sending endpoint.

**POST Request:**
```json
{
  "to": "recipient@example.com",
  "subject": "Your Subject",
  "text": "Plain text content",
  "html": "<h1>HTML content</h1>"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "message-id",
  "message": "Email sent successfully"
}
```

### 2. Test Email - `/api/test-email`
Testing endpoint with predefined email templates.

**POST Request:**
```json
{
  "to": "test@example.com",
  "type": "team-assignment",
  "projectName": "My Project",
  "role": "Developer",
  "assigneeName": "John Doe"
}
```

**Types Available:**
- `simple` - Basic test email
- `team-assignment` - Project assignment notification
- `ticket-notification` - Ticket status notification

**GET Request:**
Tests email service connection without sending emails.

## Email Service Class

### Usage
```typescript
import { emailService } from '@/lib/emailService';

// Send basic email
const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Hello',
  text: 'Hello world!'
});

// Send team assignment email
const result = await emailService.sendTeamAssignmentEmail(
  'user@example.com',
  'Project Name',
  'Developer',
  'John Doe'
);

// Send ticket notification
const result = await emailService.sendTicketNotificationEmail(
  'user@example.com',
  'TCK-001',
  'Bug Fix Required',
  'In Progress',
  'Jane Smith'
);
```

### Methods

#### `sendEmail(options: EmailOptions)`
Send a custom email with full control over content.

**Parameters:**
```typescript
interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}
```

#### `sendTeamAssignmentEmail(to, projectName, role, assigneeName)`
Send a formatted team assignment notification.

#### `sendTicketNotificationEmail(to, ticketId, title, status, assigneeName)`
Send a formatted ticket status notification.

#### `verifyConnection()`
Test email service connectivity.

## Email Templates

### Team Assignment Template
- Professional HTML formatting
- Project and role details
- Call-to-action to check dashboard

### Ticket Notification Template
- Ticket ID and title
- Status updates
- Direct link to ticket (when implemented)

## Error Handling

All email methods return a consistent response format:

```typescript
{
  success: boolean;
  messageId?: string;  // If successful
  error?: string;      // If failed
}
```

## Security Best Practices

1. **Environment Variables**: Always use environment variables for credentials
2. **App Passwords**: Use app-specific passwords, not regular account passwords
3. **Rate Limiting**: Consider implementing rate limiting for email endpoints
4. **Validation**: Always validate email addresses before sending
5. **Logging**: Log email attempts but never log credentials

## Gmail Setup Guide

1. Enable 2-Factor Authentication on your Google Account
2. Go to Google Account Settings > Security > App passwords
3. Generate a new app password for "Mail"
4. Use this 16-character password in EMAIL_PASS
5. Use your regular Gmail address in EMAIL_USER

## Testing

### Test Connection
```bash
curl -X GET http://localhost:3000/api/test-email
```

### Send Test Email
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com","type":"simple"}'
```

## Troubleshooting

### Common Issues

1. **"Invalid login"** - Check app password and 2FA setup
2. **"Connection timeout"** - Check network/firewall settings
3. **"Service not ready"** - Verify EMAIL_SERVICE configuration
4. **"Recipient rejected"** - Validate email address format

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

## Future Enhancements

- [ ] Email templates management UI
- [ ] Bulk email sending
- [ ] Email delivery tracking
- [ ] Unsubscribe handling
- [ ] Email scheduling
- [ ] Multiple email provider support