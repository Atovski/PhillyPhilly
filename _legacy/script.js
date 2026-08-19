/**
 * Philly Philly Food Truck - Dynamic Calendar Logic (Local API Edition)
 */

// Icons mapping
const typeIcons = {
    "market": "fa-map-marker-alt",
    "festival": "fa-music",
    "concert": "fa-guitar",
    "closed": "fa-home"
};

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Function to render Upcoming Events (Next 7 Days)
async function renderUpcomingEvents() {
    const container = document.getElementById('upcoming-events-list');
    if (!container) return;

    try {
        const res = await fetch('/api/events');
        let events = await res.json();

        // Filter: Today or Future
        const todayStr = new Date().toISOString().split('T')[0];
        events = events.filter(e => e.date >= todayStr);

        // Sort
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Limit to 7
        events = events.slice(0, 7);

        container.innerHTML = '';
        if (events.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem;">No upcoming events scheduled. check admin panel.</div>';
            return;
        }

        events.forEach(event => {
            const dateObj = new Date(event.date);
            const dayName = dayNames[dateObj.getDay()];
            const formattedDate = `${monthNames[dateObj.getMonth()].substring(0, 3)} ${dateObj.getDate()}`;
            const icon = typeIcons[event.type] || "fa-map-marker-alt";

            const html = (event.link && event.link.trim() !== "") ? `
                <a href="${event.link}" target="_blank" class="calendar-day" style="text-decoration: none; color: inherit; display: block;">
                    <div class="day-name">
                        ${formattedDate} - ${dayName}
                    </div>
                    <div class="day-location">
                        <i class="fas ${icon}"></i> ${event.location}
                        <i class="fas fa-external-link-alt" style="font-size: 0.8em; margin-left: 5px; opacity: 0.7;"></i>
                    </div>
                </a>
            ` : `
                <div class="calendar-day">
                    <div class="day-name">
                        ${formattedDate} - ${dayName}
                    </div>
                    <div class="day-location">
                        <i class="fas ${icon}"></i> ${event.location}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

    } catch (error) {
        console.error("Local API Error:", error);
        container.innerHTML = '<div style="text-align:center;">Error loading events. Is server.js running?</div>';
    }
}

// Function to render Full Month Calendar on Calendar Page
let currentCalendarDate = new Date();

function initCalendarPage() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => changeMonth(-1));
        nextBtn.addEventListener('click', () => changeMonth(1));
        renderMonthCalendar();
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderMonthCalendar();
}

async function renderMonthCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('calendar-month-title');

    if (!grid || !monthTitle) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    monthTitle.textContent = `${monthNames[month]} ${year}`;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading...</div>';

    // Dates for calculation
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    try {
        const res = await fetch('/api/events');
        const events = await res.json();

        // Create lookup map: "YYYY-MM-DD" -> Event Data
        const eventMap = {};
        events.forEach(e => eventMap[e.date] = e);

        grid.innerHTML = '';

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-cell', 'empty');
            grid.appendChild(emptyCell);
        }

        const today = new Date();

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            let location = "No Event";
            let icon = "";
            let hasEvent = false;

            if (eventMap[dateStr]) {
                location = eventMap[dateStr].location;
                icon = typeIcons[eventMap[dateStr].type] || "fa-map-marker-alt";
                hasEvent = true;
            }

            const cell = document.createElement('div');
            cell.classList.add('calendar-cell');
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                cell.classList.add('is-today');
            }

            let contentHtml = '';
            if (hasEvent) {
                contentHtml = `
                    <i class="fas ${icon}"></i>
                    <span>${location}</span>
                `;
            }

            cell.innerHTML = `
                <div class="date-number">${day}</div>
                <div class="cell-content">${contentHtml}</div>
            `;

            grid.appendChild(cell);
        }

    } catch (error) {
        console.error(error);
        grid.innerHTML = "Error loading calendar. Is server running?";
    }
}

// Lightbox Logic
function openLightbox(imageSrc, caption) {
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        // Create Lightbox if not exists
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.className = 'lightbox-overlay';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <button class="lightbox-close">&times;</button>
                <img src="" alt="Full Image" class="lightbox-img">
                <div class="lightbox-caption"></div>
            </div>
        `;
        document.body.appendChild(lightbox);

        // Close events
        lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }

    const img = lightbox.querySelector('.lightbox-img');
    const cap = lightbox.querySelector('.lightbox-caption');

    img.src = imageSrc;
    cap.textContent = caption || '';

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Function to render Gallery on Home Page (Limit 6)
async function loadHomeGallery() {
    const container = document.getElementById('home-gallery-grid');
    if (!container) return;

    try {
        const res = await fetch('/api/gallery');
        const photos = await res.json();

        container.innerHTML = '';
        if (photos.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem;">No photos uploaded yet.</div>';
            return;
        }

        // Take top 6
        const previewPhotos = photos.slice(0, 6);

        previewPhotos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'instagram-item';
            div.style.cursor = 'pointer';
            div.innerHTML = `
                <img src="/img/gallery/${photo.filename}" alt="${photo.caption || 'Gallery Image'}" style="width: 100%; height: 100%; object-fit: cover;">
            `;
            // Add click listener
            div.addEventListener('click', () => openLightbox(`/img/gallery/${photo.filename}`, photo.caption));
            container.appendChild(div);
        });

    } catch (error) {
        console.error("Gallery Error:", error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Error loading gallery.</div>';
    }
}

// Function to render Full Gallery
async function loadFullGallery() {
    const container = document.getElementById('full-gallery-grid');
    if (!container) return;

    try {
        const res = await fetch('/api/gallery');
        const photos = await res.json();

        container.innerHTML = '';
        if (photos.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:4rem;">No photos uploaded yet. Check Admin Panel.</div>';
            return;
        }

        photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'instagram-item';
            div.style.height = '300px';
            div.style.cursor = 'pointer';
            div.innerHTML = `
                <img src="/img/gallery/${photo.filename}" alt="${photo.caption || 'Gallery Image'}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                ${photo.caption ? `<div style="padding: 10px; font-size: 0.9rem; text-align: center; color: #555;">${photo.caption}</div>` : ''}
            `;
            // Add click listener
            div.addEventListener('click', () => openLightbox(`/img/gallery/${photo.filename}`, photo.caption));
            container.appendChild(div);
        });

    } catch (error) {
        console.error("Gallery Error:", error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Error loading gallery.</div>';
    }
}

// Initialize scripts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    renderUpcomingEvents();
    initCalendarPage();
    loadHomeGallery();
    // loadFullGallery is called explicitly in gallery.html
});
