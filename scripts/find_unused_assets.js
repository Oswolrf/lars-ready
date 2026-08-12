const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'Skills' && file !== 'scripts') {
                    getFiles(filePath, fileList);
                }
            } else {
                fileList.push(filePath);
            }
        } catch (e) {
            // Context access error or similar
        }
    });
    return fileList;
}

const allFiles = getFiles(projectRoot);

// 1. Unused Images
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.pdf'];
const imageFiles = allFiles.filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));

// 2. Unused HTML
const htmlFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.html');

// 3. Source files to search in (HTML, JS, CSS, JSON)
const sourceFiles = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.html', '.js', '.css', '.json', '.vue', '.jsx', '.tsx'].includes(ext) && !file.includes('package-lock.json');
});

const unusedImages = [];
const unusedHtml = [];

// Check Images
imageFiles.forEach(imagePath => {
    const imageName = path.basename(imagePath);
    let isUsed = false;
    for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(imageName)) {
            isUsed = true;
            break;
        }
    }
    if (!isUsed) {
        unusedImages.push(imagePath);
    }
});

// Check HTML
htmlFiles.forEach(htmlPath => {
    const htmlName = path.basename(htmlPath);
    if (htmlName.toLowerCase() === 'index.html') return;

    let isUsed = false;
    for (const file of sourceFiles) {
        if (file === htmlPath) continue; // Don't count self-reference

        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(htmlName)) {
            isUsed = true;
            break;
        }
    }
    if (!isUsed) {
        unusedHtml.push(htmlPath);
    }
});

let report = 'Unused Images:\n';
unusedImages.forEach(f => report += f + '\n');
report += '\nUnused HTML:\n';
unusedHtml.forEach(f => report += f + '\n');

fs.writeFileSync(path.join(projectRoot, 'unused_report.txt'), report, 'utf8');
console.log('Report written to unused_report.txt');
