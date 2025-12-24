# Organization Forgot Password - Quick Start Guide

## 🚀 Ready to Use!

The organization forgot password system is now fully implemented and ready to use. No database changes needed!

## ✅ What's Been Implemented

### 1. API Endpoints
- ✅ **POST** `/api/org-forgot-password` - Send OTP to organization email
- ✅ **POST** `/api/org-reset-password` - Reset organization password

### 2. UI Components
- ✅ Standalone page: `/org-forgot-password`
- ✅ Modal integration in organization login page
- ✅ OTP verification flow
- ✅ Password reset form

### 3. Features
- ✅ Email OR username support
- ✅ 6-digit OTP (10-minute expiration)
- ✅ Secure password reset
- ✅ Email notifications via existing email service
- ✅ Error handling and validation
- ✅ Success confirmations

## 🎯 How to Use

### For End Users (Organizations)

#### Method 1: Using Modal (Recommended)
1. Go to login page: `/org-login`
2. Click **"Forgot your password?"** link
3. Modal opens
4. Enter your **organization email** or **username**
5. Click **"Send OTP"**
6. Check your email for 6-digit OTP
7. Enter OTP in verification screen
8. Set your new password (min 8 characters)
9. Confirm password
10. Done! Login with new password

#### Method 2: Using Dedicated Page
1. Go directly to: `/org-forgot-password`
2. Follow the 4-step wizard
3. Complete password reset
4. Click "Go to Login"

### For Developers

#### Test the Flow
```bash
# Start your development server
npm run dev

# Open browser and navigate to:
http://localhost:3000/org-login

# Click "Forgot your password?" and follow the flow
```

#### Test with curl
```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/org-forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-org@example.com"}'

# Or with username
curl -X POST http://localhost:3000/api/org-forgot-password \
  -H "Content-Type: application/json" \
  -d '{"username":"yourorg"}'

# 2. After OTP verification, reset password
curl -X POST http://localhost:3000/api/org-reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email":"your-org@example.com",
    "newPassword":"newpassword123",
    "confirmPassword":"newpassword123"
  }'
```

## 📋 Files Created

```
app/
├── api/
│   ├── org-forgot-password/
│   │   └── route.tsx          ✨ NEW - Send OTP API
│   └── org-reset-password/
│       └── route.tsx          ✨ NEW - Reset password API
└── org-forgot-password/
    └── page.tsx               ✨ NEW - Standalone reset page

app/org-login/
└── page.tsx                   ✏️ UPDATED - Added modal flow

Documentation/
├── ORG_FORGOT_PASSWORD_SYSTEM.md    📚 Complete documentation
└── ORG_FORGOT_PASSWORD_QUICKSTART.md 📖 This file
```

## 🔐 Security Features

- ✅ OTP expires in 10 minutes
- ✅ Password minimum 8 characters
- ✅ Bcrypt password hashing
- ✅ OTP cleared after use
- ✅ Generic error messages (doesn't reveal if org exists)
- ✅ Email verification required

## 🎨 UI Features

- ✅ Modern, clean design
- ✅ Responsive (mobile-friendly)
- ✅ Success/error messages
- ✅ Loading states
- ✅ Form validation
- ✅ Modal and page versions
- ✅ Auto-focus on inputs
- ✅ Consistent with app design

## 🐛 Troubleshooting

### OTP Not Received?
1. Check spam/junk folder
2. Verify organization email in database
3. Check email service is configured
4. Look for errors in console/logs

### Can't Reset Password?
1. Make sure OTP was verified
2. Check password meets requirements (8+ chars)
3. Ensure passwords match
4. Try again after 10 minutes if OTP expired

### Modal Not Working?
1. Check browser console for errors
2. Clear browser cache
3. Try the standalone page: `/org-forgot-password`

## 📊 Comparison with User System

| Feature | User | Organization |
|---------|------|--------------|
| Identifier | Email only | Email OR Username |
| Min Password | 6 chars | 8 chars |
| OTP Duration | 10 min | 10 min |
| Modal Support | ✅ | ✅ |
| Dedicated Page | ❌ | ✅ |

## 💡 Tips

1. **For Organizations**: Keep your organization email up to date in your profile
2. **For Admins**: Monitor forgot password usage in logs
3. **For Support**: Direct users to `/org-forgot-password` for easy access
4. **For Testing**: Use a test organization with a real email you can access

## 🔗 Related Pages

- Login: `/org-login`
- Forgot Password: `/org-forgot-password`
- Signup: `/org-signup`
- Onboarding: `/org-onboarding`

## 📞 Need Help?

Check the full documentation: `ORG_FORGOT_PASSWORD_SYSTEM.md`

---

**Status**: ✅ Ready for Production
**Last Updated**: December 24, 2025
**Version**: 1.0.0
