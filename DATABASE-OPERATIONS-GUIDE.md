# Database Operations Guide - Lokale Banen

## 🎯 **Database Task Guidelines**

**ALWAYS use Supabase MCP when available and logical for database operations.**

### ✅ **Use Supabase MCP for:**
- Running migrations (`mcp__supabase__apply_migration`)
- Executing SQL queries (`mcp__supabase__execute_sql`)
- Listing tables and schemas (`mcp__supabase__list_tables`)
- Getting project information (`mcp__supabase__get_project`)
- Managing database structure

### ❌ **Use traditional SQL files for:**
- Complex migrations that need version control
- Schema definitions that need to be tracked in git
- Backup/documentation purposes

## 🔧 **Standard Operations**

### **Running Migrations**
```typescript
// Use MCP instead of manual SQL execution
await mcp__supabase__apply_migration({
  project_id: "your-project-id",
  name: "migration_name_snake_case",
  query: "ALTER TABLE ..."
})
```

### **Quick Data Operations**
```typescript
// Use MCP for one-off queries
await mcp__supabase__execute_sql({
  project_id: "your-project-id",
  query: "SELECT * FROM contacts WHERE is_blocked = true"
})
```

### **Schema Exploration**
```typescript
// Use MCP to explore database structure
await mcp__supabase__list_tables({
  project_id: "your-project-id",
  schemas: ["public"]
})
```

## 📋 **Best Practices**

1. **Always use MCP first** - check if Supabase MCP can handle the task
2. **Keep migrations in git** - even when using MCP, maintain .sql files for version control
3. **Test queries safely** - use `execute_sql` for testing before applying migrations
4. **Document changes** - update this guide when patterns change

---

*This guide ensures we use the most efficient tools for database operations while maintaining proper version control and documentation.*