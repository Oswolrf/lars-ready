const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, 'images');

const filesToDelete = [
    'casona_tradicion.webp',
    'DJI_20250531181924_0386_D.jpg',
    'DJI_20250531181924_0386_D.webp',
    'DJI_20250531200435_0401_D.webp',
    'DJI_20250605191757_0615_D.jpg',
    'DJI_20250605191757_0615_D.webp',
    'dji_fly_20250531_181820_0382_1748710229973_photo.jpg',
    'dji_fly_20250531_181820_0382_1748710229973_photo.webp',
    'home-hero-updated.webp',
    'home-hero-updated_new.webp',
    'la-casona-card-bg.webp',
    'la-casona-card-bg_new.webp',
    'las-villas-card-bg.webp',
    'las-villas-card-bg_new.webp',
    'minas.webp',
    'os_fornos.webp',
    'playa_catedrales.webp',
    'villa_camelia_details.webp',
    'villa_el_camino_bedroom.webp',
    'villa_jazmin_bathroom.webp'
];

let deletedCount = 0;
let errorCount = 0;

console.log(`Attempting to delete ${filesToDelete.length} files...`);

filesToDelete.forEach(file => {
    const filePath = path.join(imagesDir, file);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted: ${file}`);
            deletedCount++;
        } else {
            console.log(`File not found (already deleted?): ${file}`);
        }
    } catch (err) {
        console.error(`Error deleting ${file}: ${err.message}`);
        errorCount++;
    }
});

console.log(`\nOperation complete.`);
console.log(`Deleted: ${deletedCount}`);
console.log(`Errors: ${errorCount}`);
