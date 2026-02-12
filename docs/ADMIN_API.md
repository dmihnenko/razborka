# Admin API - Edge Functions Documentation

This document describes the administrative Edge Functions deployed to Supabase for privileged operations.

## Base URL
```
https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1
```

## Authentication
All endpoints require a valid JWT token from an authenticated admin user in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Delete User
**Endpoint:** `/delete-user`  
**Method:** `POST`  
**Description:** Permanently deletes a user from the authentication system and all related data.

**Request Body:**
```json
{
  "userId": "uuid-of-user-to-delete"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing userId parameter
- `401` - Missing or invalid authorization
- `403` - User is not an administrator
- `500` - Server error

---

### 2. Create User
**Endpoint:** `/create-user`  
**Method:** `POST`  
**Description:** Creates a new user with email/password authentication and assigns roles.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "full_name": "John Doe",
  "phone": "+380501234567",
  "role_ids": ["role-uuid-1", "role-uuid-2"],
  "primary_role_id": "role-uuid-1",
  "sto_company_id": "company-uuid",
  "parts_company_id": null
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "new-user-uuid",
    "email": "user@example.com"
  }
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing required fields (email, password)
- `401` - Missing or invalid authorization
- `403` - User is not an administrator
- `500` - Server error

---

### 3. Reset Password
**Endpoint:** `/reset-password`  
**Method:** `POST`  
**Description:** Resets a user's password without requiring email verification.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "newPassword": "new_secure_password"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing userId or newPassword
- `401` - Missing or invalid authorization
- `403` - User is not an administrator
- `500` - Server error

---

## Usage Examples

### TypeScript/React Query

```typescript
// Delete User
const deleteUserMutation = useMutation({
  mutationFn: async (userId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }
});

// Create User
const createUserMutation = useMutation({
  mutationFn: async (userData: UserFormData) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: userData,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }
});

// Reset Password
const resetPasswordMutation = useMutation({
  mutationFn: async ({ userId, newPassword }: { userId: string, newPassword: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('reset-password', {
      body: { userId, newPassword },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  }
});
```

---

## Security Features

1. **Service Role Authentication**: All functions use the `SUPABASE_SERVICE_ROLE_KEY` environment variable, which is automatically set by Supabase and never exposed to the client.

2. **Admin Role Verification**: Each function verifies that the requesting user has the `admin` role before performing any operations.

3. **CORS Protection**: Configured to accept requests from authorized origins only.

4. **Token Validation**: All requests must include a valid JWT token from an authenticated session.

5. **Cascading Deletes**: User deletion properly removes associated records from `user_roles` and `user_profiles` tables.

---

## Deployment

Deploy all functions using the Supabase CLI:

```bash
# Deploy individual function
supabase functions deploy delete-user
supabase functions deploy create-user
supabase functions deploy reset-password

# Or deploy all at once
supabase functions deploy
```

Or use the PowerShell script:
```powershell
.\scripts\deploy-edge-functions.ps1
```

---

## Environment Variables

These are automatically set by Supabase:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key with admin privileges

No additional configuration needed.

---

## Error Handling

All functions return standardized error responses:

```json
{
  "error": "Descriptive error message"
}
```

Common error scenarios:
- Missing authorization header → 401
- Invalid token → 401
- Non-admin user → 403
- Missing required parameters → 400
- Database/auth errors → 500

---

## Logging

All functions log errors to Supabase Edge Function logs. View them at:
```
https://supabase.com/dashboard/project/hwckvddevjucuzxdoqqh/functions
```

---

## Testing

Test functions using curl:

```bash
# Get your session token first
TOKEN="your-jwt-token"

# Test delete-user
curl -X POST \
  https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/delete-user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'

# Test create-user
curl -X POST \
  https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/create-user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "full_name": "Test User",
    "role_ids": ["role-uuid"]
  }'
```
