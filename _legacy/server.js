const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'events.json');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

// Helper to read data
const readData = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
};

// Helper to write data
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API: Get All Events
    if (req.url === '/api/events' && req.method === 'GET') {
        const events = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(events));
        return;
    }

    // Redirect /admin to /admin.html
    if (req.url === '/admin') {
        res.writeHead(302, { 'Location': '/admin.html' });
        res.end();
        return;
    }

    // API: Add Event
    if (req.url === '/api/events' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const newEvent = JSON.parse(body);
            const events = readData();
            newEvent.id = Date.now().toString(); // Simple ID generation
            events.push(newEvent);
            writeData(events);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newEvent));
        });
        return;
    }

    // API: Delete Event
    if (req.url.startsWith('/api/events/') && req.method === 'DELETE') {
        const id = req.url.split('/').pop();
        let events = readData();
        events = events.filter(event => event.id !== id);
        writeData(events);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Deleted' }));
        return;
    }

    // API: Login (Simple Mock)
    if (req.url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const { email, password } = JSON.parse(body);
            // Hardcoded "Admin" Check
            if (password === 'Philly+123') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, token: 'mock-token' }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
            }
        });
        return;
    }

    /* ==========================
       GALLERY API
       ========================== */
    const GALLERY_DB = path.join(__dirname, 'data', 'gallery.json');
    const GALLERY_DIR = path.join(__dirname, 'img', 'gallery');

    // Ensure gallery dir exists
    if (!fs.existsSync(GALLERY_DIR)) {
        fs.mkdirSync(GALLERY_DIR, { recursive: true });
    }

    const readGallery = () => {
        if (!fs.existsSync(GALLERY_DB)) return [];
        return JSON.parse(fs.readFileSync(GALLERY_DB, 'utf8') || '[]');
    };

    const writeGallery = (data) => {
        fs.writeFileSync(GALLERY_DB, JSON.stringify(data, null, 2));
    };

    // API: Get Gallery
    if (req.url === '/api/gallery' && req.method === 'GET') {
        const photos = readGallery();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(photos));
        return;
    }

    // API: Upload Photo
    if (req.url === '/api/gallery' && req.method === 'POST') {
        let body = '';
        // Increase limit for large images if needed (Node.js default is usually sufficient for reasonable base64)
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { imageBase64, caption } = JSON.parse(body);

                // Decode Base64 [data:image/jpeg;base64,.....]
                const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) {
                    throw new Error('Invalid input string');
                }

                const type = matches[1];
                const data = Buffer.from(matches[2], 'base64');
                const extension = type.split('/')[1];
                const id = Date.now().toString();
                const filename = `${id}.${extension}`;
                const filePath = path.join(GALLERY_DIR, filename);

                // Save file
                fs.writeFileSync(filePath, data);

                // Update DB
                const photos = readGallery();
                const newPhoto = { id, filename, caption, date: new Date().toISOString() };
                photos.unshift(newPhoto); // Add to top
                writeGallery(photos);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newPhoto));
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Upload failed' }));
            }
        });
        return;
    }

    // API: Delete Photo
    if (req.url.startsWith('/api/gallery/') && req.method === 'DELETE') {
        const id = req.url.split('/').pop();
        let photos = readGallery();
        const photo = photos.find(p => p.id === id);

        if (photo) {
            // Delete file
            const filePath = path.join(GALLERY_DIR, photo.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            // Update DB
            photos = photos.filter(p => p.id !== id);
            writeGallery(photos);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Deleted' }));
        return;
    }

    // Static File Serving
    // Decode URL to handle spaces (%20)
    let safeUrl = decodeURIComponent(req.url);
    let filePath = '.' + safeUrl;
    if (filePath === './') filePath = './index.html';

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Admin Panel: http://localhost:${PORT}/admin.html`);
});
