# Security Guidelines

## ⚠️ CRITICAL: Protecting Sensitive Information

### 🚨 Never Commit These Files

The following files contain sensitive information and must NEVER be committed to version control or uploaded to Box:

- `api/local.settings.json` - Contains API keys, connection strings, and secrets
- `.env` files - Environment-specific configuration
- Any file with actual credentials or connection strings

### ✅ What to Commit Instead

- `api/local.settings.json.example` - Template with placeholder values
- `.env.example` - Template for environment variables

## 🔐 Setting Up Local Development

### 1. Create Your Local Settings

Copy the example file and fill in your actual credentials:

```bash
cd api
cp local.settings.json.example local.settings.json
```

### 2. Configure Your Credentials

Edit `local.settings.json` with your actual values:

- `CosmosDbConnectionString` - From Azure Portal → Cosmos DB → Keys
- `SLACK_BOT_TOKEN` - From Slack App → OAuth & Permissions
- `SLACK_SIGNING_SECRET` - From Slack App → Basic Information
- `BOX_IMPORT_STORAGE_CONNECTION` - From Azure Portal → Storage Account → Access Keys
- `GEMINI_API_KEY` - From Google AI Studio (optional)

### 3. Verify .gitignore

Ensure `local.settings.json` is listed in `.gitignore` to prevent accidental commits.

## 🔒 Production Environment

### Azure Function App Settings

Configure production credentials in Azure Portal:

1. Navigate to your Function App
2. Go to Configuration → Application settings
3. Add all required settings from `local.settings.json.example`
4. Use Azure Key Vault references for sensitive values (recommended)

Example Key Vault reference:
```
@Microsoft.KeyVault(SecretUri=https://your-keyvault.vault.azure.net/secrets/CosmosDbConnectionString/)
```

## 🛡️ Security Best Practices

### API Keys and Secrets

1. **Rotate regularly** - Change credentials every 90 days
2. **Use minimum permissions** - Grant only necessary access
3. **Monitor usage** - Set up alerts for unusual activity
4. **Never log secrets** - Avoid logging credentials in application logs

### Authentication

- All API endpoints should require authentication (except HealthCheck)
- Use Azure AD for user authentication
- Implement role-based access control (RBAC)

### CORS Configuration

- Configure CORS for specific domains only
- Development: `http://localhost:5173`
- Production: Your actual domain (e.g., `https://your-app.azurestaticapps.net`)

## 🚨 If Credentials Are Exposed

If you accidentally commit or expose credentials:

1. **Immediately rotate** all exposed credentials
   - Cosmos DB: Regenerate keys in Azure Portal
   - Slack: Regenerate tokens in Slack App settings
   - Storage Account: Regenerate access keys
   - Gemini API: Revoke and create new key

2. **Remove from Git history** (if committed):
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch api/local.settings.json" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push** to update remote:
   ```bash
   git push origin --force --all
   ```

4. **Notify team members** to pull the cleaned history

## 📧 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Contact the development team directly
3. Provide details about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## 📚 Additional Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [Azure Functions Security](https://docs.microsoft.com/azure/azure-functions/security-concepts)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
