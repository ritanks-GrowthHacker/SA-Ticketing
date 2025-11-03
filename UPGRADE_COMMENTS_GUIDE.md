# 🚀 Ticket Comments Upgrade Guide

## 📋 **Current Situation**
Your schema **ALREADY has a `ticket_comments` table**, but it's basic:
```sql
CREATE TABLE public.ticket_comments (
  id uuid,
  ticket_id uuid,
  user_id uuid,
  parent_comment_id uuid,  -- ✅ Good for nesting
  comment text,            -- ❌ Basic field name
  created_at timestamp
);
```

## 🎯 **Upgrade Process**

### **Step 1: Run the Database Migration**
```bash
# This will ENHANCE your existing table without losing data
psql -d your_database -f database-updates/upgrade-ticket-comments.sql
```

**What this does:**
- ✅ **Preserves all existing comments** - No data loss!
- ✅ **Adds advanced features** - Edit tracking, soft delete, organization isolation
- ✅ **Backward compatible** - Old comments still work
- ✅ **Performance optimized** - Indexes and triggers added

### **Step 2: Update Your Schema (Already Done)**
The migration script adds these new columns:
- `organization_id` - For security isolation
- `content` - New field (keeps old `comment` field)  
- `content_type` - Support text/markdown/html
- `is_edited`, `edited_at` - Edit tracking
- `is_deleted`, `deleted_at` - Soft delete
- `reply_count` - Performance optimization
- `mention_user_ids[]` - For @mentions
- `attachment_urls[]` - For file attachments

### **Step 3: Use the New React Component**
```typescript
import TicketComments from '../components/comments/TicketComments';

// In your ticket modal or page:
<TicketComments ticketId="your-ticket-id" />
```

## 🔄 **Backward Compatibility**

The upgrade is **100% backward compatible**:

### **✅ Existing Data**
- All your current comments are preserved
- Old `comment` field is kept alongside new `content` field  
- API automatically uses `content || comment` for display

### **✅ Existing Code**
- Your current queries still work
- New features are additive, not replacing

### **✅ Migration Safety**
- Non-destructive migration
- Rollback possible if needed
- Data integrity maintained

## 🎨 **New Features Available**

After migration, you get:

### **🌳 Advanced Nesting**
```typescript
// Unlimited reply depth (UI limited to 5 levels)
Comment 1
├── Reply 1.1  
│   ├── Reply 1.1.1
│   └── Reply 1.1.2
└── Reply 1.2
```

### **✏️ Edit & Delete**
- Users can edit their own comments
- Edit history is tracked
- Soft delete preserves reply structure

### **🔒 Security & Performance**
- Organization-level isolation
- Row-level security policies  
- Optimized queries with indexes
- Cached reply counts

### **🎯 Rich Content**
- Support for text/markdown/html
- @mentions ready (user array field)
- File attachments ready (URL array field)

## 📊 **Before vs After**

### **Before (Current):**
```sql
SELECT id, comment, created_at 
FROM ticket_comments 
WHERE ticket_id = 'xxx';
```

### **After (Enhanced):**
```sql
SELECT 
  id, 
  COALESCE(content, comment) as content,
  parent_comment_id,
  reply_count,
  is_edited,
  created_at,
  user_name
FROM ticket_comments_with_users  -- New view
WHERE ticket_id = 'xxx' 
AND is_deleted = false;
```

## 🧪 **Testing the Migration**

### **1. Backup First (Recommended)**
```bash
pg_dump -h your_host -U your_user -d your_db -t ticket_comments > backup_comments.sql
```

### **2. Run Migration**
```bash
psql -d your_database -f database-updates/upgrade-ticket-comments.sql
```

### **3. Verify Data**
```sql
-- Check existing comments are preserved
SELECT COUNT(*) FROM ticket_comments;

-- Check new features are available  
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ticket_comments';

-- Test the new view
SELECT * FROM ticket_comments_with_users LIMIT 5;
```

### **4. Test API Endpoints**
```bash
# Get comments (should work with existing data)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/ticket-comments?ticket_id=EXISTING_TICKET_ID"
```

## 🚨 **Rollback Plan** (If Needed)

If something goes wrong, you can rollback:

```sql
-- Remove new columns (keeps original data intact)
ALTER TABLE ticket_comments 
DROP COLUMN IF EXISTS organization_id,
DROP COLUMN IF EXISTS content,
DROP COLUMN IF EXISTS content_type,
DROP COLUMN IF EXISTS is_edited,
DROP COLUMN IF EXISTS edited_at,
DROP COLUMN IF EXISTS is_deleted,
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS reply_count,
DROP COLUMN IF EXISTS updated_at,
DROP COLUMN IF EXISTS mention_user_ids,
DROP COLUMN IF EXISTS attachment_urls;

-- Drop new table
DROP TABLE IF EXISTS ticket_comment_edits;

-- Your original comment data remains untouched
```

## 📞 **Next Steps**

1. **Run the migration** when ready
2. **Test with existing tickets** to ensure everything works
3. **Integrate the React component** into your ticket modal
4. **Enjoy the enhanced comments system!**

The migration is **safe and reversible**. Your existing comment data will be preserved and enhanced with new features!

## 🎯 **Files Updated/Created**

- `database-updates/upgrade-ticket-comments.sql` - Safe migration script
- `app/api/ticket-comments/route.ts` - Updated to support both schemas
- `app/api/ticket-comments/[id]/route.ts` - Individual comment operations  
- `components/comments/TicketComments.tsx` - Full React component
- `db/comment-types.ts` - TypeScript types

Ready to upgrade? Run the migration script and let me know how it goes!