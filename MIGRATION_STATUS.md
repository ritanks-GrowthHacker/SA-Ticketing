# Migration Status - get-dashboard-metrics

## File Overview
- **File**: `app/api/get-dashboard-metrics/route.tsx`
- **Size**: 1314 lines
- **Complexity**: EXTREME - 30+ Supabase queries across Admin/Manager/Member roles
- **Status**: IN PROGRESS

## Migration Strategy
Due to extreme complexity (1314 lines, 30+ queries), this file requires:
1. Breaking into role-based sections (Admin, Manager, Member)
2. Each section has 10+ nested conditional Supabase queries
3. All queries need raw SQL conversion with proper TypeScript typing
4. Result mapping to match nested Supabase format

## Queries To Migrate

### ADMIN Section (Lines 297-641)
1. ✅ userOrgRole - DONE
2. ✅ userDeptRoles - DONE  
3. ✅ department fallback - DONE
4. ❌ currentTicketsQuery - Complex WITH joins
5. ❌ previousTicketsQuery
6. ❌ deptProjectIds (department filtering)
7. ❌ activeProjectsQuery
8. ❌ ownedProjectIds
9. ❌ sharedProjectIds
10. ❌ currentMembersQuery
11. ❌ previousMembersQuery
12. ❌ orgProjects
13. ❌ resolvedTicketsQuery
14. ❌ countQuery (pagination)
15. ❌ recentTicketsQuery (pagination)
16. ❌ sharedProjectsData
17. ❌ pendingRequests
18. ❌ weeklyTickets (chart data)

### MANAGER Section (Lines 642-1018)
1. ❌ managedProjectsQuery
2. ❌ projectTickets
3. ❌ currentMonthTickets
4. ❌ previousProjectTickets
5. ❌ projectTeamMembers
6. ❌ completedTickets
7. ❌ totalProjectTickets (count)
8. ❌ recentProjectTickets (pagination)
9. ❌ allProjectTickets (all projects mode)
10. ❌ currentMonthAllTickets
11. ❌ previousAllProjectTickets
12. ❌ allProjectTeamMembers
13. ❌ allCompletedTickets
14. ❌ totalAllProjectTickets (count)
15. ❌ recentAllProjectTickets (pagination)
16. ❌ Team member ticket counts (loop)

### MEMBER Section (Lines 1019-1271)
1. ❌ memberProjectsQuery
2. ❌ memberTickets
3. ❌ currentMonthMemberTickets
4. ❌ previousMemberTickets
5. ❌ myAssignedTickets
6. ❌ myCreatedTickets
7. ❌ recentMemberTickets

## Recommendation
Given the extreme complexity, this file should be migrated using a complete rewrite approach:
1. Create new file with all Drizzle queries
2. Test each role section independently
3. Replace original once validated

Estimated time: 2-3 hours for complete migration + testing
