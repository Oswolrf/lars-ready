#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const siteConfig = require('../../site.config.cjs');
const {
    JOBS,
    INPUT_ROOT,
    OUTPUT_ROOT,
    WORKSPACE_ROOT
} = require('./prepare-hero-videos.js');

const REVIEW_PATH = path.join(WORKSPACE_ROOT, '.cache', 'video-review', 'index.html');
const HERO_KEY_BY_SLUG = {
    home: 'home',
    'la-casona': 'casona',
    'las-villas': 'villas',
    entorno: 'entorno',
    'sobre-nosotros': 'nosotros'
};

function readOptionValue(argv, index, name) {
    const argument = argv[index];
    const prefix = `${name}=`;
    if (argument.startsWith(prefix)) {
        const value = argument.slice(prefix.length);
        if (!value) throw new Error(`Falta valor para ${name}`);
        return { value, nextIndex: index };
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${name}`);
    return { value, nextIndex: index + 1 };
}

function parseArguments(argv) {
    const options = { selection: 'original', revision: 'v3', only: null, json: false, html: true, help: false };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--help') {
            options.help = true;
        } else if (argument === '--json') {
            options.json = true;
        } else if (argument === '--no-html') {
            options.html = false;
        } else if (argument === '--revision' || argument.startsWith('--revision=')) {
            const parsed = readOptionValue(argv, index, '--revision');
            options.revision = parsed.value;
            index = parsed.nextIndex;
        } else if (argument === '--selection' || argument.startsWith('--selection=')) {
            const parsed = readOptionValue(argv, index, '--selection');
            options.selection = parsed.value;
            index = parsed.nextIndex;
        } else if (argument === '--only' || argument.startsWith('--only=')) {
            const parsed = readOptionValue(argv, index, '--only');
            options.only = parsed.value;
            index = parsed.nextIndex;
        } else {
            throw new Error(`Argumento no reconocido: ${argument}`);
        }
    }
    if (!['original', 'optimized'].includes(options.selection)) {
        throw new Error('--selection debe ser original u optimized');
    }
    if (!/^v[1-9][0-9]*$/.test(options.revision)) throw new Error('--revision debe tener formato vN');
    if (options.only && !JOBS.some((job) => job.slug === options.only)) {
        throw new Error(`Hero desconocido para --only: ${options.only}`);
    }
    return options;
}

function probe(candidate) {
    if (!fs.existsSync(candidate)) return null;
    const result = spawnSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,avg_frame_rate',
        '-show_entries', 'format=duration,size,bit_rate',
        '-of', 'json',
        candidate
    ], {
        cwd: WORKSPACE_ROOT,
        shell: false,
        encoding: 'utf8',
        windowsHide: true
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`ffprobe falló para ${candidate}: ${result.stderr.trim()}`);
    }
    const parsed = JSON.parse(result.stdout);
    const stream = parsed.streams?.[0] || {};
    const format = parsed.format || {};
    return {
        path: path.relative(WORKSPACE_ROOT, candidate).replaceAll(path.sep, '/'),
        bytes: Number(format.size || fs.statSync(candidate).size),
        durationSeconds: Number(format.duration || 0),
        bitrate: Number(format.bit_rate || 0),
        codec: stream.codec_name || 'unknown',
        resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : 'unknown',
        frameRate: stream.avg_frame_rate || 'unknown'
    };
}

function compare(options) {
    return JOBS
        .filter((job) => !options.only || job.slug === options.only)
        .map((job) => {
            const baselinePath = path.join(INPUT_ROOT, job[options.selection]);
            const baseline = probe(baselinePath);
            if (!baseline) throw new Error(`No existe el baseline: ${baselinePath}`);

            const derivatives = ['mp4', 'webm'].map((format) => {
                const details = probe(path.join(OUTPUT_ROOT, `${job.slug}-hero-${options.revision}.${format}`));
                if (!details) return { format, status: 'missing' };
                const baselineBytesPerSecond = baseline.durationSeconds > 0
                    ? baseline.bytes / baseline.durationSeconds
                    : 0;
                const derivativeBytesPerSecond = details.durationSeconds > 0
                    ? details.bytes / details.durationSeconds
                    : 0;
                return {
                    format,
                    status: 'ready',
                    ...details,
                    normalizedByteRateSavingsPercent: baselineBytesPerSecond > 0
                        ? Number(((1 - derivativeBytesPerSecond / baselineBytesPerSecond) * 100).toFixed(1))
                        : null
                };
            });

            return { slug: job.slug, selection: options.selection, revision: options.revision, baseline, derivatives };
        });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function writeReviewPage(comparisons) {
    const sections = comparisons.map((comparison) => {
        const hero = siteConfig.heroVideos[HERO_KEY_BY_SLUG[comparison.slug]];
        const poster = path.join(WORKSPACE_ROOT, ...hero.poster.desktop.replace(/^\//, '').split('/'));
        const original = path.join(WORKSPACE_ROOT, ...comparison.baseline.path.split('/'));
        const cut = path.join(OUTPUT_ROOT, `${comparison.slug}-hero-${comparison.revision}.mp4`);
        const mp4 = comparison.derivatives.find((entry) => entry.format === 'mp4');
        return `<section><h2>${escapeHtml(comparison.slug)}</h2><p>Original: ${formatBytes(comparison.baseline.bytes)} · Recorte ${escapeHtml(comparison.revision)}: ${mp4?.status === 'ready' ? formatBytes(mp4.bytes) : 'no disponible'}</p><div class="grid"><figure><img src="${pathToFileURL(poster).href}" alt=""><figcaption>Póster publicado</figcaption></figure><figure><video controls muted loop preload="metadata" src="${pathToFileURL(original).href}"></video><figcaption>Original completo (solo lectura)</figcaption></figure><figure><video controls muted loop preload="metadata" src="${pathToFileURL(cut).href}"></video><figcaption>Recorte ${escapeHtml(comparison.revision)}</figcaption></figure></div></section>`;
    }).join('');
    const document = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparación de vídeos hero</title><style>body{margin:0;background:#172019;color:#f4f1ea;font:16px system-ui;padding:2rem}main{max-width:1440px;margin:auto}section{margin:0 0 4rem}h1,h2{font-family:Georgia,serif}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}figure{margin:0;background:#222e26;padding:.75rem;border-radius:.75rem}img,video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0e110f}figcaption{padding:.7rem .2rem .1rem;color:#d8d2c7}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style></head><body><main><h1>Póster, original y recorte</h1><p>Los originales se reproducen desde su ubicación actual y no se modifican.</p>${sections}</main></body></html>`;
    fs.mkdirSync(path.dirname(REVIEW_PATH), { recursive: true });
    fs.writeFileSync(REVIEW_PATH, document, 'utf8');
    return REVIEW_PATH;
}

function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function printHumanReadable(comparisons) {
    comparisons.forEach((comparison) => {
        const baseline = comparison.baseline;
        process.stdout.write(
            `\n${comparison.slug} [${comparison.selection}]\n` +
            `  baseline  ${formatBytes(baseline.bytes)}  ${baseline.durationSeconds.toFixed(1)}s  ` +
            `${baseline.resolution}  ${baseline.codec}\n`
        );
        comparison.derivatives.forEach((derivative) => {
            if (derivative.status === 'missing') {
                process.stdout.write(`  ${derivative.format.padEnd(8)} missing\n`);
                return;
            }
            process.stdout.write(
                `  ${derivative.format.padEnd(8)} ${formatBytes(derivative.bytes)}  ` +
                `${derivative.durationSeconds.toFixed(1)}s  ${derivative.resolution}  ` +
                `${derivative.codec}  ahorro normalizado ${derivative.normalizedByteRateSavingsPercent ?? 'n/a'}%\n`
            );
        });
    });
}

function main(argv = process.argv.slice(2)) {
    try {
        const options = parseArguments(argv);
        if (options.help) {
            process.stdout.write(
                'Usage: node scripts/media/compare-hero-videos.js ' +
                '[--selection original|optimized] [--revision vN] [--only slug] [--json] [--no-html]\n'
            );
            return;
        }
        const comparisons = compare(options);
        if (options.json) {
            process.stdout.write(`${JSON.stringify(comparisons, null, 2)}\n`);
        } else {
            printHumanReadable(comparisons);
        }
        if (options.html) process.stdout.write(`\nComparador visual: ${writeReviewPage(comparisons)}\n`);
    } catch (error) {
        process.stderr.write(`Error: ${error.message}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = { compare, parseArguments, probe };
