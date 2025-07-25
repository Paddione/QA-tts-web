# Nginx Proxy Manager Setup

## Overview

The Nginx Proxy Manager provides SSL-enabled external access to the web application and database. It's configured to automatically manage SSL certificates through Let's Encrypt and provides a user-friendly admin interface.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# SSL Configuration
CERT_MAIL=your.email@example.com  # Email for Let's Encrypt notifications
```

### Access Points

- **Admin UI**: `http://your-server-ip:81`
- **Default login**:
  - Email: `admin@example.com`
  - Password: `changeme`

### Initial Setup

1. **First Login**:
   - Access the admin interface at `http://your-server-ip:81`
   - Use the default credentials
   - Change the default password when prompted

2. **Configure Proxy Host for Web Application**:
   - Click "Add Proxy Host"
   - Domain Name: `web.korczewski.de`
   - Scheme: `http`
   - Forward Hostname: `web-app`
   - Forward Port: `3000`
   - Enable SSL:
     - Request new SSL certificate
     - Force SSL
     - HTTP/2 Support
     - Use your configured CERT_MAIL

3. **Database Access Configuration**:
   
   **Note**: Nginx Proxy Manager doesn't support TCP proxying through its web interface. For PostgreSQL database access, you have several options:
   
   **Option A: Direct Connection (Current Setup)**
   - PostgreSQL is already exposed on port 5432 in docker-compose.yml
   - Connect directly to `your-server-ip:5432`
   - Use database credentials from your `.env` file
   - Connection string: `postgresql://${DB_USER}:${DB_PASSWORD}@your-server-ip:5432/${DB_NAME}`
   
   **Option B: Add pgAdmin Web Interface (Recommended for production)**
   Add this service to your docker-compose.yml:
   ```yaml
   pgadmin:
     image: dpage/pgadmin4:latest
     container_name: clipboard_pgadmin
     environment:
       - PGADMIN_DEFAULT_EMAIL=admin@example.com
       - PGADMIN_DEFAULT_PASSWORD=admin_password
     expose:
       - "80"
     networks:
       - clipboard_network
     restart: unless-stopped
   ```
   Then proxy `pgadmin.your-domain.com` → `pgadmin:80` in Nginx Proxy Manager
   
   **Option C: SSH Tunnel (Most Secure for remote access)**
   - Set up SSH access to your server
   - Create SSH tunnel: `ssh -L 5432:localhost:5432 user@your-server-ip`
   - Connect to localhost:5432 from your local machine

### Database Security Considerations

**Important**: If using direct database connections over the internet:

1. **Firewall Configuration**:
   ```bash
   # Only allow database access from specific IPs
   ufw allow from YOUR_IP_ADDRESS to any port 5432
   ufw deny 5432
   ```

2. **PostgreSQL Configuration**:
   - Use strong passwords in `.env` file
   - Consider IP restrictions in `pg_hba.conf`
   - Enable SSL connections if needed

3. **Recommended Approach**:
   - Use pgAdmin web interface with HTTPS proxy for production
   - Use SSH tunnels for remote development access
   - Restrict direct database access to localhost/VPN only

### Security Recommendations

1. **Admin Interface**:
   - Change default credentials immediately
   - Set up 2FA for admin accounts
   - Consider restricting admin UI access to specific IPs

2. **SSL/TLS**:
   - Enable HSTS
   - Use modern TLS versions (1.2, 1.3)
   - Configure strong cipher suites

3. **Access Control**:
   - Set up access lists for sensitive endpoints
   - Configure rate limiting
   - Enable basic authentication for development endpoints

### Troubleshooting

1. **Certificate Issues**:
   ```bash
   # Check certificate logs
   docker-compose logs nginx-proxy-manager
   ```

2. **Connection Problems**:
   - Verify DNS settings
   - Check firewall rules for ports 80/443
   - Ensure services are running: `docker-compose ps`

3. **Common Solutions**:
   - Clear browser cache
   - Verify domain DNS propagation
   - Check service health: `docker-compose ps`
   - Review proxy manager logs: `docker-compose logs -f nginx-proxy-manager`

### Maintenance

1. **Backup**:
   ```bash
   # Backup volumes
   docker run --rm -v clipboard_npm_data:/data -v $(pwd):/backup alpine tar czf /backup/npm_data.tar.gz /data
   docker run --rm -v clipboard_npm_letsencrypt:/etc/letsencrypt -v $(pwd):/backup alpine tar czf /backup/npm_letsencrypt.tar.gz /etc/letsencrypt
   ```

2. **Updates**:
   ```bash
   # Update Nginx Proxy Manager
   docker-compose pull nginx-proxy-manager
   docker-compose up -d nginx-proxy-manager
   ```

3. **Certificate Renewal**:
   - Let's Encrypt certificates auto-renew
   - Monitor renewal emails sent to CERT_MAIL
   - Check status in admin UI

### Monitoring

1. **Health Checks**:
   - Admin UI shows proxy status
   - Certificate expiration monitoring
   - Access logs available in admin UI

2. **Metrics**:
   - Request statistics
   - SSL certificate status
   - Proxy performance data 