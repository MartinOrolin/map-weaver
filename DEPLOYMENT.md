# Deployment Instructions for Apache

This guide explains how to build and deploy the D&D Interactive Maps app on Apache for local network use.

## Prerequisites

- Node.js (v16 or higher)
- Apache web server installed
- npm or yarn package manager

## Building the Application

1. **Install dependencies:**
```bash
npm install
```

2. **Build for production:**
```bash
npm run build
```

This creates a `dist` folder with all the compiled files.

## Deploying to Apache

### Option 1: Copy to Apache Directory

1. Copy the `dist` folder contents to your Apache web directory:

```bash
# For Ubuntu/Debian
sudo cp -r dist/* /var/www/html/dnd-maps/

# For Windows (using XAMPP)
# Copy dist/* to C:\xampp\htdocs\dnd-maps\

# For macOS (using MAMP)
# Copy dist/* to /Applications/MAMP/htdocs/dnd-maps/
```

2. Set proper permissions (Linux/macOS):
```bash
sudo chmod -R 755 /var/www/html/dnd-maps/
```

### Option 2: Configure Custom Directory

1. Create a new virtual host configuration:

```bash
# Linux/macOS
sudo nano /etc/apache2/sites-available/dnd-maps.conf
```

2. Add this configuration:

```apache
<VirtualHost *:80>
    ServerName dnd-maps.local
    DocumentRoot /path/to/your/dist
    
    <Directory /path/to/your/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable client-side routing
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

3. Enable the site and required modules:

```bash
# Enable mod_rewrite for client-side routing
sudo a2enmod rewrite

# Enable the site
sudo a2ensite dnd-maps.conf

# Restart Apache
sudo systemctl restart apache2
```

4. Add to your hosts file (optional for custom domain):

```bash
# Linux/macOS
sudo nano /etc/hosts

# Add this line:
127.0.0.1    dnd-maps.local
```

## Accessing on Local Network

1. Find your computer's IP address:

```bash
# Linux/macOS
ifconfig | grep "inet "

# Windows
ipconfig
```

2. Other devices on the same network can access via:
```
http://YOUR_IP_ADDRESS/dnd-maps/
```

Or if using virtual host:
```
http://YOUR_IP_ADDRESS/
```

## Development Mode

For development with hot-reload:

```bash
npm run dev
```

Access at `http://localhost:8080`

To allow other devices to access during development:
```bash
npm run dev -- --host 0.0.0.0
```

Then access via `http://YOUR_IP_ADDRESS:8080`

## Storage Notes

- All data is stored in browser localStorage
- Each browser/device has its own separate storage
- For shared access, you'll need to export/import world configurations
- Data persists until browser cache is cleared

## Troubleshooting

**404 errors on routes:**
- Ensure mod_rewrite is enabled
- Check `.htaccess` or virtual host configuration includes the rewrite rules

**Can't access from other devices:**
- Check firewall settings
- Ensure Apache is listening on 0.0.0.0 (not just 127.0.0.1)
- Verify devices are on the same network

**Blank page:**
- Check browser console for errors
- Ensure all files were copied correctly
- Verify file permissions
